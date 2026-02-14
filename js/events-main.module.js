import {
  SEP_EN,
  startOfDay,
  startOfWeek,
  endOfMonth,
  getEventStartDate,
  getEventEndDate,
  FILTER_CATEGORIES,
  getUniqueTags,
  eventKey,
  expandAllRecurring,
  getCategory,
  toISODate,
  formatEventDateTime,
} from './events-shared-utils.js';
import { buildEventCard } from './event-card.module.js';
import { fetchJsonWithFallback } from './fetch-json.module.js';
import { ensureFilterBar, buildFilterBar } from './filter-bar.module.js';
import { buildFutureMonths, buildTimeBuckets, createTimeBucketSections } from './time-buckets.module.js';
import { matchesRecurring, matchesTags, setSectionTitleCount } from './event-filters.module.js';

const FUTURE_MONTHS_AHEAD = 3;
const LOOKBACK_DAYS = 0;

const now = new Date();
const lookback = new Date(now);
lookback.setDate(now.getDate() - LOOKBACK_DAYS);

const futureMonths = buildFutureMonths(now, FUTURE_MONTHS_AHEAD);
const rangeEnd = endOfMonth(futureMonths[futureMonths.length - 1].date);
const fromParam = toISODate(lookback);
const toParam = toISODate(rangeEnd);

Promise.all([
  fetchJsonWithFallback(
    `api/output.php?from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}`,
    'output.json',
  ),
  fetchJsonWithFallback('api/directory.php?limit=2000', 'directory.json'),
]).then(([oneOffData, directoryData]) => {
  const todayStart = startOfDay(now);
  const recurringStart = startOfWeek(now);

  const singlesRaw = (oneOffData || []).filter((e) => e && e.startDate).map((e) => ({ ...e }));
  const recurringRaw = expandAllRecurring(directoryData || [], recurringStart, rangeEnd);

  const notEndedBeforeToday = (ev) => {
    const end = getEventEndDate(ev);
    return !end || end >= todayStart;
  };

  const allEvents = [...singlesRaw.filter(notEndedBeforeToday), ...recurringRaw.filter(notEndedBeforeToday)]
    .sort((a, b) => (getEventStartDate(a) || new Date(8640000000000000)) - (getEventStartDate(b) || new Date(8640000000000000)));

  const eventList = document.getElementById('eventlist');
  if (!eventList) return;

  const filterBar = ensureFilterBar(eventList);
  let selectedCats = null;
  let selectedTags = null;
  let tagMode = 'any';
  let showRecurring = false;

  const filterCtrl = buildFilterBar({
    barEl: filterBar,
    categories: FILTER_CATEGORIES,
    showCategories: true,
    initialTags: getUniqueTags(allEvents),
    showRecurringToggle: true,
    recurringDefaultOn: showRecurring,
    onChangeCategories: (cats) => {
      selectedCats = cats;
      render();
    },
    onChangeRecurring: (on) => {
      showRecurring = on;
      render();
    },
    onChangeTags: (tagsSet, mode) => {
      selectedTags = tagsSet;
      tagMode = mode || tagMode;
      render();
    },
  });

  const base = buildTimeBuckets(allEvents, now, futureMonths, rangeEnd);
  let counter = 0;

  const appendEvents = (listEl, arr, shownKeys) => {
    const filtered = (arr || []).filter((ev) => {
      const key = eventKey(ev);
      if (shownKeys.has(key)) return false;
      shownKeys.add(key);
      return true;
    });

    setSectionTitleCount(listEl, filtered.length);
    const section = listEl.parentElement;
    if (!filtered.length) {
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
    if (section) section.style.display = '';
  };

  const render = () => {
    const sections = createTimeBucketSections(eventList, {
      idPrefix: 'section',
      titlePrefix: '',
      thisMonthName: base.thisMonthName,
      months: base.months,
    });
    counter = 0;
    const shown = new Set();

    const byCategory = (ev) => (!selectedCats ? true : selectedCats.has(getCategory(ev)));
    const applyTags = (arr) => (arr || []).filter((ev) => matchesTags(ev, selectedTags, tagMode));

    const preTagToday = base.today.filter(byCategory);
    const preTagTomorrow = base.tomorrow.filter(byCategory);
    const preTagWeek = base.thisWeek.filter(byCategory).filter((ev) => matchesRecurring(ev, showRecurring));
    const preTagRest = base.restOfMonth.filter(byCategory).filter((ev) => matchesRecurring(ev, showRecurring));
    const preTagMonths = base.months.map((m) => ({
      key: m.key,
      items: m.items.filter(byCategory).filter((ev) => matchesRecurring(ev, showRecurring)),
    }));

    filterCtrl.setTagOptions(getUniqueTags([
      ...preTagToday,
      ...preTagTomorrow,
      ...preTagWeek,
      ...preTagRest,
      ...preTagMonths.flatMap((m) => m.items),
    ]));

    appendEvents(sections.todayEl, applyTags(preTagToday), shown);
    appendEvents(sections.tomorrowEl, applyTags(preTagTomorrow), shown);
    appendEvents(sections.weekListEl, applyTags(preTagWeek), shown);
    appendEvents(sections.restListEl, applyTags(preTagRest), shown);

    preTagMonths.forEach((month) => {
      const target = sections.monthListEls[month.key];
      if (target) appendEvents(target, applyTags(month.items), shown);
    });
  };

  render();
}).catch((err) => console.error('Error loading JSON:', err));
