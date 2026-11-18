import { buildApp } from './app.js';
import { WebPushSender } from './notifications/infrastructure/web-push-sender.js';
import { GeminiFoodAssistant } from './assistant/infrastructure/gemini-food-assistant.js';
import { TheMealDbRecipeSource } from './assistant/infrastructure/themealdb-recipe-source.js';
import { GeminiReceiptParser } from './receipts/infrastructure/gemini-receipt-parser.js';

const env = process.env;

const geminiModel = env.GEMINI_MODEL ?? 'gemini-flash-latest';
// An empty GEMINI_FALLBACK_MODEL turns the fallback off.
const geminiOptions = { fallbackModel: env.GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-flash-lite' };
const receiptParser = env.GEMINI_API_KEY ? new GeminiReceiptParser(env.GEMINI_API_KEY, geminiModel, geminiOptions) : null;
const foodAssistant = env.GEMINI_API_KEY ? new GeminiFoodAssistant(env.GEMINI_API_KEY, geminiModel, geminiOptions) : null;
// Dish ideas draw on TheMealDB unless RECIPES_DISABLED=true.
const recipeSource = env.RECIPES_DISABLED === 'true' ? null : new TheMealDbRecipeSource({ apiKey: env.THEMEALDB_API_KEY });

const pushSender =
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? new WebPushSender(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT ?? 'https://kitchen.alejandrorodm.com')
    : null;

const app = await buildApp({
  databasePath: env.DATABASE_PATH ?? 'data/kitchen.sqlite',
  receiptParser,
  foodAssistant,
  recipeSource,
  pushSender,
  cookieSecure: env.COOKIE_SECURE === 'true',
  webDistPath: env.WEB_DIST_PATH,
  trustProxy: env.TRUST_PROXY === 'true',
  logger: true,
});

if (!receiptParser) app.log.warn('GEMINI_API_KEY not set: receipt reading and the AI helpers are disabled');
if (!pushSender) app.log.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set: push notifications are disabled');

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: env.HOST ?? '0.0.0.0', port: Number(env.PORT ?? 3000) });
