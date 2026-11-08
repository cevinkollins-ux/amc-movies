import { handler, badRequest } from '../lib/http.js';
import { listShowtimes } from '../lib/amc.js';

// Showtimes for one theatre on one date: /api/showtimes?theatre=123&date=2026-11-08
// The browser fans out over theatres x dates and filters the results.
export default handler(({ theatre, date }) => {
  if (!/^\d+$/.test(theatre ?? '')) throw badRequest('theatre must be a numeric id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw badRequest('date must be YYYY-MM-DD');
  return listShowtimes(theatre, date);
}, 10 * 60);
