import { fetchJsonWithFallback } from './fetch-json.module.js';

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePride(raw) {
  const name = String(raw?.name || raw?.title || '').trim();
  const websiteUrl = String(raw?.websiteUrl || raw?.website || raw?.url || '').trim();
  const location = String(raw?.location || raw?.locationName || raw?.town || '').trim();
  const borough = String(raw?.borough || raw?.area || '').trim();
  const startDate = raw?.startDate || raw?.start_date || null;
  const endDate = raw?.endDate || raw?.end_date || startDate || null;
  const eventCountRaw = Number(raw?.eventCount ?? raw?.event_count ?? raw?.linkedEventCount ?? 0);
  const eventCount = Number.isFinite(eventCountRaw) ? Math.max(0, Math.floor(eventCountRaw)) : 0;

  if (!name) return null;
  return {
    name,
    websiteUrl,
    location,
    borough,
    startDate,
    endDate,
    eventCount,
  };
}

function getStatus(pride, now) {
  const start = parseDate(pride.startDate);
  const end = parseDate(pride.endDate);
  if (!start || !end) return 'TBC';

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  if (start > dayEnd) return 'Upcoming';
  if (end < dayStart) return 'Finished';
  return 'Live';
}

function formatDateRange(pride) {
  const start = parseDate(pride.startDate);
  const end = parseDate(pride.endDate);
  if (!start || !end) return 'Dates TBC';
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start.toDateString() === end.toDateString()) return fmt.format(start);
  return `${fmt.format(start)} to ${fmt.format(end)}`;
}

function monthKey(pride) {
  const start = parseDate(pride.startDate);
  if (!start) return 'tbc';
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  if (key === 'tbc') return 'Date TBC';
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function buildSummary(prides, now) {
  const statuses = prides.map((p) => getStatus(p, now));
  const boroughs = new Set(prides.map((p) => p.borough).filter(Boolean));
  return [
    { label: 'Upcoming', value: statuses.filter((s) => s === 'Upcoming').length },
    { label: 'Live now', value: statuses.filter((s) => s === 'Live').length },
    { label: 'Total', value: prides.length },
    { label: 'Boroughs', value: boroughs.size },
  ];
}

function setupFilters(prides, onChange) {
  const host = document.getElementById('prides-filter-bar');
  if (!host) return;
  host.innerHTML = '';

  const boroughs = Array.from(new Set(prides.map((p) => p.borough).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const boroughSel = document.createElement('select');
  boroughSel.innerHTML = '<option value="">All boroughs</option>' + boroughs.map((b) => `<option value="${b}">${b}</option>`).join('');

  const windowSel = document.createElement('select');
  windowSel.innerHTML = [
    '<option value="all">All dates</option>',
    '<option value="3m">Next 3 months</option>',
    '<option value="6m">Next 6 months</option>',
  ].join('');

  const linkedWrap = document.createElement('label');
  linkedWrap.className = 'prides-checkbox';
  const linkedOnly = document.createElement('input');
  linkedOnly.type = 'checkbox';
  linkedWrap.appendChild(linkedOnly);
  linkedWrap.appendChild(document.createTextNode(' Only with linked events'));

  [boroughSel, windowSel, linkedWrap].forEach((el) => host.appendChild(el));

  const emit = () => {
    onChange({
      borough: boroughSel.value,
      window: windowSel.value,
      linkedOnly: linkedOnly.checked,
    });
  };

  boroughSel.addEventListener('change', emit);
  windowSel.addEventListener('change', emit);
  linkedOnly.addEventListener('change', emit);
}

function withinWindow(pride, windowKey, now) {
  if (windowKey === 'all') return true;
  const start = parseDate(pride.startDate);
  if (!start) return true;
  const end = new Date(now);
  end.setMonth(end.getMonth() + (windowKey === '3m' ? 3 : 6));
  return start <= end;
}

function renderSummary(prides, now) {
  const host = document.getElementById('prides-summary');
  if (!host) return;
  host.innerHTML = '';
  buildSummary(prides, now).forEach((item) => {
    const box = document.createElement('div');
    box.className = 'prides-stat';
    box.innerHTML = `<div class="prides-stat-value">${item.value}</div><div class="prides-stat-label">${item.label}</div>`;
    host.appendChild(box);
  });
}

function renderList(prides, now) {
  const host = document.getElementById('prides-list');
  if (!host) return;
  host.innerHTML = '';

  if (!prides.length) {
    host.innerHTML = '<p>No prides match the current filters.</p>';
    return;
  }

  const grouped = new Map();
  prides.forEach((p) => {
    const key = monthKey(p);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(p);
  });

  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
    if (a === 'tbc') return 1;
    if (b === 'tbc') return -1;
    return a.localeCompare(b);
  });

  sortedKeys.forEach((key) => {
    const section = document.createElement('section');
    section.className = 'prides-month';

    const h2 = document.createElement('h2');
    h2.textContent = monthLabel(key);
    section.appendChild(h2);

    const table = document.createElement('div');
    table.className = 'prides-table';

    grouped.get(key)
      .slice()
      .sort((a, b) => {
        const ad = parseDate(a.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bd = parseDate(b.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (ad !== bd) return ad - bd;
        return a.name.localeCompare(b.name);
      })
      .forEach((pride) => {
        const row = document.createElement('article');
        row.className = 'pride-row';

        const status = getStatus(pride, now);
        const title = pride.websiteUrl
          ? `<a href="${pride.websiteUrl}" target="_blank" rel="noopener noreferrer">${pride.name}</a>`
          : pride.name;

        row.innerHTML = `
          <div class="pride-main">
            <h3>${title}</h3>
            <div class="pride-meta">${pride.location || 'Location TBC'}${pride.borough ? `, ${pride.borough}` : ''}</div>
          </div>
          <div class="pride-dates">${formatDateRange(pride)}</div>
          <div class="pride-status pride-status-${status.toLowerCase()}">${status}</div>
          <div class="pride-events">${pride.eventCount} linked events</div>
        `;

        table.appendChild(row);
      });

    section.appendChild(table);
    host.appendChild(section);
  });
}

const now = new Date();

fetchJsonWithFallback('../api/prides.php', '../prides.json').then((raw) => {
  const allPrides = (Array.isArray(raw) ? raw : []).map(normalizePride).filter(Boolean);
  let current = allPrides.slice();

  renderSummary(allPrides, now);
  renderList(current, now);

  setupFilters(allPrides, ({ borough, window, linkedOnly }) => {
    current = allPrides.filter((p) => {
      if (borough && p.borough !== borough) return false;
      if (linkedOnly && p.eventCount <= 0) return false;
      if (!withinWindow(p, window, now)) return false;
      return true;
    });
    renderList(current, now);
  });
}).catch((err) => {
  const host = document.getElementById('prides-list');
  if (host) host.innerHTML = '<p>Failed to load pride data.</p>';
  console.error('Failed to load prides:', err);
});
