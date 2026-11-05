import { getPool } from '../config/database.js';

/** Short-link model. A link is active while expires_at is in the future. */
export const Link = {
  async findByShortCode(shortCode) {
    const { rows } = await getPool().query(
      'SELECT id, user_id, short_code, original_url, click_count, created_at, expires_at FROM links WHERE short_code = $1',
      [shortCode]
    );
    return rows[0] ?? null;
  },
  async findByUserId(userId) {
    const { rows } = await getPool().query(
      'SELECT id, user_id, short_code, original_url, click_count, created_at, expires_at FROM links WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }
};
