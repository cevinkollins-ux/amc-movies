// Shared plumbing for the /api handlers (works on Vercel and the local server).

import { timingSafeEqual } from 'node:crypto';

function passwordOk(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;
  const given = String(req.headers['x-app-password'] ?? '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function send(res, status, body, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Cached per password header so a wrong password can't read a cached answer.
  res.setHeader('Vary', 'X-App-Password');
  res.setHeader(
    'Cache-Control',
    cacheSeconds ? `private, max-age=${cacheSeconds}` : 'no-store'
  );
  res.end(JSON.stringify(body));
}

// Wraps a handler: checks the password, parses the query, maps errors to JSON.
export function handler(fn, cacheSeconds = 0) {
  return async (req, res) => {
    if (!passwordOk(req)) return send(res, 401, { error: 'Wrong or missing password' });
    try {
      const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      send(res, 200, await fn(query), cacheSeconds);
    } catch (err) {
      // 400 = our own validation, 500 = server misconfigured; anything from AMC is 502
      // so the browser never mistakes an AMC 401 for a wrong app password.
      const status = err.status === 400 || err.status === 500 ? err.status : 502;
      send(res, status, { error: err.message || 'Request failed' });
    }
  };
}

export function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}
