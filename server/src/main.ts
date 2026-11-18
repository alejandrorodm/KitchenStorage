import { buildApp } from './app.js';
import { WebPushSender } from './notifications/infrastructure/web-push-sender.js';
import { GeminiFoodAssistant } from './assistant/infrastructure/gemini-food-assistant.js';
import { GeminiReceiptParser } from './receipts/infrastructure/gemini-receipt-parser.js';

const env = process.env;

const geminiModel = env.GEMINI_MODEL ?? 'gemini-flash-latest';
const receiptParser = env.GEMINI_API_KEY ? new GeminiReceiptParser(env.GEMINI_API_KEY, geminiModel) : null;
const foodAssistant = env.GEMINI_API_KEY ? new GeminiFoodAssistant(env.GEMINI_API_KEY, geminiModel) : null;

const pushSender =
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? new WebPushSender(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT ?? 'https://kitchen.alejandrorodm.com')
    : null;

const app = await buildApp({
  databasePath: env.DATABASE_PATH ?? 'data/kitchen.sqlite',
  receiptParser,
  foodAssistant,
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
