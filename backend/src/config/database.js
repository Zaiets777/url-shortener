import pg from 'pg';
import { env } from './env.js';

let pool;

export function getPool() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is missing; set it in backend/.env');
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString: env.databaseUrl,
      max: env.dbPoolMax,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      ssl: env.dbSsl ? { rejectUnauthorized: true } : false
    });
    pool.on('error', (error) => {
      console.error('Unexpected PostgreSQL pool error:', error.message);
    });
  }
  return pool;
}

export async function checkDatabaseConnection() {
  await getPool().query('SELECT 1');
}

export async function closeDatabaseConnection() {
  if (pool) {
    const currentPool = pool;
    pool = undefined;
    await currentPool.end();
  }
}
