import { createApp } from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection, closeDatabaseConnection } from './config/database.js';

async function main() {
  await checkDatabaseConnection();
  console.log('PostgreSQL connection established');

  const server = createApp().listen(env.port, () => {
    console.log(`API is listening on http://localhost:${env.port}`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down`);
    server.close(async (error) => {
      try {
        await closeDatabaseConnection();
        if (error) console.error(error);
        process.exit(error ? 1 : 0);
      } catch (dbError) {
        console.error(dbError);
        process.exit(1);
      }
    });
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(async (error) => {
  console.error('Backend startup failed:', error.message);
  await closeDatabaseConnection();
  process.exitCode = 1;
});
