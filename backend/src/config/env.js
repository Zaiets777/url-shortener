import 'dotenv/config';

function integerSetting(name, fallback, min, max) {
  const raw = process.env[name];
  const parsed = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: integerSetting('PORT', 3000, 1, 65535),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  dbSsl: process.env.DB_SSL === 'true',
  dbPoolMax: integerSetting('DB_POOL_MAX', 10, 1, 100),
  jwtSecret: process.env.JWT_SECRET || '',
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  shortUrlOrigin: process.env.SHORT_URL_ORIGIN || `http://localhost:${process.env.PORT || 3000}`
});

if (!['lax', 'strict', 'none'].includes(env.cookieSameSite)) {
  throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
}
