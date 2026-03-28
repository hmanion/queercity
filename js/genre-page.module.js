import {
  SEP_EN,
  startOfDay,
  startOfWeek,
  endOfMonth,
  getEventStartDate,
  getEventEndDate,
  eventOverlaps,
  expandAllRecurring,
  formatEventDateTime,
  getCategory,
  normalizeCategorySlug,
  eventKey,
  toISODate,
  getUniqueTags,
} from './events-shared-utils.js';
import { buildEventCard } from './event-card.module.js';
import { fetchJsonWithFallback } from './fetch-json.module.js';
import { ensureFilterBar, buildFilterBar } from './filter-bar.module.js';
import { buildFutureMonths, buildTimeBuckets, createTimeBucketSections } from './time-buckets.module.js';
import { matchesRecurring, matchesTags, setSectionTitleCount } from './event-filters.module.js';

const FUTURE_MONTHS_AHEAD = 3;

const now = new Date();
const todayStart = startOfDay(now);
const futureMonths = buildFutureMonths(now, FUTURE_MONTHS_AHEAD);
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
    fetchJsonWithFallback('../api/directory.php?limit=2000', '../directory.json'),
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

    const wanted = normalizeCategorySlug(genreLabel);
    const genreEvents = allWindowEvents.filter((ev) => normalizeCategorySlug(getCategory(ev)) === wanted);

    const filterBar = ensureFilterBar(target);

    let selectedTags = null;
    let tagMode = 'any';
    let showRecurring = true;

    const filterCtrl = buildFilterBar({
      barEl: filterBar,
      showCategories: false,
      initialTags: getUniqueTags(genreEvents),
      showRecurringToggle: true,
      recurringDefaultOn: showRecurring,
      onChangeRecurring: (on) => {
        showRecurring = on;
        render();
      },
      onChangeTags: (tagsSet, mode) => {
        selectedTags = tagsSet;
        tagMode = mode || tagMode;
        render();
      },
      tagIdPrefix: 'genre-tag-',
    });

    const base = buildTimeBuckets(genreEvents, now, futureMonths, rangeEnd);

    const appendEvents = (listEl, arr, shown, counterRef) => {
      const uniqueItems = (arr || []).filter((ev) => {
        const key = eventKey(ev);
        if (shown.has(key)) return false;
        shown.add(key);
        return true;
      });
      setSectionTitleCount(listEl, uniqueItems.length);
      const section = listEl.parentElement;
      if (!uniqueItems.length) {
        if (section) section.style.display = 'none';
        return;
      }
      if (section) section.style.display = '';
      uniqueItems.forEach((ev) => {
        listEl.appendChild(buildEventCard(ev, counterRef.n++, {
          idPrefix: 'genreEvent',
          dateText: (item) => formatEventDateTime(item, SEP_EN),
        }));
      });
    };

    const render = () => {
      const existingEmpty = document.getElementById('genre-empty-message');
      if (existingEmpty) existingEmpty.remove();

      const sections = createTimeBucketSections(target, {
        idPrefix: 'section-genre',
        titlePrefix: genreTitle,
        thisMonthName: base.thisMonthName,
        months: base.months,
      });

      const shown = new Set();
      const counterRef = { n: 0 };

      const preTag = {
        today: base.today.filter((ev) => matchesRecurring(ev, showRecurring)),
        tomorrow: base.tomorrow.filter((ev) => matchesRecurring(ev, showRecurring)),
        thisWeek: base.thisWeek.filter((ev) => matchesRecurring(ev, showRecurring)),
        restOfMonth: base.restOfMonth.filter((ev) => matchesRecurring(ev, showRecurring)),
        months: base.months.map((m) => ({
          key: m.key,
          items: m.items.filter((ev) => matchesRecurring(ev, showRecurring)),
        })),
      };

      filterCtrl.setTagOptions(getUniqueTags([
        ...preTag.today,
        ...preTag.tomorrow,
        ...preTag.thisWeek,
        ...preTag.restOfMonth,
        ...preTag.months.flatMap((m) => m.items),
      ]));

      const applyTags = (arr) => (arr || []).filter((ev) => matchesTags(ev, selectedTags, tagMode));

      appendEvents(sections.todayEl, applyTags(preTag.today), shown, counterRef);
      appendEvents(sections.tomorrowEl, applyTags(preTag.tomorrow), shown, counterRef);
      appendEvents(sections.weekListEl, applyTags(preTag.thisWeek), shown, counterRef);
      appendEvents(sections.restListEl, applyTags(preTag.restOfMonth), shown, counterRef);
      preTag.months.forEach((m) => {
        if (sections.monthListEls[m.key]) {
          appendEvents(sections.monthListEls[m.key], applyTags(m.items), shown, counterRef);
        }
      });

      if (shown.size === 0) {
        const empty = document.createElement('p');
        empty.id = 'genre-empty-message';
        empty.textContent = 'No events found for this genre in the current time window.';
        target.appendChild(empty);
      }
    };

    render();
  }).catch((err) => console.error('Error loading genre data:', err));
}
