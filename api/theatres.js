import { handler } from '../lib/http.js';
import { listTheatres } from '../lib/amc.js';

let cache = null;
const DAY = 24 * 60 * 60 * 1000;

// All AMC theatres (slim fields). The browser filters them by name/city/zip.
export default handler(async () => {
  if (!cache || Date.now() - cache.at > DAY) cache = { at: Date.now(), data: await listTheatres() };
  return cache.data;
}, 6 * 60 * 60);
