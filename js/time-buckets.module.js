import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  isSameMonth,
  getEventStartDate,
  eventOverlaps,
  createSection,
} from './events-shared-utils.js';

export function buildFutureMonths(now, monthsAhead = 3) {
  return Array.from({ length: Math.max(1, monthsAhead) }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + (index + 1), 1);
    return {
      date,
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      title: index === 0
        ? `Next Month - ${date.toLocaleString('en-GB', { month: 'long' })}`
        : date.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    };
  });
}

export function buildTimeBuckets(events, now, futureMonths, rangeEnd) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStart = startOfDay(tomorrow);
  const tomorrowEnd = endOfDay(tomorrow);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const monthEnd = endOfMonth(now);
  const thisMonthName = now.toLocaleString('en-GB', { month: 'long' });

  return {
    thisMonthName,
    today: events.filter((ev) => eventOverlaps(ev, todayStart, todayEnd)),
    tomorrow: events.filter((ev) => eventOverlaps(ev, tomorrowStart, tomorrowEnd)),
    thisWeek: events.filter((ev) => eventOverlaps(ev, weekStart, weekEnd)),
    restOfMonth: (() => {
      const dayAfterWeek = new Date(weekEnd);
      dayAfterWeek.setDate(dayAfterWeek.getDate() + 1);
      const from = startOfDay(dayAfterWeek);
      const to = rangeEnd && monthEnd > rangeEnd ? rangeEnd : monthEnd;
      return events.filter((ev) => eventOverlaps(ev, from, to));
    })(),
    months: futureMonths.map(({ date, key, title }) => ({
      key,
      title,
      items: events.filter((ev) => {
        const d = getEventStartDate(ev);
        return d && isSameMonth(d, date);
      }),
    })),
  };
}

export function createTimeBucketSections(container, options) {
  const {
    idPrefix,
    titlePrefix,
    thisMonthName,
    months,
  } = options;

  container.innerHTML = '';
  const makeTitle = (title) => (titlePrefix ? `${titlePrefix} - ${title}` : title);

  const make = (title, suffix) => {
    const id = `${idPrefix}-${suffix}`;
    const list = createSection(container, makeTitle(title), id);
    const section = list.parentElement;
    if (section) section.dataset.baseTitle = makeTitle(title);
    return list;
  };

  const todayEl = make('Today', 'today');
  const tomorrowEl = make('Tomorrow', 'tomorrow');
  const weekListEl = make('Rest of this week', 'week');
  const restListEl = make(`Rest of ${thisMonthName}`, 'rest-month');
  const monthListEls = {};
  months.forEach((m) => {
    monthListEls[m.key] = make(m.title, `month-${m.key}`);
  });

  return {
    todayEl,
    tomorrowEl,
    weekListEl,
    restListEl,
    monthListEls,
  };
}
