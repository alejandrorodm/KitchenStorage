import { buildApp } from './app.js';
import { WebPushSender } from './notifications/infrastructure/web-push-sender.js';
import { GeminiReceiptParser } from './receipts/infrastructure/gemini-receipt-parser.js';

const env = process.env;

const receiptParser = env.GEMINI_API_KEY
  ? new GeminiReceiptParser(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-flash-latest')
  : null;

const pushSender =
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? new WebPushSender(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT ?? 'https://kitchen.alejandrorodm.com')
    : null;

const app = await buildApp({
  databasePath: env.DATABASE_PATH ?? 'data/kitchen.sqlite',
  receiptParser,
  pushSender,
  cookieSecure: env.COOKIE_SECURE === 'true',
  webDistPath: env.WEB_DIST_PATH,
  trustProxy: env.TRUST_PROXY === 'true',
  logger: true,
});

if (!receiptParser) app.log.warn('GEMINI_API_KEY not set: receipt reading is disabled');
if (!pushSender) app.log.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set: push notifications are disabled');

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: env.HOST ?? '0.0.0.0', port: Number(env.PORT ?? 3000) });
