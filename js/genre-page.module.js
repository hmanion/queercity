import {
  SEP_EN,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  isSameMonth,
  getEventStartDate,
  getEventEndDate,
  eventOverlaps,
  expandAllRecurring,
  createSection,
  formatEventDateTime,
  getCategory,
  eventKey,
  toISODate,
  getUniqueTags,
  getTagsList,
} from './events-shared-utils.js';
import { buildEventCard } from './event-card.module.js';
import { fetchJsonWithFallback } from './fetch-json.module.js';
import { createTagDropdown } from './tag-filter.module.js';

const FUTURE_MONTHS_AHEAD = 3;

function normalizeGenreValue(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const compact = raw.replace(/[^a-z0-9]+/g, '');
  if (compact === 'activities') return 'activity';
  if (compact.endsWith('ies') && compact.length > 3) return compact.slice(0, -3) + 'y';
  if (compact.endsWith('s') && compact.length > 1) return compact.slice(0, -1);
  return compact;
}

function setTitleCountForList(listEl, count) {
  const section = listEl.parentElement;
  if (!section) return;
  const h2 = section.querySelector('h2.event-section-title');
  const base = section.dataset.baseTitle || (h2 ? h2.textContent.replace(/\s*\(.*\)$/, '') : '');
  if (h2) h2.textContent = count > 0 ? `${base} (${count})` : base;
}

const now = new Date();
const todayStart = startOfDay(now);
const futureMonths = Array.from({ length: Math.max(1, FUTURE_MONTHS_AHEAD) }, (_, index) => {
  const date = new Date(now.getFullYear(), now.getMonth() + (index + 1), 1);
  return {
    date,
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    title: index === 0
      ? `Next Month - ${date.toLocaleString('en-GB', { month: 'long' })}`
      : date.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
  };
});
const rangeEnd = endOfMonth(futureMonths[futureMonths.length - 1].date);
const fromParam = toISODate(todayStart);
const toParam = toISODate(rangeEnd);
const recurringStart = startOfWeek(todayStart);

const root = document.getElementById('genrepage');
const target = document.getElementById('genrelist');
if (!root || !target) {
  console.error('Genre page container missing');
} else {
  const genreLabel = String(root.dataset.genreLabel || '').trim();
  const genreTitle = String(root.dataset.genreTitle || genreLabel).trim();

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

    const wanted = normalizeGenreValue(genreLabel);
    const genreEvents = allWindowEvents.filter((ev) => normalizeGenreValue(getCategory(ev)) === wanted);

    target.innerHTML = '';
    const filterHost = document.getElementById('category-filter-bar');
    if (filterHost) filterHost.innerHTML = '';

    const thisMonthName = now.toLocaleString('en-GB', { month: 'long' });
    const todayEnd = endOfDay(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStart = startOfDay(tomorrow);
    const tomorrowEnd = endOfDay(tomorrow);
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const base = {
      today: genreEvents.filter((e) => eventOverlaps(e, todayStart, todayEnd)),
      tomorrow: genreEvents.filter((e) => eventOverlaps(e, tomorrowStart, tomorrowEnd)),
      thisWeek: genreEvents.filter((e) => eventOverlaps(e, weekStart, weekEnd)),
      restOfMonth: (() => {
        const dayAfterWeek = new Date(weekEnd);
        dayAfterWeek.setDate(dayAfterWeek.getDate() + 1);
        const from = startOfDay(dayAfterWeek);
        const to = endOfMonth(now) < rangeEnd ? endOfMonth(now) : rangeEnd;
        return genreEvents.filter((e) => eventOverlaps(e, from, to));
      })(),
      months: futureMonths.map(({ date, key, title }) => ({
        key,
        title,
        items: genreEvents.filter((e) => {
          const d = getEventStartDate(e);
          return d && isSameMonth(d, date);
        }),
      })),
    };

    const makeSection = (label, id) => {
      const list = createSection(target, label, id);
      const section = list.parentElement;
      if (section) section.dataset.baseTitle = label;
      return list;
    };
    const todayList = makeSection(`${genreTitle} - Today`, 'section-genre-today');
    const tomorrowList = makeSection(`${genreTitle} - Tomorrow`, 'section-genre-tomorrow');
    const weekList = makeSection(`${genreTitle} - Rest of this week`, 'section-genre-week');
    const restMonthList = makeSection(`${genreTitle} - Rest of ${thisMonthName}`, 'section-genre-rest-month');
    const monthLists = {};
    base.months.forEach((m) => {
      monthLists[m.key] = makeSection(`${genreTitle} - ${m.title}`, `section-genre-month-${m.key}`);
    });

    let selectedTags = null;
    let tagMode = 'any';
    let showRecurring = true;
    if (filterHost) {
      const right = document.createElement('div');
      right.className = 'filter-right';
      const recBtn = document.createElement('button');
      recBtn.className = 'toggle recurring on';
      recBtn.setAttribute('aria-pressed', 'true');
      recBtn.textContent = 'Recurring: Shown';
      right.appendChild(recBtn);
      filterHost.appendChild(right);
      recBtn.addEventListener('click', () => {
        const on = recBtn.classList.toggle('on');
        recBtn.classList.toggle('off', !on);
        recBtn.setAttribute('aria-pressed', String(on));
        recBtn.textContent = on ? 'Recurring: Shown' : 'Recurring: Hidden';
        showRecurring = on;
        render();
      });
    }
    const filterCtrl = createTagDropdown(
      filterHost || target,
      getUniqueTags(genreEvents),
      (tagsSet, mode) => {
      selectedTags = tagsSet;
      tagMode = mode || tagMode;
      render();
      },
      { idPrefix: 'genre-tag-' },
    );

    function byTags(ev) {
      if (!selectedTags || selectedTags.size === 0) return true;
      const eventTags = getTagsList(ev);
      if (tagMode === 'all') {
        for (const t of selectedTags) if (!eventTags.includes(t)) return false;
        return true;
      }
      return eventTags.some((t) => selectedTags.has(t));
    }

    function appendEvents(listEl, arr, shown, counterRef) {
      const uniqueItems = (arr || []).filter((ev) => {
        const key = eventKey(ev);
        if (shown.has(key)) return false;
        shown.add(key);
        return true;
      });
      setTitleCountForList(listEl, uniqueItems.length);
      const section = listEl.parentElement;
      if (!uniqueItems.length) {
        if (section) section.style.display = 'none';
        return;
      }
      if (section) section.style.display = '';
      uniqueItems.forEach((ev) => listEl.appendChild(buildEventCard(ev, counterRef.n++, {
        idPrefix: 'genreEvent',
        dateText: (item) => formatEventDateTime(item, SEP_EN),
      })));
    }

    function render() {
      const existingEmpty = document.getElementById('genre-empty-message');
      if (existingEmpty) existingEmpty.remove();
      const shown = new Set();
      const counterRef = { n: 0 };
      const preTag = {
        today: base.today.filter((ev) => (showRecurring ? true : !ev._isRecurring)),
        tomorrow: base.tomorrow.filter((ev) => (showRecurring ? true : !ev._isRecurring)),
        thisWeek: base.thisWeek.filter((ev) => (showRecurring ? true : !ev._isRecurring)),
        restOfMonth: base.restOfMonth.filter((ev) => (showRecurring ? true : !ev._isRecurring)),
        months: base.months.map((m) => ({ key: m.key, items: m.items.filter((ev) => (showRecurring ? true : !ev._isRecurring)) })),
      };

      const allForTagChoices = [
        ...preTag.today,
        ...preTag.tomorrow,
        ...preTag.thisWeek,
        ...preTag.restOfMonth,
        ...preTag.months.flatMap((m) => m.items),
      ];
      filterCtrl.setOptions(getUniqueTags(allForTagChoices));

      const applyTags = (arr) => (arr || []).filter(byTags);

      [todayList, tomorrowList, weekList, restMonthList].forEach((el) => { el.innerHTML = ''; });
      Object.values(monthLists).forEach((el) => { el.innerHTML = ''; });

      appendEvents(todayList, applyTags(preTag.today), shown, counterRef);
      appendEvents(tomorrowList, applyTags(preTag.tomorrow), shown, counterRef);
      appendEvents(weekList, applyTags(preTag.thisWeek), shown, counterRef);
      appendEvents(restMonthList, applyTags(preTag.restOfMonth), shown, counterRef);
      preTag.months.forEach((m) => {
        if (monthLists[m.key]) appendEvents(monthLists[m.key], applyTags(m.items), shown, counterRef);
      });

      if (shown.size === 0) {
        const empty = document.createElement('p');
        empty.id = 'genre-empty-message';
        empty.textContent = 'No events found for this genre in the current time window.';
        target.appendChild(empty);
      }
    }

    render();
  }).catch((err) => console.error('Error loading genre data:', err));
}
