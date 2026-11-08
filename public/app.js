import { dateRange, filterShowtimes, groupByDateAndTheatre, pool } from './filter.js';

const $ = (id) => document.getElementById(id);
const MAX_THEATRES = 10;
const MAX_DAYS = 14;

// ---------- remembered settings (best effort; the app works without storage) ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

const state = {
  movies: [],
  theatres: [],
  movie: null,
  picked: store.get('theatres', []), // [{ id, name, city, state }]
};

// ---------- API ----------
async function api(path) {
  const headers = {};
  const pw = store.get('password', '');
  if (pw) headers['X-App-Password'] = pw;
  const res = await fetch(path, { headers });
  if (res.status === 401) {
    await askPassword();
    return api(path);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

let pwPromise = null;
function askPassword() {
  pwPromise ??= new Promise((resolve) => {
    const dlg = $('pw-dialog');
    dlg.onclose = () => {
      store.set('password', $('pw-input').value);
      pwPromise = null;
      resolve();
    };
    dlg.showModal();
  });
  return pwPromise;
}

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isoToday = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const fmtTime = (local) => {
  const [h, m] = local.slice(11, 16).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
function setStatus(text, isError = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', isError);
}

// ---------- movie picker ----------
function renderMovies() {
  const q = $('movie-q').value.trim().toLowerCase();
  const list = state.movies.filter((m) => !q || m.name.toLowerCase().includes(q)).slice(0, 50);
  $('movie-list').innerHTML = list
    .map((m) => `<li tabindex="0" data-id="${m.id}"><span>${esc(m.name)}</span><span class="meta">${esc(m.rating)}</span></li>`)
    .join('');
  const picked = $('movie-picked');
  picked.hidden = !state.movie;
  if (state.movie) picked.innerHTML = `<span>${esc(state.movie.name)}</span><button type="button" aria-label="Change movie">✕</button>`;
  $('movie-q').hidden = $('movie-list').hidden = !!state.movie;
}
$('movie-q').addEventListener('input', renderMovies);
$('movie-list').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  state.movie = state.movies.find((m) => String(m.id) === li.dataset.id);
  store.set('movie', state.movie);
  renderMovies();
});
$('movie-picked').addEventListener('click', (e) => {
  if (!e.target.closest('button')) return;
  state.movie = null;
  renderMovies();
  $('movie-q').focus();
});

// ---------- theatre picker ----------
function renderTheatres() {
  const q = $('theatre-q').value.trim().toLowerCase();
  const pickedIds = new Set(state.picked.map((t) => t.id));
  const list = q
    ? state.theatres
        .filter((t) => `${t.name} ${t.city} ${t.state} ${t.zip}`.toLowerCase().includes(q))
        .slice(0, 40)
    : [];
  $('theatre-list').innerHTML = list
    .map(
      (t) => `<li tabindex="0" data-id="${t.id}" class="${pickedIds.has(t.id) ? 'on' : ''}">
        <span>${esc(t.name)}</span><span class="meta">${esc(t.city)}${t.state ? ', ' + esc(t.state) : ''}</span></li>`
    )
    .join('');
  $('theatre-chips').innerHTML = state.picked
    .map((t) => `<span class="chip">${esc(t.name.replace(/^AMC\s+/i, ''))}<button type="button" data-id="${t.id}" aria-label="Remove">✕</button></span>`)
    .join('');
}
$('theatre-q').addEventListener('input', renderTheatres);
$('theatre-list').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const t = state.theatres.find((x) => String(x.id) === li.dataset.id);
  const i = state.picked.findIndex((x) => x.id === t.id);
  if (i >= 0) state.picked.splice(i, 1);
  else if (state.picked.length >= MAX_THEATRES) return setStatus(`Up to ${MAX_THEATRES} theatres at a time.`, true);
  else state.picked.push(t);
  store.set('theatres', state.picked);
  renderTheatres();
});
$('theatre-chips').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.picked = state.picked.filter((t) => String(t.id) !== btn.dataset.id);
  store.set('theatres', state.picked);
  renderTheatres();
});

// Enter/space on focused list items acts like a tap.
for (const id of ['movie-list', 'theatre-list']) {
  $(id).addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li')) {
      e.preventDefault();
      e.target.click();
    }
  });
}

// ---------- dates and times ----------
$('date-presets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.days !== undefined) {
    $('date-from').value = $('date-to').value = isoToday(Number(b.dataset.days));
  } else if (b.dataset.range) {
    $('date-from').value = isoToday(0);
    $('date-to').value = isoToday(Number(b.dataset.range) - 1);
  } else if (b.dataset.weekend !== undefined) {
    const dow = new Date().getDay(); // 0 Sun … 6 Sat
    const toFri = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
    const start = Math.max(0, toFri);
    $('date-from').value = isoToday(start);
    $('date-to').value = isoToday(toFri + 2);
  }
});
$('time-presets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $('time-from').value = b.dataset.from;
  $('time-to').value = b.dataset.to;
});

// ---------- search ----------
async function search() {
  if (!state.movie) return setStatus('Pick a movie first.', true);
  if (!state.picked.length) return setStatus('Pick at least one theatre.', true);
  const from = $('date-from').value || isoToday();
  const to = $('date-to').value || from;
  if (to < from) return setStatus('"To" date is before "From" date.', true);
  const dates = dateRange(from, to, MAX_DAYS);
  const timeFrom = $('time-from').value;
  const timeTo = $('time-to').value;
  store.set('times', { timeFrom, timeTo });

  const jobs = state.picked.flatMap((t) => dates.map((date) => ({ t, date })));
  const bar = $('progress');
  bar.hidden = false;
  bar.firstElementChild.style.width = '0';
  $('search').disabled = true;
  $('results').innerHTML = '';
  setStatus(`Checking ${jobs.length} theatre-days…`);

  let done = 0;
  const problems = [];
  const chunks = await pool(jobs, 4, async ({ t, date }) => {
    try {
      return await api(`/api/showtimes?theatre=${t.id}&date=${date}`);
    } catch (err) {
      problems.push(`${t.name} on ${date}: ${err.message}`);
      return [];
    } finally {
      bar.firstElementChild.style.width = `${(++done / jobs.length) * 100}%`;
    }
  });

  const shows = filterShowtimes(chunks.flat(), { movie: state.movie, from: timeFrom, to: timeTo });
  renderResults(shows, problems, dates.length < dateRange(from, to, 999).length);
  $('search').disabled = false;
  bar.hidden = true;
}
$('search').addEventListener('click', search);

function renderResults(shows, problems, truncated) {
  const names = new Map(state.picked.map((t) => [t.id, t.name]));
  const groups = groupByDateAndTheatre(shows, state.picked.map((t) => t.id));
  const avail = shows.filter((s) => !s.soldOut).length;
  setStatus(
    shows.length
      ? `${avail} showtime${avail === 1 ? '' : 's'} available${truncated ? ` (first ${MAX_DAYS} days only)` : ''}.`
      : problems.length ? 'Nothing loaded — see errors below.' : '',
    !shows.length && problems.length > 0
  );

  let html = groups
    .map(
      (g) => `<div class="day"><h3>${fmtDate(g.date)}</h3>${g.theatres
        .map(
          (th) => `<div class="card theatre"><h4>${esc(names.get(th.theatreId) || `Theatre ${th.theatreId}`)}</h4><div class="times">${th.shows
            .map((s) => {
              // Format label, e.g. "IMAX", or the suffix of a format-specific listing.
              const suffix = s.movieName.slice(state.movie.name.length).replace(/^[:\s-]+/, '');
              const tag = s.format || (s.movieName !== state.movie.name ? suffix : '');
              const cls = s.soldOut ? 'sold' : s.almostSoldOut ? 'few' : '';
              const note = s.soldOut ? '<small>Sold out</small>' : s.almostSoldOut ? '<small class="left">Almost full</small>' : '';
              const inner = `<strong>${fmtTime(s.local)}</strong>${tag ? `<small>${esc(tag)}</small>` : ''}${note}`;
              return s.url && !s.soldOut
                ? `<a class="time ${cls}" href="${esc(s.url)}" target="_blank" rel="noopener">${inner}</a>`
                : `<span class="time ${cls}">${inner}</span>`;
            })
            .join('')}</div></div>`
        )
        .join('')}</div>`
    )
    .join('');
  if (!groups.length && !problems.length) html = '<p class="empty">No showtimes match. Try widening the dates or hours.</p>';
  if (problems.length) {
    html += `<details class="problems"><summary>${problems.length} request${problems.length === 1 ? '' : 's'} failed</summary><ul>${problems
      .map((p) => `<li>${esc(p)}</li>`)
      .join('')}</ul></details>`;
  }
  $('results').innerHTML = html;
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- start ----------
async function init() {
  const times = store.get('times', { timeFrom: '', timeTo: '' });
  $('time-from').value = times.timeFrom;
  $('time-to').value = times.timeTo;
  $('date-from').value = isoToday(0);
  $('date-to').value = isoToday(6);
  renderTheatres();

  setStatus('Loading movies and theatres…');
  try {
    [state.movies, state.theatres] = await Promise.all([api('/api/movies'), api('/api/theatres')]);
    const saved = store.get('movie', null);
    state.movie = saved && state.movies.find((m) => m.id === saved.id) || null;
    setStatus('');
  } catch (err) {
    setStatus(err.message, true);
  }
  renderMovies();
  renderTheatres();
}
init();
