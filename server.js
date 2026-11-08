// Local dev server: serves public/ and routes /api/<name> to api/<name>.js,
// the same layout Vercel uses in production.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

// Load .env without a dependency.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const routes = {
  theatres: (await import('./api/theatres.js')).default,
  movies: (await import('./api/movies.js')).default,
  showtimes: (await import('./api/showtimes.js')).default,
};

const port = Number(process.env.PORT) || 3000;
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const api = path.match(/^\/api\/(\w+)$/);
  if (api && routes[api[1]]) return routes[api[1]](req, res);

  const file = normalize(join('public', path === '/' ? 'index.html' : path));
  if (!file.startsWith('public')) return res.writeHead(404).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => {
  const mode = process.env.AMC_MOCK === '1' ? ' (mock data)' : '';
  console.log(`amc-movies running at http://localhost:${port}${mode}`);
});
