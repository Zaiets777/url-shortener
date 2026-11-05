import { getPool } from '../config/database.js';

/**
 * Database model for users; authentication endpoints will use this later.
 * password_hash stores a one-way hash (never plaintext passwords).
 */
export const User = {
  async findById(id) {
    const { rows } = await getPool().query(
      'SELECT id, username, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  },
  async findByUsername(username) {
    const { rows } = await getPool().query(
      'SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = $1',
      [username]
    );
    return rows[0] ?? null;
  }
};
