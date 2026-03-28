import { fetchJsonWithFallback } from './fetch-json.module.js';

const DISABLED_MESSAGE = 'No published pride currently listed.';

const BOROUGH_META = {
  bolton: { label: 'Bolton' },
  bury: { label: 'Bury' },
  manchester: { label: 'Manchester' },
  oldham: { label: 'Oldham' },
  rochdale: { label: 'Rochdale' },
  salford: { label: 'Salford' },
  stockport: { label: 'Stockport' },
  tameside: { label: 'Tameside' },
  trafford: { label: 'Trafford' },
  wigan: { label: 'Wigan' },
};

const BOROUGH_ALIASES = {
  cityofmanchester: 'manchester',
  manchestercity: 'manchester',
  levenshulme: 'manchester',
};

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeBorough(value) {
  const raw = String(value || '').trim();
  if (!raw) return { slug: null, label: '' };
  const token = raw.toLowerCase().replace(/[^a-z]/g, '');
  const canonical = BOROUGH_META[token] ? token : BOROUGH_ALIASES[token] || null;
  if (!canonical) return { slug: null, label: raw };
  return { slug: canonical, label: BOROUGH_META[canonical].label };
}

function normalizePride(raw) {
  const name = String(raw?.name || raw?.title || '').trim();
  const websiteUrl = String(raw?.websiteUrl || raw?.website || raw?.url || '').trim();
  const location = String(raw?.location || raw?.locationName || raw?.town || '').trim();
  const boroughRaw = String(raw?.borough || raw?.area || '').trim();
  const { slug: boroughSlug, label: boroughLabel } = normalizeBorough(boroughRaw);
  const startDate = raw?.startDate || raw?.start_date || null;
  const endDate = raw?.endDate || raw?.end_date || startDate || null;
  const eventCountRaw = Number(raw?.eventCount ?? raw?.event_count ?? raw?.linkedEventCount ?? 0);
  const eventCount = Number.isFinite(eventCountRaw) ? Math.max(0, Math.floor(eventCountRaw)) : 0;

  if (!name) return null;
  return {
    name,
    websiteUrl,
    location,
    borough: boroughRaw,
    boroughSlug,
    boroughLabel: boroughLabel || boroughRaw,
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
  const boroughs = new Set(prides.map((p) => p.boroughLabel).filter(Boolean));
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

  const boroughs = Array.from(new Set(prides.map((p) => p.boroughLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b));

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
            <div class="pride-meta">${pride.location || 'Location TBC'}${pride.boroughLabel ? `, ${pride.boroughLabel}` : ''}</div>
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

function buildPridesByBorough(prides) {
  const map = new Map();
  prides.forEach((pride) => {
    if (!pride.boroughSlug) return;
    if (!map.has(pride.boroughSlug)) map.set(pride.boroughSlug, []);
    map.get(pride.boroughSlug).push(pride);
  });
  return map;
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 54em)').matches;
}

function renderBoroughPanelContent(slug, boroughPrides, now) {
  const label = BOROUGH_META[slug]?.label || slug;
  const countText = boroughPrides.length === 1 ? '1 pride' : `${boroughPrides.length} prides`;

  if (boroughPrides.length === 0) {
    return `
      <h3>${label}</h3>
      <p class="prides-borough-empty">No prides currently listed for this borough.</p>
    `;
  }

  const items = boroughPrides
    .slice()
    .sort((a, b) => {
      const ad = parseDate(a.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bd = parseDate(b.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (ad !== bd) return ad - bd;
      return a.name.localeCompare(b.name);
    })
    .map((pride) => {
      const status = getStatus(pride, now);
      const name = pride.websiteUrl
        ? `<a href="${pride.websiteUrl}" target="_blank" rel="noopener noreferrer">${pride.name}</a>`
        : pride.name;
      return `
        <li class="prides-borough-item">
          <div class="prides-borough-name">${name}</div>
          <div class="prides-borough-meta">${pride.location || 'Location TBC'}${pride.boroughLabel ? `, ${pride.boroughLabel}` : ''}</div>
          <div class="prides-borough-meta">${formatDateRange(pride)} <span class="pride-status pride-status-${status.toLowerCase()}">${status}</span></div>
          <div class="prides-borough-meta">${pride.eventCount} linked events</div>
        </li>
      `;
    })
    .join('');

  return `
    <h3>${label} <span class="prides-borough-count">${countText}</span></h3>
    <ul class="prides-borough-items">${items}</ul>
  `;
}

async function renderInteractiveMap(pridesByBorough, now) {
  const mapHost = document.getElementById('prides-map');
  const tooltip = document.getElementById('prides-map-tooltip');
  const panel = document.getElementById('prides-borough-panel');
  const panelContent = document.getElementById('prides-borough-content');
  const closeBtn = document.getElementById('prides-borough-close');
  const liveRegion = document.getElementById('prides-map-live');
  const backdrop = document.getElementById('prides-panel-backdrop');

  if (!mapHost || !tooltip || !panel || !panelContent || !closeBtn || !liveRegion || !backdrop) return;

  let mapSvg;
  try {
    const response = await fetch('../assets/maps/gm-boroughs.svg');
    if (!response.ok) throw new Error(`Map fetch failed (${response.status})`);
    mapHost.innerHTML = await response.text();
    mapSvg = mapHost.querySelector('svg');
    if (!mapSvg) throw new Error('Invalid map SVG');
  } catch (err) {
    mapHost.innerHTML = '<p>Map unavailable.</p>';
    console.error(err);
    return;
  }

  mapSvg.classList.add('gm-borough-map');

  const boroughNodes = Array.from(mapSvg.querySelectorAll('[data-borough]'));
  let activeNode = null;
  let panelOpen = false;
  let lastFocused = null;

  const getFocusable = () => {
    return Array.from(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
  };

  function setTooltip(text = '') {
    tooltip.textContent = text;
    tooltip.classList.toggle('is-visible', !!text);
  }

  function announce(text) {
    liveRegion.textContent = text;
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    backdrop.classList.remove('is-open');
    document.body.classList.remove('prides-panel-open');

    if (activeNode) {
      activeNode.classList.remove('is-active');
      activeNode.setAttribute('aria-pressed', 'false');
      activeNode = null;
    }

    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function openPanel(node, html, announceText) {
    if (activeNode && activeNode !== node) {
      activeNode.classList.remove('is-active');
      activeNode.setAttribute('aria-pressed', 'false');
    }

    activeNode = node;
    activeNode.classList.add('is-active');
    activeNode.setAttribute('aria-pressed', 'true');
    panelContent.innerHTML = html;

    panelOpen = true;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    if (isMobileViewport()) {
      backdrop.hidden = false;
      backdrop.classList.add('is-open');
      document.body.classList.add('prides-panel-open');
    } else {
      backdrop.hidden = true;
      backdrop.classList.remove('is-open');
      document.body.classList.remove('prides-panel-open');
    }

    announce(announceText);
    closeBtn.focus();
  }

  function selectBorough(node) {
    const slug = String(node.dataset.borough || '');
    const label = BOROUGH_META[slug]?.label || slug;
    const boroughPrides = pridesByBorough.get(slug) || [];
    if (boroughPrides.length === 0) {
      const text = `${label}: ${DISABLED_MESSAGE}`;
      setTooltip(text);
      announce(text);
      return;
    }

    const html = renderBoroughPanelContent(slug, boroughPrides, now);
    const announceText = boroughPrides.length
      ? `${label} selected. ${boroughPrides.length} pride${boroughPrides.length === 1 ? '' : 's'} listed.`
      : `${label} selected. No prides currently listed.`;

    openPanel(node, html, announceText);
  }

  boroughNodes.forEach((node) => {
    const slug = String(node.dataset.borough || '');
    const label = BOROUGH_META[slug]?.label || slug;
    const count = (pridesByBorough.get(slug) || []).length;
    const isDisabled = count === 0;

    node.classList.add('borough-shape', `borough-${slug}`);
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-controls', 'prides-borough-panel');
    node.setAttribute('aria-pressed', 'false');

    if (isDisabled) {
      node.classList.add('is-disabled');
      node.setAttribute('aria-disabled', 'true');
      node.setAttribute('aria-label', `${label}. ${DISABLED_MESSAGE}`);
    } else {
      node.setAttribute('aria-label', `${label}. ${count} pride${count === 1 ? '' : 's'}.`);
    }

    node.addEventListener('mouseenter', () => {
      node.classList.add('is-hover');
      if (isDisabled) {
        setTooltip(`${label}: ${DISABLED_MESSAGE}`);
      } else {
        setTooltip(`${label}: ${count} pride${count === 1 ? '' : 's'}`);
      }
    });

    node.addEventListener('mouseleave', () => {
      node.classList.remove('is-hover');
      setTooltip('');
    });

    node.addEventListener('focus', () => {
      node.classList.add('is-hover');
      if (isDisabled) {
        setTooltip(`${label}: ${DISABLED_MESSAGE}`);
      } else {
        setTooltip(`${label}: ${count} pride${count === 1 ? '' : 's'}`);
      }
    });

    node.addEventListener('blur', () => {
      node.classList.remove('is-hover');
      setTooltip('');
    });

    node.addEventListener('click', () => {
      lastFocused = node;
      selectBorough(node);
    });

    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        lastFocused = node;
        selectBorough(node);
      }
    });
  });

  closeBtn.addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);

  window.addEventListener('resize', () => {
    if (!panelOpen) return;
    if (isMobileViewport()) {
      backdrop.hidden = false;
      backdrop.classList.add('is-open');
      document.body.classList.add('prides-panel-open');
    } else {
      backdrop.hidden = true;
      backdrop.classList.remove('is-open');
      document.body.classList.remove('prides-panel-open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!panelOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusable();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

const now = new Date();

fetchJsonWithFallback('../api/prides.php', '../prides.json').then(async (raw) => {
  const allPrides = (Array.isArray(raw) ? raw : []).map(normalizePride).filter(Boolean);
  let current = allPrides.slice();

  renderSummary(allPrides, now);
  renderList(current, now);

  setupFilters(allPrides, ({ borough, window, linkedOnly }) => {
    current = allPrides.filter((p) => {
      if (borough && p.boroughLabel !== borough) return false;
      if (linkedOnly && p.eventCount <= 0) return false;
      if (!withinWindow(p, window, now)) return false;
      return true;
    });
    renderList(current, now);
  });

  const pridesByBorough = buildPridesByBorough(allPrides);
  await renderInteractiveMap(pridesByBorough, now);
}).catch((err) => {
  const host = document.getElementById('prides-list');
  if (host) host.innerHTML = '<p>Failed to load pride data.</p>';
  console.error('Failed to load prides:', err);
});
