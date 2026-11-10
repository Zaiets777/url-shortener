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
  async findOwnedById(userId, linkId) {
    const { rows } = await getPool().query(
      `SELECT ${COLUMNS} FROM links WHERE user_id = $1 AND id = $2`,
      [userId, linkId]
    );
    return rows[0] ?? null;
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
  // An accepted redirect updates the total and inserts its timestamp in one transaction.
  // Row locking prevents concurrent clicks from losing counter increments.
  async resolveAndCount(shortCode, pool = getPool()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, original_url FROM links
         WHERE short_code = $1 AND expires_at > NOW() FOR UPDATE`,
        [shortCode]
      );
      const link = rows[0];
      if (!link) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        'INSERT INTO link_clicks (link_id, clicked_at) VALUES ($1, NOW())',
        [link.id]
      );
      await client.query(
        'UPDATE links SET click_count = click_count + 1 WHERE id = $1',
        [link.id]
      );
      await client.query('COMMIT');
      return link.original_url;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        console.error('Click transaction rollback failed:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  },
  // All daily boundaries use UTC. Includes today and previous days, with zero days.
  // The owner condition ensures users cannot read another user's analytics.
  async getDailyStats(userId, linkId, days = 7, pool = getPool()) {
    const { rows } = await pool.query(
      `WITH owned_link AS (
         SELECT id FROM links WHERE id = $1 AND user_id = $2
       ), days AS (
         SELECT (NOW() AT TIME ZONE 'UTC')::date - offsets.n AS day
         FROM generate_series(0, $3::integer - 1) AS offsets(n)
       )
       SELECT TO_CHAR(days.day, 'YYYY-MM-DD') AS date,
              COUNT(clicks.id)::integer AS clicks
       FROM owned_link
       CROSS JOIN days
       LEFT JOIN link_clicks clicks
         ON clicks.link_id = owned_link.id
        AND clicks.clicked_at >= (days.day::timestamp AT TIME ZONE 'UTC')
        AND clicks.clicked_at < ((days.day + 1)::timestamp AT TIME ZONE 'UTC')
       GROUP BY days.day
       ORDER BY days.day ASC`,
      [linkId, userId, days]
    );
    return rows;
  }
};
