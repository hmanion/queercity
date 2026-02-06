import {
  SEP_EN,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  isSameMonth,
  formatDate,
  getEventStartDate,
  getEventEndDate,
  eventOverlaps,
  getUniqueCategories,
  getUniqueTags,
  eventKey,
  expandAllRecurring,
  createSection,
  formatTimeRange,
  getCategory,
  getLocationParts,
  getEventUrl,
  getEventStartTime,
  getEventEndTime,
  getTagsList,
  toISODate,
} from './events-shared-utils.js';

const FUTURE_MONTHS_AHEAD = 3;
const LOOKBACK_DAYS = 0;

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
  eventBox.id = `event${i}`;
  eventBox.className = 'eventbox';

  const top = document.createElement('div');
  top.id = `eventTop${i}`;
  top.className = 'eventboxtop';

  const bottom = document.createElement('div');
  bottom.id = `eventBottom${i}`;
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
  nameDiv.id = `name${i}`;
  nameDiv.textContent = event.name || 'Untitled event';
  link.appendChild(nameDiv);

  const dateDiv = document.createElement('div');
  dateDiv.className = 'date';
  dateDiv.id = `date${i}`;
  dateDiv.textContent = formatDateTime(event);

  const category = getCategory(event);
  const catDiv = document.createElement('div');
  catDiv.className = 'category ' + category;
  catDiv.id = `category${i}`;
  catDiv.textContent = category;

  const locDiv = document.createElement('div');
  locDiv.className = 'location';
  locDiv.id = `location${i}`;
  locDiv.textContent = getLocationParts(event).join(', ');

  top.appendChild(link);
  top.appendChild(dateDiv);
  top.appendChild(locDiv);
  eventBox.appendChild(top);

  bottom.appendChild(catDiv);
  if (event._isRecurring && event._recurrenceFrequency) {
    const label = document.createElement('div');
    label.className = 'category recurring';
    label.textContent = String(event._recurrenceFrequency);
    bottom.appendChild(label);
  }

  eventBox.appendChild(bottom);
  return eventBox;
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

function buildFilters(barEl, categories, initialTags, onChangeCats, onToggleRecurring, onChangeTags) {
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

  const right = document.createElement('div');
  right.className = 'filter-right';
  const recBtn = document.createElement('button');
  recBtn.className = 'toggle recurring off';
  recBtn.setAttribute('aria-pressed', 'false');
  recBtn.textContent = 'Recurring: Hidden';
  right.appendChild(recBtn);
  barEl.appendChild(right);

  recBtn.addEventListener('click', () => {
    const on = recBtn.classList.toggle('on');
    recBtn.classList.toggle('off', !on);
    recBtn.setAttribute('aria-pressed', String(on));
    recBtn.textContent = on ? 'Recurring: Shown' : 'Recurring: Hidden';
    onToggleRecurring(on);
  });

  const tagCtrl = buildTagDropdown(barEl, initialTags, onChangeTags);
  updateCatsUI();
  return { setTagOptions: (tags) => tagCtrl.setOptions(tags) };
}

function setTitleCountForList(listEl, count) {
  const section = listEl.parentElement;
  if (!section) return;
  const h2 = section.querySelector('h2.event-section-title');
  const base = section.dataset.baseTitle || (h2 ? h2.textContent.replace(/\s*\(.*\)$/, '') : '');
  if (h2) h2.textContent = count > 0 ? `${base} (${count})` : base;
}

function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function monthTitle(date) { return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' }); }

const now = new Date();
const lookback = new Date(now);
lookback.setDate(now.getDate() - LOOKBACK_DAYS);

const futureMonths = Array.from({ length: Math.max(1, FUTURE_MONTHS_AHEAD) }, (_, index) => {
  const date = new Date(now.getFullYear(), now.getMonth() + (index + 1), 1);
  return {
    date,
    key: monthKey(date),
    title: index === 0 ? `Next Month - ${date.toLocaleString('en-GB', { month: 'long' })}` : monthTitle(date),
  };
});

const endRange = endOfMonth(futureMonths[futureMonths.length - 1].date);
const fromParam = toISODate(lookback);
const toParam = toISODate(endRange);

function fetchJsonWithFallback(primaryUrl, fallbackUrl) {
  return fetch(primaryUrl)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Primary fetch failed'))))
    .catch(() => fetch(fallbackUrl).then((r) => (r.ok ? r.json() : [])))
    .catch(() => []);
}

Promise.all([
  fetchJsonWithFallback(
    `api/output.php?from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}`,
    'output.json',
  ),
  fetchJsonWithFallback(
    'api/directory.php?limit=2000',
    'directory.json',
  ),
]).then(([oneOffData, directoryData]) => {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStart = startOfDay(tomorrow);
  const tomorrowEnd = endOfDay(tomorrow);
  const thisMonthName = now.toLocaleString('en-GB', { month: 'long' });
  const startWeek = startOfWeek(now);
  const endWeek = endOfWeek(now);

  const singlesRaw = (oneOffData || []).filter((e) => e && e.startDate).map((e) => ({ ...e }));
  const recurringRaw = expandAllRecurring(directoryData || [], startWeek, endRange);

  function notEndedBeforeToday(ev) {
    const end = getEventEndDate(ev);
    return !end || end >= todayStart;
  }

  const allEvents = [...singlesRaw.filter(notEndedBeforeToday), ...recurringRaw.filter(notEndedBeforeToday)]
    .sort((a, b) => (getEventStartDate(a) || new Date(8640000000000000)) - (getEventStartDate(b) || new Date(8640000000000000)));

  const eventList = document.getElementById('eventlist');
  if (!eventList) return;

  const filterBar = ensureFilterBar(eventList);
  const categories = getUniqueCategories(allEvents);
  const tags = getUniqueTags(allEvents);

  const base = {
    today: allEvents.filter((e) => eventOverlaps(e, todayStart, todayEnd)),
    tomorrow: allEvents.filter((e) => eventOverlaps(e, tomorrowStart, tomorrowEnd)),
    thisWeek: allEvents.filter((e) => eventOverlaps(e, startWeek, endWeek)),
    restOfMonth: (() => {
      const dayAfterWeek = new Date(endWeek);
      dayAfterWeek.setDate(dayAfterWeek.getDate() + 1);
      const from = startOfDay(dayAfterWeek);
      const to = endOfMonth(now);
      return allEvents.filter((e) => eventOverlaps(e, from, to));
    })(),
    months: futureMonths.map(({ date, key, title }) => ({
      date,
      key,
      title,
      items: allEvents.filter((e) => {
        const d = getEventStartDate(e);
        return d && isSameMonth(d, date);
      }),
    })),
  };

  let counter = 0;
  function appendEvents(listEl, arr, shownKeys) {
    const filtered = (arr || []).filter((ev) => {
      const key = eventKey(ev);
      if (!shownKeys || !shownKeys.has(key)) {
        if (shownKeys) shownKeys.add(key);
        return true;
      }
      return false;
    });

    setTitleCountForList(listEl, filtered.length);
    if (filtered.length === 0) {
      const section = listEl.parentElement;
      if (section) section.style.display = 'none';
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach((ev) => {
      frag.appendChild(buildEventBox(ev, counter++));
    });
    listEl.appendChild(frag);

    const section = listEl.parentElement;
    if (section) section.style.display = '';
  }

  let selectedCats = null;
  let selectedTags = null;
  let tagMode = 'any';
  let showRecurring = false;

  const filterCtrl = buildFilters(
    filterBar,
    categories,
    tags,
    (cats) => { selectedCats = cats; render(); },
    (on) => { showRecurring = on; render(); },
    (tagsSet, mode) => { selectedTags = tagsSet; tagMode = mode || tagMode; render(); },
  );

  function createSections() {
    eventList.innerHTML = '';
    const make = (title, id) => {
      const list = createSection(eventList, title, id);
      const section = list.parentElement;
      if (section) section.dataset.baseTitle = title;
      return list;
    };
    const todayEl = make('Today', 'section-today');
    const tomorrowEl = make('Tomorrow', 'section-tomorrow');
    const weekListEl = make('Rest of this week', 'section-this-week');
    const restListEl = make(`Rest of ${thisMonthName}`, 'section-rest-of-month');
    const monthLists = {};
    for (const month of futureMonths) monthLists[month.key] = make(month.title, `section-month-${month.key}`);

    return {
      todayEl,
      tomorrowEl,
      weekListEl,
      restListEl,
      monthListEls: monthLists,
    };
  }

  function render() {
    const sections = createSections();
    counter = 0;
    const shown = new Set();

    const byCategory = (ev) => {
      if (!selectedCats) return true;
      return selectedCats.has(getCategory(ev));
    };
    const byRecurring = (ev) => (showRecurring ? true : !ev._isRecurring);
    const byRecurringAlwaysShown = () => true;

    const preTagToday = base.today.filter(byCategory).filter(byRecurringAlwaysShown);
    const preTagTomorrow = base.tomorrow.filter(byCategory).filter(byRecurringAlwaysShown);
    const preTagWeek = base.thisWeek.filter(byCategory).filter(byRecurring);
    const preTagRest = base.restOfMonth.filter(byCategory).filter(byRecurring);
    const preTagMonths = base.months.map((m) => ({ key: m.key, items: m.items.filter(byCategory).filter(byRecurring) }));

    const visibleBeforeTags = [
      ...preTagToday,
      ...preTagTomorrow,
      ...preTagWeek,
      ...preTagRest,
      ...preTagMonths.flatMap((m) => m.items),
    ];
    filterCtrl.setTagOptions(getUniqueTags(visibleBeforeTags));

    const byTags = (ev) => {
      if (!selectedTags || selectedTags.size === 0) return true;
      const eventTags = getTagsList(ev);
      if (tagMode === 'all') {
        for (const t of selectedTags) if (!eventTags.includes(t)) return false;
        return true;
      }
      return eventTags.some((t) => selectedTags.has(t));
    };

    const applyTags = (arr) => arr.filter(byTags);

    appendEvents(sections.todayEl, applyTags(preTagToday), shown);
    appendEvents(sections.tomorrowEl, applyTags(preTagTomorrow), shown);
    appendEvents(sections.weekListEl, applyTags(preTagWeek), shown);
    appendEvents(sections.restListEl, applyTags(preTagRest), shown);

    for (const month of preTagMonths) {
      const target = sections.monthListEls[month.key];
      if (target) appendEvents(target, applyTags(month.items), shown);
    }
  }

  render();
}).catch((err) => console.error('Error loading JSON:', err));
