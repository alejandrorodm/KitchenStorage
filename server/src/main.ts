import { buildApp } from './app.js';
import { GeminiReceiptParser } from './receipts/infrastructure/gemini-receipt-parser.js';

const env = process.env;

const inviteCode = env.INVITE_CODE;
if (!inviteCode || inviteCode.length < 6) {
  console.error('INVITE_CODE must be set (at least 6 characters): people need it to create an account.');
  process.exit(1);
}

const receiptParser = env.GEMINI_API_KEY
  ? new GeminiReceiptParser(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-flash-latest')
  : null;

const app = await buildApp({
  databasePath: env.DATABASE_PATH ?? 'data/kitchen.sqlite',
  inviteCode,
  receiptParser,
  cookieSecure: env.COOKIE_SECURE === 'true',
  webDistPath: env.WEB_DIST_PATH,
  trustProxy: env.TRUST_PROXY === 'true',
  logger: true,
});

if (!receiptParser) app.log.warn('GEMINI_API_KEY not set: receipt reading is disabled');

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: env.HOST ?? '0.0.0.0', port: Number(env.PORT ?? 3000) });
