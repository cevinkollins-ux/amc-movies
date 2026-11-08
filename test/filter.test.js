import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateRange, inWindow, matchesMovie, filterShowtimes, groupByDateAndTheatre, pool } from '../public/filter.js';
import { amcDate } from '../lib/amc.js';

test('dateRange is inclusive, crosses months, and caps length', () => {
  assert.deepEqual(dateRange('2026-11-29', '2026-12-02'), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  assert.deepEqual(dateRange('2026-11-08', ''), ['2026-11-08']);
  assert.equal(dateRange('2026-01-01', '2026-12-31', 14).length, 14);
});

test('inWindow handles normal, open-ended and past-midnight windows', () => {
  assert.equal(inWindow('2026-11-08T19:30:00', '17:00', '21:00'), true);
  assert.equal(inWindow('2026-11-08T21:01:00', '17:00', '21:00'), false);
  assert.equal(inWindow('2026-11-08T10:00:00', '', ''), true);
  assert.equal(inWindow('2026-11-08T10:00:00', '12:00', ''), false);
  assert.equal(inWindow('2026-11-09T00:15:00', '21:00', '02:00'), true);
  assert.equal(inWindow('2026-11-08T15:00:00', '21:00', '02:00'), false);
});

test('matchesMovie catches format-specific listings by name', () => {
  const movie = { id: 1, name: 'Starfall' };
  assert.equal(matchesMovie({ movieId: 1, movieName: 'Starfall' }, movie), true);
  assert.equal(matchesMovie({ movieId: 2, movieName: 'Starfall: The IMAX Experience' }, movie), true);
  assert.equal(matchesMovie({ movieId: 3, movieName: 'The Quiet Harbor' }, movie), false);
});

test('filterShowtimes filters and sorts; grouping follows theatre order', () => {
  const shows = [
    { movieId: 1, movieName: 'Starfall', theatreId: 2, local: '2026-11-09T19:00:00', businessDate: '2026-11-09' },
    { movieId: 1, movieName: 'Starfall', theatreId: 1, local: '2026-11-08T20:00:00', businessDate: '2026-11-08' },
    { movieId: 1, movieName: 'Starfall', theatreId: 1, local: '2026-11-08T13:00:00', businessDate: '2026-11-08' },
    { movieId: 9, movieName: 'Other', theatreId: 1, local: '2026-11-08T18:00:00', businessDate: '2026-11-08' },
    { movieId: 1, movieName: 'Starfall', theatreId: 2, local: '2026-11-08T18:00:00', businessDate: '2026-11-08' },
  ];
  const kept = filterShowtimes(shows, { movie: { id: 1, name: 'Starfall' }, from: '17:00', to: '21:00' });
  assert.deepEqual(kept.map((s) => s.local.slice(11, 16)), ['18:00', '20:00', '19:00']);
  const groups = groupByDateAndTheatre(kept, [2, 1]);
  assert.deepEqual(groups.map((g) => [g.date, g.theatres.map((t) => t.theatreId)]), [
    ['2026-11-08', [2, 1]],
    ['2026-11-09', [2]],
  ]);
});

test('a show after midnight stays under the date it was listed for', () => {
  const groups = groupByDateAndTheatre([
    { theatreId: 1, local: '2026-11-09T00:15:00', businessDate: '2026-11-08' },
  ]);
  assert.equal(groups[0].date, '2026-11-08');
});

test('pool keeps order and respects the limit', async () => {
  let active = 0, peak = 0;
  const out = await pool([1, 2, 3, 4, 5, 6], 2, async (n) => {
    peak = Math.max(peak, ++active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60]);
  assert.equal(peak, 2);
});

test('amcDate formats as M-D-YY', () => {
  assert.equal(amcDate('2026-11-08'), '11-8-26');
  assert.equal(amcDate('2027-01-15'), '1-15-27');
});
