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
  parseISODateLocal, startOfDay, toISODate,
  formatDate, formatTimeRange,
  // event helper
  getEventEndDate,
  // small DOM helper
  createSection,
  getEventStartTime, getEventEndTime, getCategory, getEventUrl, getLocationParts,
  getUniqueCategories, getUniqueTags, getTagsList
} from './events-shared-utils.js';

function formatDateTime(ev) {
  const start = formatDate(ev.startDate);
  if (!start) return '';
  const startTime = getEventStartTime(ev);
  const endTime = getEventEndTime(ev);
  if (ev.endDate && !endTime) {
    const end = formatDate(ev.endDate);
    return `${start}${SEP_EN}${end}`; // e.g., "Mon 1 Sep – Thu 4 Sep"
  }
  if (startTime && endTime) {
    return `${start} ${formatTimeRange(startTime, endTime, SEP_EN)}`; // e.g., "Mon 1 Sep 19:00 – 21:00"
  }
  if (startTime && !endTime) {
    return `${start} ${startTime}`;
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
  const url = getEventUrl(ev);
  if (url) { link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  const nameDiv = document.createElement('div');
  nameDiv.className = 'name';
  nameDiv.textContent = ev.name || 'Untitled event';
  link.appendChild(nameDiv);

  const locDiv = document.createElement('div');
  locDiv.className = 'location';
  locDiv.textContent = getLocationParts(ev).join(', ');

  top.appendChild(link);
  top.appendChild(dateDiv);
  top.appendChild(locDiv);

  const catDiv = document.createElement('div');
  const category = getCategory(ev);
  catDiv.className = 'category ' + category;
  catDiv.textContent = category;
  bottom.appendChild(catDiv);

  eventBox.appendChild(top);
  eventBox.appendChild(bottom);
  return eventBox;
}

function ensureMonthSection(container, title, id) {
  return createSection(container, title, id);
}

function ensureFilterBar(beforeEl) {
  let bar = document.getElementById('category-filter-bar');
  if (!bar) {
    bar = document.createElement('section');
    bar.id = 'category-filter-bar';
    bar.className = 'category-filter-bar';
    beforeEl.parentNode.insertBefore(bar, beforeEl);
  } else {
    bar.innerHTML = '';
  }
  return bar;
}

function buildTagDropdown(barEl, initialTags, onChangeTagsWithMode) {
  let selected = new Set();
  let mode = 'any';

  const wrap = document.createElement('div');
  wrap.className = 'tag-filter dropdown';
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'tags-toggle';
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.textContent = 'Tags';

  const panel = document.createElement('div');
  panel.className = 'tags-panel';
  panel.style.display = 'none';

  const modeWrap = document.createElement('div');
  modeWrap.className = 'tags-mode';
  const modeLabel = document.createElement('span');
  modeLabel.textContent = 'Match:';
  const anyBtn = document.createElement('button');
  anyBtn.type = 'button';
  anyBtn.className = 'tag-mode any active';
  anyBtn.textContent = 'Any';
  anyBtn.setAttribute('aria-pressed', 'true');
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'tag-mode all';
  allBtn.textContent = 'All';
  allBtn.setAttribute('aria-pressed', 'false');
  modeWrap.appendChild(modeLabel);
  modeWrap.appendChild(anyBtn);
  modeWrap.appendChild(allBtn);

  const list = document.createElement('div');
  list.className = 'tags-list';

  const actions = document.createElement('div');
  actions.className = 'tags-actions';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'tags-clear';
  clearBtn.textContent = 'Clear';
  actions.appendChild(clearBtn);

  panel.appendChild(modeWrap);
  panel.appendChild(list);
  panel.appendChild(actions);
  wrap.appendChild(toggleBtn);
  wrap.appendChild(panel);
  barEl.appendChild(wrap);

  function emit() {
    onChangeTagsWithMode(selected.size ? new Set(selected) : null, mode);
  }

  function updateModeUI() {
    const isAny = mode === 'any';
    anyBtn.classList.toggle('active', isAny);
    allBtn.classList.toggle('active', !isAny);
    anyBtn.setAttribute('aria-pressed', String(isAny));
    allBtn.setAttribute('aria-pressed', String(!isAny));
  }

  let currentOptions = initialTags || [];
  function renderOptions(tags) {
    list.innerHTML = '';
    tags.forEach((tag) => {
      const id = `tag-${tag.replace(/[^a-z0-9]+/g, '-')}`;
      const label = document.createElement('label');
      label.className = 'tag-option';
      label.setAttribute('for', id);
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.value = tag;
      cb.checked = selected.has(tag);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(tag); else selected.delete(tag);
        emit();
      });
      const txt = document.createElement('span');
      txt.textContent = tag;
      label.appendChild(cb);
      label.appendChild(txt);
      list.appendChild(label);
    });
  }

  toggleBtn.addEventListener('click', () => {
    const open = panel.style.display === 'none';
    panel.style.display = open ? 'block' : 'none';
    toggleBtn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      panel.style.display = 'none';
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  clearBtn.addEventListener('click', () => {
    selected.clear();
    renderOptions(currentOptions);
    emit();
  });

  anyBtn.addEventListener('click', () => { mode = 'any'; updateModeUI(); emit(); });
  allBtn.addEventListener('click', () => { mode = 'all'; updateModeUI(); emit(); });

  updateModeUI();
  renderOptions(currentOptions);

  return {
    setOptions(newTags) {
      currentOptions = Array.from(newTags);
      const before = new Set(selected);
      selected = new Set(Array.from(selected).filter((t) => currentOptions.includes(t)));
      const changed = before.size !== selected.size || Array.from(before).some((t) => !selected.has(t));
      renderOptions(currentOptions);
      if (changed) emit();
    },
  };
}

function buildFilters(barEl, categories, initialTags, onChangeCats, onChangeTags) {
  let selectedCats = null;
  const row = document.createElement('div');
  row.className = 'filter-row';
  barEl.appendChild(row);

  const allBtn = document.createElement('button');
  allBtn.textContent = 'All';
  allBtn.className = 'cat-pill active';
  allBtn.setAttribute('aria-pressed', 'true');
  row.appendChild(allBtn);

  const catBtns = categories.map((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.className = 'cat-pill ' + cat;
    btn.dataset.cat = cat;
    btn.setAttribute('aria-pressed', 'false');
    row.appendChild(btn);
    return btn;
  });

  function updateCatsUI() {
    const allActive = selectedCats === null || (selectedCats && selectedCats.size === 0);
    allBtn.classList.toggle('active', allActive);
    allBtn.setAttribute('aria-pressed', String(allActive));
    catBtns.forEach((btn) => {
      const on = selectedCats && selectedCats.has(btn.dataset.cat);
      btn.classList.toggle('active', !!on);
      btn.setAttribute('aria-pressed', String(!!on));
    });
  }

  allBtn.addEventListener('click', () => { selectedCats = null; updateCatsUI(); onChangeCats(null); });
  catBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (selectedCats === null) selectedCats = new Set();
      const cat = btn.dataset.cat;
      if (selectedCats.has(cat)) selectedCats.delete(cat); else selectedCats.add(cat);
      if (selectedCats.size === 0) {
        selectedCats = null;
        onChangeCats(null);
      } else {
        onChangeCats(new Set(selectedCats));
      }
      updateCatsUI();
    });
  });

  const tagCtrl = buildTagDropdown(barEl, initialTags, onChangeTags);
  updateCatsUI();
  return { setTagOptions: (tags) => tagCtrl.setOptions(tags) };
}

const now = new Date();
const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
const to = new Date(now);
to.setDate(to.getDate() - 1);
const fromParam = toISODate(from);
const toParam = toISODate(to);

fetch(`../api/output.php?from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}`)
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

    const filterBar = ensureFilterBar(container);
    const categories = getUniqueCategories(pastSingles);
    const tags = getUniqueTags(pastSingles);

    let selectedCats = null;
    let selectedTags = null;
    let tagMode = 'any';

    const filterCtrl = buildFilters(
      filterBar,
      categories,
      tags,
      (cats) => { selectedCats = cats; render(); },
      (tagsSet, mode) => { selectedTags = tagsSet; tagMode = mode || tagMode; render(); },
    );

    function applyFilters(items) {
      const byCategory = (ev) => {
        if (!selectedCats) return true;
        return selectedCats.has(getCategory(ev));
      };
      const preTag = items.filter(byCategory);

      const availableTags = getUniqueTags(preTag);
      filterCtrl.setTagOptions(availableTags);

      const byTags = (ev) => {
        if (!selectedTags || selectedTags.size === 0) return true;
        const eventTags = getTagsList(ev);
        if (tagMode === 'all') {
          for (const t of selectedTags) if (!eventTags.includes(t)) return false;
          return true;
        }
        return eventTags.some((t) => selectedTags.has(t));
      };
      return preTag.filter(byTags);
    }

    let counter = 0;
    function render() {
      container.innerHTML = '';
      const monthEntries = Array.from(groups.entries())
        .sort((a, b) => b[0].localeCompare(a[0]));

      counter = 0;
      for (const [key, { title, items }] of monthEntries) {
        const filteredItems = applyFilters(items);
        if (!filteredItems.length) continue;
        filteredItems.sort((a, b) => parseISODateLocal(b.startDate) - parseISODateLocal(a.startDate) || String(a.name||'').localeCompare(String(b.name||'')));
        const listEl = ensureMonthSection(container, title, `archive-${key}`);
        const section = listEl.parentElement;
        if (section) {
          const h2 = section.querySelector('h2.event-section-title');
          if (h2) h2.textContent = `${title} (${filteredItems.length})`;
        }
        const frag = document.createDocumentFragment();
        filteredItems.forEach(ev => { frag.appendChild(buildEventBox(ev, counter++)); });
        listEl.appendChild(frag);
      }
    }

    render();
  })
  .catch(err => console.error('Error building archive page:', err));
