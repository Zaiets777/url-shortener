import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getPool, closeDatabaseConnection } from '../src/config/database.js';

const schemaFiles = [
  '../sql/001_initial_schema.sql',
  '../sql/002_custom_alias.sql',
  '../sql/003_daily_clicks.sql'
].map((path) => fileURLToPath(new URL(path, import.meta.url)));
try {
  for (const file of schemaFiles) {
    const sql = await readFile(file, 'utf8');
    await getPool().query(sql);
  }
  console.log('Database schema and migrations applied successfully');
} catch (error) {
  console.error('Failed to initialize database:', error.message);
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection();
}
