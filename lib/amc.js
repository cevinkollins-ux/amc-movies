// Thin client for the AMC Theatres API (https://developers.amctheatres.com).
// Every call AMC needs goes through here, so if their response shapes differ
// from what's assumed below, this is the only file to adjust.

import { mockTheatres, mockMovies, mockShowtimes } from './mock.js';

const BASE = 'https://api.amctheatres.com';
const PAGE_SIZE = 100;

const useMock = () => process.env.AMC_MOCK === '1';

export class AmcError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function get(path, params = {}) {
  const key = process.env.AMC_VENDOR_KEY;
  if (!key) throw new AmcError('AMC_VENDOR_KEY is not set on the server', 500);

  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { 'X-AMC-Vendor-Key': key, Accept: 'application/json' },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.errors?.[0]?.message || body?.message || '';
    } catch {}
    const hint =
      res.status === 401 || res.status === 403
        ? ' (key rejected; new keys go live on Thursdays)'
        : '';
    throw new AmcError(`AMC API ${res.status}${detail ? `: ${detail}` : ''}${hint}`, 502);
  }
  return res.json();
}

// Fetches every page of a HAL-style list and returns the embedded items.
async function getAll(path, embeddedKey, params = {}) {
  const items = [];
  for (let page = 1; page <= 50; page++) {
    const body = await get(path, { ...params, 'page-size': PAGE_SIZE, 'page-number': page });
    const batch = body?._embedded?.[embeddedKey] ?? [];
    items.push(...batch);
    const total = body?.count ?? items.length;
    if (batch.length < PAGE_SIZE || items.length >= total) break;
  }
  return items;
}

// AMC paths take dates as M-D-YY, e.g. 2026-11-08 -> 11-8-26.
export function amcDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}-${d}-${String(y).slice(-2)}`;
}

export async function listTheatres() {
  const raw = useMock() ? mockTheatres() : await getAll('/v2/theatres', 'theatres');
  return raw.map((t) => ({
    id: t.id,
    name: t.longName || t.name,
    city: t.location?.city ?? '',
    state: t.location?.state ?? '',
    zip: t.location?.postalCode ?? '',
  }));
}

export async function listMovies() {
  let raw;
  if (useMock()) {
    raw = mockMovies();
  } else {
    const [now, advance] = await Promise.all([
      getAll('/v2/movies/views/now-playing', 'movies'),
      getAll('/v2/movies/views/advance', 'movies').catch(() => []),
    ]);
    raw = [...now, ...advance];
  }
  const seen = new Set();
  return raw
    .filter((m) => !seen.has(m.id) && seen.add(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      rating: m.mpaaRating ?? '',
      runTime: m.runTime ?? null,
      releaseDate: m.releaseDateUtc ?? null,
      poster: m.media?.posterDynamic || m.media?.posterStandard || m.media?.posterThumbnail || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listShowtimes(theatreId, isoDate) {
  const raw = useMock()
    ? mockShowtimes(theatreId, isoDate)
    : await getAll(`/v2/theatres/${encodeURIComponent(theatreId)}/showtimes/${amcDate(isoDate)}`, 'showtimes');
  return raw.map((s) => ({
    id: s.id,
    movieId: s.movieId,
    movieName: s.movieName ?? '',
    theatreId: s.theatreId ?? Number(theatreId),
    local: s.showDateTimeLocal, // "2026-11-08T19:30:00", theatre's local clock
    businessDate: isoDate,
    soldOut: !!s.isSoldOut,
    almostSoldOut: !!s.isAlmostSoldOut,
    format: s.premiumFormat || '',
    attributes: (s.attributes ?? []).map((a) => a.name || a.code).filter(Boolean),
    url: s.purchaseUrl || s.mobilePurchaseUrl || null,
  }));
}
