import { getPool } from '../config/database.js';

const PUBLIC_COLUMNS = 'id, username, created_at, updated_at';

export const User = {
  async findById(id) {
    const { rows } = await getPool().query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },
  async findByUsername(username) {
    const { rows } = await getPool().query(
      'SELECT id, username, password_hash, created_at, updated_at FROM users WHERE lower(username) = lower($1)',
      [username]
    );
    return rows[0] ?? null;
  },
  async create(username, passwordHash) {
    const { rows } = await getPool().query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING ${PUBLIC_COLUMNS}`,
      [username, passwordHash]
    );
    return rows[0];
  }
};
