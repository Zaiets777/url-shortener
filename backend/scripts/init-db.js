import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getPool, closeDatabaseConnection } from '../src/config/database.js';

const schemaFile = fileURLToPath(new URL('../sql/001_initial_schema.sql', import.meta.url));
try {
  const sql = await readFile(schemaFile, 'utf8');
  await getPool().query(sql);
  console.log('Schema applied: users and links tables are ready');
} catch (error) {
  console.error('Failed to initialize database:', error.message);
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection();
}
