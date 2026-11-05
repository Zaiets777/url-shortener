export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export function notFound(req, _res, next) {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(error, _req, res, _next) {
  const status = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 600
    ? error.statusCode
    : error.status === 400 || error.type === 'entity.parse.failed' ? 400 : 500;
  if (status >= 500) console.error('API error:', error);
  res.status(status).json({
    message: status === 500 ? 'Internal server error' : error.message,
    ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { detail: error.message } : {})
  });
}
