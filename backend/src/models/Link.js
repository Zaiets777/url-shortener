import { getPool } from '../config/database.js';

const COLUMNS = 'id, user_id, short_code, original_url, click_count, created_at, expires_at';
export const Link = {
  async findByShortCode(shortCode) {
    const { rows } = await getPool().query(`SELECT ${COLUMNS} FROM links WHERE short_code = $1`, [shortCode]);
    return rows[0] ?? null;
  },
  async findByUserId(userId, activeOnly = false) {
    const { rows } = await getPool().query(
      `SELECT ${COLUMNS} FROM links WHERE user_id = $1 ${activeOnly ? 'AND expires_at > NOW()' : ''} ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },
  async findOwnedByCode(userId, shortCode) {
    const { rows } = await getPool().query(
      `SELECT ${COLUMNS} FROM links WHERE user_id = $1 AND short_code = $2`,
      [userId, shortCode]
    );
    return rows[0] ?? null;
  },
  async create({ userId, shortCode, originalUrl, expiresInDays }) {
    const { rows } = await getPool().query(
      `INSERT INTO links (user_id, short_code, original_url, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4::integer * INTERVAL '1 day')) RETURNING ${COLUMNS}`,
      [userId, shortCode, originalUrl, expiresInDays]
    );
    return rows[0];
  },
  async remove(userId, id) {
    const { rowCount } = await getPool().query('DELETE FROM links WHERE id = $1 AND user_id = $2', [id, userId]);
    return rowCount > 0;
  },
  async update(userId, id, originalUrl, expiresInDays) {
    const { rows } = await getPool().query(
      `UPDATE links SET
        original_url = COALESCE($3, original_url),
        expires_at = CASE WHEN $4::integer IS NOT NULL THEN NOW() + ($4::integer * INTERVAL '1 day') ELSE expires_at END
       WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
      [id, userId, originalUrl, expiresInDays]
    );
    return rows[0] ?? null;
  },
  async resolveAndCount(shortCode) {
    const { rows } = await getPool().query(
      `UPDATE links SET click_count = click_count + 1
       WHERE short_code = $1 AND expires_at > NOW() RETURNING original_url`,
      [shortCode]
    );
    return rows[0]?.original_url ?? null;
  }
};
