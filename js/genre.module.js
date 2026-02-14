import {
  SEP_EN,
  startOfDay,
  endOfDay,
  startOfWeek,
  getEventStartDate,
  getEventEndDate,
  eventOverlaps,
  expandAllRecurring,
  createSection,
  formatDate,
  formatTimeRange,
  getCategory,
  getLocationParts,
  getEventUrl,
  getEventStartTime,
  getEventEndTime,
  eventKey,
  toISODate,
} from './events-shared-utils.js';

const RANGE_DAYS = 42;

function fetchJsonWithFallback(primaryUrl, fallbackUrl) {
  return fetch(primaryUrl)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Primary fetch failed'))))
    .catch(() => fetch(fallbackUrl).then((r) => (r.ok ? r.json() : [])))
    .catch(() => []);
}

function normalizeGenreLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === raw.toLowerCase()) return raw.charAt(0).toUpperCase() + raw.slice(1);
  return raw;
}

function getGenre(ev) {
  const raw = ev && (ev.genre || ev.category || ev.eventType);
  return normalizeGenreLabel(raw);
}

function slugifyGenre(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDateTime(event) {
  const start = formatDate(event.startDate);
  if (!start) return '';
  const startTime = getEventStartTime(event);
  const endTime = getEventEndTime(event);
  if (event.endDate && !endTime) {
    const end = formatDate(event.endDate);
    return `${start}${SEP_EN}${end}`;
  }
  if (startTime && endTime) return `${start} ${formatTimeRange(startTime, endTime, SEP_EN)}`;
  if (startTime) return `${start} ${startTime}`;
  return start;
}

function buildEventBox(event, index) {
  const i = index + 1;
  const eventBox = document.createElement('div');
  eventBox.id = `genreEvent${i}`;
  eventBox.className = 'eventbox';

  const top = document.createElement('div');
  top.className = 'eventboxtop';
  const bottom = document.createElement('div');
  bottom.className = 'eventboxbottom';

  const link = document.createElement('a');
  const url = getEventUrl(event);
  if (url) {
    link.href = url;
    link.rel = 'noopener noreferrer';
    link.target = '_blank';
  }

  const nameDiv = document.createElement('div');
  nameDiv.className = 'name';
  nameDiv.textContent = event.name || 'Untitled event';
  link.appendChild(nameDiv);

  const dateDiv = document.createElement('div');
  dateDiv.className = 'date';
  dateDiv.textContent = formatDateTime(event);

  const locDiv = document.createElement('div');
  locDiv.className = 'location';
  locDiv.textContent = getLocationParts(event).join(', ');

  const catDiv = document.createElement('div');
  const category = getCategory(event);
  catDiv.className = 'category ' + category;
  catDiv.textContent = category;

  top.appendChild(link);
  top.appendChild(dateDiv);
  top.appendChild(locDiv);
  bottom.appendChild(catDiv);
  eventBox.appendChild(top);
  eventBox.appendChild(bottom);
  return eventBox;
}

function buildGenreList(container, genreCounts) {
  container.innerHTML = '';
  const list = createSection(container, 'Genres', 'section-genres');
  const sorted = Array.from(genreCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sorted.forEach(([label, count]) => {
    const row = document.createElement('div');
    row.className = 'eventbox';
    const top = document.createElement('div');
    top.className = 'eventboxtop';
    const link = document.createElement('a');
    link.href = `./?genre=${encodeURIComponent(slugifyGenre(label))}`;
    const title = document.createElement('div');
    title.className = 'name';
    title.textContent = `${label} (${count})`;
    link.appendChild(title);
    top.appendChild(link);
    row.appendChild(top);
    list.appendChild(row);
  });
}

function buildGenreEvents(container, genreLabel, events) {
  container.innerHTML = '';
  const list = createSection(container, `${genreLabel} (Today + 6 Weeks)`, 'section-genre-events');
  if (!events.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No events found in this window.';
    list.appendChild(empty);
    return;
  }

  let counter = 0;
  const seen = new Set();
  events.forEach((ev) => {
    const key = eventKey(ev);
    if (seen.has(key)) return;
    seen.add(key);
    list.appendChild(buildEventBox(ev, counter++));
  });
}

const now = new Date();
const todayStart = startOfDay(now);
const rangeEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + RANGE_DAYS));
const fromParam = toISODate(todayStart);
const toParam = toISODate(rangeEnd);
const recurringStart = startOfWeek(todayStart);

Promise.all([
  fetchJsonWithFallback(
    `../api/output.php?from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}`,
    '../output.json',
  ),
  fetchJsonWithFallback(
    '../api/directory.php?limit=2000',
    '../directory.json',
  ),
]).then(([oneOffData, directoryData]) => {
  const singlesRaw = (oneOffData || []).filter((e) => e && e.startDate).map((e) => ({ ...e }));
  const recurringRaw = expandAllRecurring(directoryData || [], recurringStart, rangeEnd);
  const allWindowEvents = [...singlesRaw, ...recurringRaw]
    .filter((ev) => eventOverlaps(ev, todayStart, rangeEnd))
    .filter((ev) => {
      const end = getEventEndDate(ev);
      return !end || end >= todayStart;
    })
    .sort((a, b) => (getEventStartDate(a) || new Date(8640000000000000)) - (getEventStartDate(b) || new Date(8640000000000000)));

  const genreCounts = new Map();
  allWindowEvents.forEach((ev) => {
    const genre = getGenre(ev);
    if (!genre) return;
    genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
  });

  const slugToGenre = new Map();
  Array.from(genreCounts.keys()).forEach((label) => slugToGenre.set(slugifyGenre(label), label));

  const params = new URLSearchParams(window.location.search);
  const requestedSlug = String(params.get('genre') || '').trim().toLowerCase();
  const target = document.getElementById('genrelist');
  if (!target) return;

  if (!requestedSlug) {
    buildGenreList(target, genreCounts);
    return;
  }

  const genreLabel = slugToGenre.get(requestedSlug);
  if (!genreLabel) {
    target.innerHTML = '';
    const list = createSection(target, 'Genre Not Found', 'section-genre-not-found');
    const msg = document.createElement('p');
    msg.textContent = 'The requested genre is not available in the current 6-week window.';
    list.appendChild(msg);
    return;
  }

  const matching = allWindowEvents.filter((ev) => getGenre(ev).toLowerCase() === genreLabel.toLowerCase());
  buildGenreEvents(target, genreLabel, matching);
}).catch((err) => console.error('Error loading genre data:', err));
