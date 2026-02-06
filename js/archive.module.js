// archive.module.no-recurring.js (ESM)
// Archive page WITHOUT recurring events
// - Reads one-off events from output.json only
// - Groups past events by "Month Year" with counts
// - Uses en-dash with non-breaking spaces for date/time ranges
//
// HTML wiring (archive.html):
// <meta charset="utf-8" />
// <div id="archivelist"></div>
// <script type="module" src="/js/archive.module.no-recurring.js"></script>

import {
  SEP_EN,
  // dates & formatting
  parseISODateLocal, startOfDay,
  formatDate, formatTimeRange,
  // event helper
  getEventEndDate,
  // small DOM helper
  createSection
} from './events-shared-utils.js';

function formatDateTime(ev) {
  const start = formatDate(ev.startDate);
  if (!start) return '';
  if (ev.endDate && !ev.endTime) {
    const end = formatDate(ev.endDate);
    return `${start}${SEP_EN}${end}`; // e.g., "Mon 1 Sep – Thu 4 Sep"
  }
  if (ev.startTime && ev.endTime) {
    return `${start} ${formatTimeRange(ev.startTime, ev.endTime, SEP_EN)}`; // e.g., "Mon 1 Sep 19:00 – 21:00"
  }
  if (ev.startTime && !ev.endTime) {
    return `${start} ${ev.startTime}`;
  }
  return start;
}

function monthKeyTitleFromISO(iso) {
  const d = parseISODateLocal(iso);
  if (!d) return null;
  const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const title = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return { key, title, date: d };
}

function buildEventBox(ev, idx) {
  const i = idx + 1;
  const eventBox = document.createElement('div');
  eventBox.id = `archiveEvent${i}`;
  eventBox.className = 'eventbox';

  const top = document.createElement('div');
  top.className = 'eventboxtop';

  const bottom = document.createElement('div');
  bottom.className = 'eventboxbottom';

  const dateDiv = document.createElement('div');
  dateDiv.className = 'date';
  dateDiv.textContent = formatDateTime(ev);

  const link = document.createElement('a');
  if (ev.url) { link.href = ev.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  const nameDiv = document.createElement('div');
  nameDiv.className = 'name';
  nameDiv.textContent = ev.name || 'Untitled event';
  link.appendChild(nameDiv);

  const locDiv = document.createElement('div');
  locDiv.className = 'location';
  const parts = [ev.locName, ev.locStreet, ev.locTown, ev.locPost].filter(Boolean);
  locDiv.textContent = parts.join(', ');

  top.appendChild(link);
  top.appendChild(dateDiv);
  top.appendChild(locDiv);

  const catDiv = document.createElement('div');
  catDiv.className = 'category ' + (ev.category || '');
  catDiv.textContent = ev.category || '';
  bottom.appendChild(catDiv);

  eventBox.appendChild(top);
  eventBox.appendChild(bottom);
  return eventBox;
}

function ensureMonthSection(container, title, id) {
  return createSection(container, title, id);
}

fetch('../output.json')
  .then(r => r.ok ? r.json() : [])
  .then(oneOff => {
    const container = document.getElementById('archivelist');
    if (!container) return;

    const todayStart = startOfDay(new Date());

    // Only include one-off events that ended before today
    const pastSingles = (oneOff || [])
      .filter(e => e && e.startDate)
      .filter(ev => {
        const end = getEventEndDate(ev);
        return !!end && end < todayStart;
      });

    // Group by month-year of startDate
    const groups = new Map();
    for (const ev of pastSingles) {
      const mt = monthKeyTitleFromISO(ev.startDate);
      if (!mt) continue;
      if (!groups.has(mt.key)) groups.set(mt.key, { title: mt.title, items: [] });
      groups.get(mt.key).items.push(ev);
    }

    const monthEntries = Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0])); // YYYY-MM desc

    let counter = 0;
    for (const [key, { title, items }] of monthEntries) {
      // Sort items within the month (most recent first)
      items.sort((a, b) => parseISODateLocal(b.startDate) - parseISODateLocal(a.startDate) || String(a.name||'').localeCompare(String(b.name||'')));

      const listEl = ensureMonthSection(container, title, `archive-${key}`);
      // add count to title
      const section = listEl.parentElement;
      if (section) {
        const h2 = section.querySelector('h2.event-section-title');
        if (h2) h2.textContent = `${title} (${items.length})`;
      }

      const frag = document.createDocumentFragment();
      items.forEach(ev => { frag.appendChild(buildEventBox(ev, counter++)); });
      listEl.appendChild(frag);
    }
  })
  .catch(err => console.error('Error building archive page:', err));