// Pure helpers shared by the browser and the tests.

// Every YYYY-MM-DD from start to end inclusive.
export function dateRange(start, end, max = 31) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${(end || start)}T00:00:00Z`);
  while (d <= last && out.length < max) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Is the show's local start time inside [from, to]? Handles windows that
// cross midnight, e.g. 21:00 to 01:00. Empty bounds mean "no limit".
export function inWindow(localDateTime, from, to) {
  if (!from && !to) return true;
  const t = toMinutes(localDateTime.slice(11, 16));
  const a = from ? toMinutes(from) : 0;
  const b = to ? toMinutes(to) : 24 * 60 - 1;
  return a <= b ? t >= a && t <= b : t >= a || t <= b;
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// AMC sometimes lists special formats as separate "movies"
// (e.g. "Starfall: The IMAX Experience"), so match by id or by name prefix.
export function matchesMovie(show, movie) {
  if (show.movieId === movie.id) return true;
  const base = norm(movie.name);
  return base.length > 0 && norm(show.movieName).startsWith(base);
}

export function filterShowtimes(shows, { movie, from, to }) {
  return shows
    .filter((s) => matchesMovie(s, movie) && inWindow(s.local, from, to))
    .sort((x, y) => x.local.localeCompare(y.local));
}

// Groups sorted showtimes as [{ date, theatres: [{ theatreId, shows }] }].
export function groupByDateAndTheatre(shows, theatreOrder = []) {
  const byDate = new Map();
  for (const s of shows) {
    const date = s.businessDate || s.local.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, new Map());
    const byTheatre = byDate.get(date);
    if (!byTheatre.has(s.theatreId)) byTheatre.set(s.theatreId, []);
    byTheatre.get(s.theatreId).push(s);
  }
  const rank = (id) => {
    const i = theatreOrder.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  return [...byDate.keys()].sort().map((date) => ({
    date,
    theatres: [...byDate.get(date).entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([theatreId, shows]) => ({ theatreId, shows })),
  }));
}

// Runs async tasks with at most `limit` in flight.
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
