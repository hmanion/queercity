import {
  SEP_EN,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  isSameMonth,
  formatEventDateTime,
  getEventStartDate,
  getEventEndDate,
  eventOverlaps,
  getUniqueCategories,
  getUniqueTags,
  eventKey,
  expandAllRecurring,
  createSection,
  getCategory,
  getTagsList,
  toISODate,
} from './events-shared-utils.js';
import { buildEventCard } from './event-card.module.js';
import { fetchJsonWithFallback } from './fetch-json.module.js';
import { createTagDropdown } from './tag-filter.module.js';

const FUTURE_MONTHS_AHEAD = 3;
const LOOKBACK_DAYS = 0;

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

  const tagCtrl = createTagDropdown(barEl, initialTags, onChangeTags);
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
      frag.appendChild(buildEventCard(ev, counter++, {
        idPrefix: 'event',
        topIdPrefix: 'eventTop',
        bottomIdPrefix: 'eventBottom',
        nameIdPrefix: 'name',
        dateIdPrefix: 'date',
        categoryIdPrefix: 'category',
        locationIdPrefix: 'location',
        dateText: (item) => formatEventDateTime(item, SEP_EN),
        recurringLabelMode: 'main',
      }));
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
