import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db.js';
import { logger } from './lib/logger.js';

async function main() {
  const e = env();
  await connectDb(e.MONGODB_URI);
  const server = createApp().listen(e.PORT, () => {
    logger.info('MandiMitra API listening', { port: e.PORT, env: e.NODE_ENV, gnaniConfigured: e.GNANI_API_KEY.length > 0 });
  });
  const shutdown = async (signal: string) => {
    logger.info('Shutting down', { signal });
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Failed to start', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
