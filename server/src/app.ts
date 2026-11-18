import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ServerResponse } from 'node:http';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AssistantService, type FoodAssistant } from './assistant/application/assistant-service.js';
import { registerAssistantRoutes } from './assistant/infrastructure/assistant-routes.js';
import { AuthService } from './auth/auth-service.js';
import { CategoryService } from './categories/application/category-service.js';
import { DishService } from './dishes/application/dish-service.js';
import { registerDishRoutes } from './dishes/infrastructure/dish-routes.js';
import { SqliteDishRepository } from './dishes/infrastructure/sqlite-dish-repository.js';
import { registerCategoryRoutes } from './categories/infrastructure/category-routes.js';
import { SqliteCategoryRepository } from './categories/infrastructure/sqlite-category-repository.js';
import { registerAuth, requireUser } from './auth/auth-routes.js';
import { registerHouseholdRoutes } from './households/household-routes.js';
import { HouseholdService } from './households/household-service.js';
import { InventoryService } from './inventory/application/inventory-service.js';
import { registerInventoryRoutes } from './inventory/infrastructure/inventory-routes.js';
import { SqliteFoodItemRepository } from './inventory/infrastructure/sqlite-food-item-repository.js';
import { MealPlanService } from './meal-plan/application/meal-plan-service.js';
import { registerMealPlanRoutes } from './meal-plan/infrastructure/meal-plan-routes.js';
import { SqliteMealPlanRepository } from './meal-plan/infrastructure/sqlite-meal-plan-repository.js';
import { ReceiptService, type ReceiptParser } from './receipts/application/receipt-service.js';
import { registerReceiptRoutes } from './receipts/infrastructure/receipt-routes.js';
import { ASSET_LINKS } from './shared/asset-links.js';
import { openDatabase, type Db } from './shared/db.js';
import { AppError } from './shared/errors.js';
import { ChangeEvents } from './shared/events.js';
import { validationMessage } from './shared/validation-message.js';
import { PushNotifier, type PushSender } from './notifications/application/push-notifier.js';
import { registerPushRoutes } from './notifications/infrastructure/push-routes.js';
import { SqlitePushSubscriptionRepository } from './notifications/infrastructure/sqlite-push-subscription-repository.js';
import { ShoppingService } from './shopping/application/shopping-service.js';
import { registerShoppingRoutes } from './shopping/infrastructure/shopping-routes.js';
import { SqliteShoppingRepository } from './shopping/infrastructure/sqlite-shopping-repository.js';

export interface AppOptions {
  databasePath: string;
  receiptParser: ReceiptParser | null;
  /** Text AI (categories, dish ideas); without it those actions are disabled. */
  foodAssistant?: FoodAssistant | null;
  /** Web Push delivery; without it, push notifications are disabled. */
  pushSender?: PushSender | null;
  cookieSecure: boolean;
  webDistPath?: string;
  logger?: boolean;
  trustProxy?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    changeEvents: ChangeEvents;
    auth: AuthService;
    households: HouseholdService;
  }
}

const MAX_RECEIPT_BYTES = 12 * 1024 * 1024;
const HEARTBEAT_MS = 25_000;

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: options.trustProxy ?? false });
  const db = openDatabase(options.databasePath);
  const events = new ChangeEvents();
  const households = new HouseholdService(db);
  const auth = new AuthService(db, households);
  app.decorate('changeEvents', events);
  app.decorate('auth', auth);
  app.decorate('households', households);
  const notifier = new PushNotifier(new SqlitePushSubscriptionRepository(db), options.pushSender ?? null, app.log);
  app.addHook('onClose', async () => db.close());

  // Each request works on the kitchen of the signed-in user's household.
  const kitchenFor = (request: FastifyRequest) => kitchen(db, requireUser(request).householdId, events, options.receiptParser, options.foodAssistant ?? null, notifier);

  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: MAX_RECEIPT_BYTES, files: 1 } });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'validation_error', message: validationMessage(error), issues: error.issues });
    }
    if (error instanceof AppError) {
      // Upstream failures (e.g. the receipt reader) keep the real reason only in the log.
      if (error.statusCode >= 500 && error.cause) request.log.error({ err: error.cause }, error.message);
      return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.code(statusCode).send({ error: 'bad_request', message: statusCode === 413 ? 'El archivo es demasiado grande' : 'Solicitud no válida' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'internal_error', message: 'Error inesperado del servidor' });
  });

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/.well-known/assetlinks.json', async () => ASSET_LINKS);
  registerAuth(app, auth, { cookieSecure: options.cookieSecure });
  registerHouseholdRoutes(app, households, (request) => kitchenFor(request).inventory.alertSettingsChanged());
  registerInventoryRoutes(app, (request) => kitchenFor(request).inventory);
  registerCategoryRoutes(app, (request) => kitchenFor(request).categories);
  registerMealPlanRoutes(app, (request) => kitchenFor(request).meals);
  registerShoppingRoutes(app, (request) => kitchenFor(request).shopping);
  registerPushRoutes(app, notifier);
  registerReceiptRoutes(app, (request) => kitchenFor(request).receipts);
  registerAssistantRoutes(app, (request) => kitchenFor(request).assistant);
  registerDishRoutes(app, (request) => kitchenFor(request).dishes);

  // Server-sent events: every device of the household refetches the topics that changed.
  // Open streams never end on their own, so they are ended on shutdown; otherwise a restart waits for them.
  const streams = new Set<ServerResponse>();
  app.addHook('preClose', async () => {
    for (const stream of streams) stream.end();
  });
  app.get('/api/events', (request, reply) => {
    const { householdId } = requireUser(request);
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    reply.raw.write('retry: 3000\n\n');
    const unsubscribe = events.subscribe(householdId, (topics) => reply.raw.write(`data: ${JSON.stringify({ topics })}\n\n`));
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), HEARTBEAT_MS);
    streams.add(reply.raw);
    request.raw.on('close', () => {
      streams.delete(reply.raw);
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  const webDist = options.webDistPath ?? fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== 'GET' || request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not_found', message: 'Ruta no encontrada' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}

/** Composition root for one household: wires its adapters into the use cases. */
function kitchen(
  db: Db,
  householdId: string,
  events: ChangeEvents,
  receiptParser: ReceiptParser | null,
  foodAssistant: FoodAssistant | null,
  notifier: PushNotifier,
) {
  const foodItems = new SqliteFoodItemRepository(db, householdId);
  const categories = new CategoryService(new SqliteCategoryRepository(db, householdId), () => events.publish(householdId, 'inventory'));
  // Clearing bought entries re-adds items that are still low; that is not news, so no push.
  const shopping = new ShoppingService(new SqliteShoppingRepository(db, householdId), () => {
    syncShopping();
    events.publish(householdId, 'shopping');
  });
  const syncShopping = () => shopping.syncWithStock(foodItems.list());
  // A stock change that puts items on the list tells the household's devices (in the background).
  const syncAndNotify = () => {
    const alerts = syncShopping().map(({ id, name, status }) => ({ id, name, status: status === 'out' ? ('out' as const) : ('low' as const) }));
    if (alerts.length > 0) void notifier.notifyStockAlerts(householdId, alerts);
  };
  const inventory = new InventoryService(
    foodItems,
    () => {
      syncAndNotify();
      events.publish(householdId, 'inventory', 'shopping');
    },
    (id) => categories.exists(id),
  );
  const meals = new MealPlanService(new SqliteMealPlanRepository(db, householdId), () => {
    syncAndNotify();
    events.publish(householdId, 'meals', 'inventory', 'shopping');
  });
  const receipts = new ReceiptService(receiptParser, inventory, categories);
  const assistant = new AssistantService(foodAssistant, inventory, categories);
  const dishes = new DishService(new SqliteDishRepository(db, householdId), () => events.publish(householdId, 'dishes'));
  return { inventory, categories, meals, shopping, receipts, assistant, dishes };
}
