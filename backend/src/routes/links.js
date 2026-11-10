import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { Link } from '../models/Link.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

export const linksRouter = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) throw new AppError(400, 'A valid HTTP(S) URL is required (max 2048 characters)');
  let url;
  try { url = new URL(input); } catch { throw new AppError(400, 'Invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new AppError(400, 'Only HTTP(S) URLs without embedded credentials are allowed');
  }
  return url.toString();
}

function outputLink(link) {
  return {
    id: link.id,
    userId: link.user_id,
    shortCode: link.short_code,
    shortUrl: `${env.shortUrlOrigin.replace(/\/$/, '')}/${link.short_code}`,
    originalUrl: link.original_url,
    clicks: link.click_count,
    createdAt: link.created_at,
    expiresAt: link.expires_at,
    status: new Date(link.expires_at) > new Date() ? 'active' : 'expired'
  };
}

linksRouter.use(requireAuth);
linksRouter.get('/', asyncHandler(async (req, res) => {
  const activeOnly = req.query.active === 'true';
  const links = await Link.findByUserId(req.user.id, activeOnly);
  res.json({ links: links.map(outputLink) });
}));

export function validateCustomAlias(customAlias) {
  if (customAlias === undefined) return undefined;
  if (typeof customAlias !== 'string' || !ALIAS_PATTERN.test(customAlias)) {
    throw new AppError(400, 'customAlias must be 3–32 characters: letters, numbers, hyphens or underscores');
  }
  return customAlias;
}

// Return 409 on duplicate aliases, including concurrent insert races.
export async function createLinkWithAlias({ userId, originalUrl, expiresInDays, customAlias, model = Link, generateCode = () => randomBytes(6).toString('base64url').slice(0, 8) }) {
  const alias = validateCustomAlias(customAlias);
  if (alias !== undefined) {
    if (await model.findByShortCode(alias)) throw new AppError(409, 'This custom alias is already taken');
    try {
      return await model.create({ userId, shortCode: alias, originalUrl, expiresInDays });
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'links_short_code_key') {
        throw new AppError(409, 'This custom alias is already taken');
      }
      throw error;
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await model.create({ userId, shortCode: generateCode(), originalUrl, expiresInDays });
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'links_short_code_key') continue;
      throw error;
    }
  }
  throw new AppError(503, 'Could not generate a unique link; please retry');
}

linksRouter.post('/', asyncHandler(async (req, res) => {
  const url = validateUrl(req.body?.originalUrl);
  const days = req.body?.expiresInDays ?? 7;
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new AppError(400, 'expiresInDays must be between 1 and 365');
  const link = await createLinkWithAlias({
    userId: req.user.id,
    originalUrl: url,
    expiresInDays: days,
    customAlias: req.body?.customAlias
  });
  res.status(201).json({ link: outputLink(link) });
}));

// Issue #20: daily click history for the last 7 (default) or 30 UTC days.
// Defined ahead of /:shortCode so "stats" cannot be confused with a short code.
export function parseStatsDays(raw) {
  if (raw === undefined || raw === '7') return 7;
  if (raw === '30') return 30;
  throw new AppError(400, 'days must be 7 or 30');
}

linksRouter.get('/:id/stats', asyncHandler(async (req, res) => {
  if (!uuidPattern.test(req.params.id)) throw new AppError(400, 'Invalid link ID');
  const days = parseStatsDays(req.query.days);
  const link = await Link.findOwnedById(req.user.id, req.params.id);
  if (!link) throw new AppError(404, 'Link not found');
  res.json(await Link.getDailyStats(req.user.id, req.params.id, days));
}));

linksRouter.get('/:shortCode', asyncHandler(async (req, res) => {
  if (!CODE_PATTERN.test(req.params.shortCode)) throw new AppError(400, 'Invalid short code');
  const link = await Link.findOwnedByCode(req.user.id, req.params.shortCode);
  if (!link) throw new AppError(404, 'Link not found');
  res.json({ link: outputLink(link) });
}));

linksRouter.delete('/:id', asyncHandler(async (req, res) => {
  if (!uuidPattern.test(req.params.id)) throw new AppError(400, 'Invalid link ID');
  if (!(await Link.remove(req.user.id, req.params.id))) throw new AppError(404, 'Link not found');
  res.json({ message: 'Link deleted' });
}));

// Optional update (CRUD): owner may change destination and/or expiry of a link.
linksRouter.patch('/:id', asyncHandler(async (req, res) => {
  if (!uuidPattern.test(req.params.id)) throw new AppError(400, 'Invalid link ID');
  const { originalUrl, expiresInDays } = req.body ?? {};
  if (originalUrl === undefined && expiresInDays === undefined) throw new AppError(400, 'Provide originalUrl and/or expiresInDays');
  const destination = originalUrl === undefined ? null : validateUrl(originalUrl);
  if (expiresInDays !== undefined && (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365)) {
    throw new AppError(400, 'expiresInDays must be between 1 and 365');
  }
  const link = await Link.update(req.user.id, req.params.id, destination, expiresInDays ?? null);
  if (!link) throw new AppError(404, 'Link not found');
  res.json({ link: outputLink(link) });
}));
