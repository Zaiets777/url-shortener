// OpenAPI 3.0 document, served at /api/v1/openapi.json and rendered at /api/docs.
const errorResponse = { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
const json = (schema) => ({ content: { 'application/json': { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const protectedRoute = [{ cookieAuth: [] }];
export const openapi = {
  openapi: '3.0.3',
  info: { title: 'URL Shortener API', version: '1.0.0', description: 'REST API for links, click analytics and cookie-based sessions.' },
  servers: [{ url: '/', description: 'Current API origin' }],
  tags: [{ name: 'Health' }, { name: 'Auth' }, { name: 'Links' }, { name: 'Redirect' }],
  components: {
    securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'url_shortener_session', description: 'httpOnly JWT cookie; log in through the browser. Swagger UI cannot manually set a Cookie header.' } },
    schemas: {
      Error: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      User: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, username: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } },
      Link: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, userId: { type: 'string', format: 'uuid' }, shortCode: { type: 'string' }, shortUrl: { type: 'string', format: 'uri' }, originalUrl: { type: 'string', format: 'uri' }, clicks: { type: 'integer' }, createdAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' }, status: { type: 'string', enum: ['active','expired'] } } },
      DailyStats: { type: 'array', items: { type: 'object', required: ['date','clicks'], properties: { date: { type: 'string', format: 'date' }, clicks: { type: 'integer' } } } },
      Credentials: { type: 'object', required: ['username','password'], properties: { username: { type: 'string', example: 'demo_user' }, password: { type: 'string', format: 'password', example: 'ExamplePass123' } } },
      CreateLink: { type: 'object', required: ['originalUrl'], properties: { originalUrl: { type: 'string', format: 'uri', example: 'https://example.com/' }, expiresInDays: { type: 'integer', minimum: 1, maximum: 365, default: 7 }, customAlias: { type: 'string', minLength: 3, maxLength: 32, pattern: '^[A-Za-z0-9_-]+$' } } }
    }
  },
  paths: {
    '/api/v1/health': { get: { tags: ['Health'], summary: 'Server health', responses: { 200: { description: 'Server online', ...json({ type: 'object', properties: { status: { type: 'string' }, service: { type: 'string' } } }) } } } },
    '/api/v1/health/db': { get: { tags: ['Health'], summary: 'Database health', responses: { 200: { description: 'Database connected' }, 503: errorResponse } } },
    '/api/v1/auth/register': { post: { tags: ['Auth'], summary: 'Create account (does not log in)', requestBody: { required: true, ...json(ref('Credentials')) }, responses: { 201: { description: 'Account created', ...json({ type: 'object', properties: { user: ref('User'), message: { type: 'string' } } }) }, 400: errorResponse, 409: errorResponse } } },
    '/api/v1/auth/login': { post: { tags: ['Auth'], summary: 'Log in; server sets httpOnly JWT cookie (no token in JSON)', requestBody: { required: true, ...json(ref('Credentials')) }, responses: { 200: { description: 'Session established', headers: { 'Set-Cookie': { description: 'url_shortener_session httpOnly cookie', schema: { type: 'string' } } }, ...json({ type: 'object', properties: { user: ref('User') } }) }, 401: errorResponse } } },
    '/api/v1/auth/me': { get: { tags: ['Auth'], security: protectedRoute, summary: 'Current authenticated user', responses: { 200: { description: 'Authenticated user', ...json({ type: 'object', properties: { user: ref('User') } }) }, 401: errorResponse } } },
    '/api/v1/auth/logout': { post: { tags: ['Auth'], summary: 'Clear session cookie', responses: { 200: { description: 'Logged out' } } } },
    '/api/v1/links': {
      get: { tags: ['Links'], security: protectedRoute, summary: 'List owned links', parameters: [{ in: 'query', name: 'active', schema: { type: 'boolean' } }], responses: { 200: { description: 'Link list', ...json({ type: 'object', properties: { links: { type: 'array', items: ref('Link') } } }) }, 401: errorResponse } },
      post: { tags: ['Links'], security: protectedRoute, summary: 'Create short link (optional customAlias)', requestBody: { required: true, ...json(ref('CreateLink')) }, responses: { 201: { description: 'Created', ...json({ type: 'object', properties: { link: ref('Link') } }) }, 400: errorResponse, 401: errorResponse, 409: errorResponse } }
    },
    '/api/v1/links/{id}': {
      get: { tags: ['Links'], security: protectedRoute, summary: 'Get own link by shortCode (id parameter is the shortCode for GET)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Link', ...json({ type: 'object', properties: { link: ref('Link') } }) }, 404: errorResponse } },
      patch: { tags: ['Links'], security: protectedRoute, summary: 'Update destination/expiry of owned link', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, ...json({ type: 'object', properties: { originalUrl: { type: 'string', format: 'uri' }, expiresInDays: { type: 'integer', minimum: 1, maximum: 365 } } }) }, responses: { 200: { description: 'Updated', ...json({ type: 'object', properties: { link: ref('Link') } }) }, 404: errorResponse } },
      delete: { tags: ['Links'], security: protectedRoute, summary: 'Delete owned link', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Deleted' }, 404: errorResponse } }
    },
    '/api/v1/links/{id}/stats': { get: { tags: ['Links'], security: protectedRoute, summary: 'Daily clicks for last 7 or 30 days (id can be UUID or shortCode)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }, { in: 'query', name: 'days', schema: { type: 'integer', enum: [7,30], default: 7 } }], responses: { 200: { description: 'Daily UTC series', ...json(ref('DailyStats')) }, 404: errorResponse } } },
    '/{shortCode}': { get: { tags: ['Redirect'], summary: 'Public redirect; counts one click per GET', parameters: [{ in: 'path', name: 'shortCode', required: true, schema: { type: 'string' } }], responses: { 302: { description: 'Redirect to destination', headers: { Location: { schema: { type: 'string', format: 'uri' } } } }, 404: errorResponse } } }
  }
};

// Self-host the API specification; load the interactive UI assets from a public CDN.
// The spec remains available at /api/v1/openapi.json even without CDN access.
export function swaggerHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>URL Shortener API · Swagger UI</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.onload=()=>SwaggerUIBundle({url:'/api/v1/openapi.json',dom_id:'#swagger-ui',deepLinking:true,persistAuthorization:false});</script></body></html>`;
}
