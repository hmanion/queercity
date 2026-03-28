import { describe, expect, it } from 'vitest';

import {
  eventOverlaps,
  expandRecurringEvent,
  getEventEndDate,
  getEventStartDate,
  normalizeCategorySlug,
  parseISODateLocal,
  parseOccurrenceList,
  splitKeywords,
  isMultiDayEvent,
} from '../../js/events-shared-utils.js';

describe('events-shared-utils', () => {
  it('normalizes legacy category aliases to current slugs', () => {
    expect(normalizeCategorySlug('Activity')).toBe('active');
    expect(normalizeCategorySlug('Club')).toBe('music');
    expect(normalizeCategorySlug('Sexy')).toBe('sex');
    expect(normalizeCategorySlug('socials')).toBe('social');
  });

  it('parses date-only values in local time and preserves datetimes', () => {
    const dateOnly = parseISODateLocal('2025-09-12');
    expect(dateOnly).toBeInstanceOf(Date);
    expect(dateOnly.getFullYear()).toBe(2025);
    expect(dateOnly.getMonth()).toBe(8);
    expect(dateOnly.getDate()).toBe(12);
    expect(dateOnly.getHours()).toBe(0);

    const dateTime = parseISODateLocal('2025-09-12T18:30:00');
    expect(dateTime).toBeInstanceOf(Date);
    expect(dateTime.getTime()).toBe(new Date('2025-09-12T18:30:00').getTime());
  });

  it('derives event start and end dates from available fields', () => {
    const oneDay = { startDate: '2025-09-12' };
    const multiDay = { startDate: '2025-09-12', endDate: '2025-09-14' };

    expect(getEventStartDate(oneDay)?.getDate()).toBe(12);
    expect(getEventEndDate(oneDay)?.getDate()).toBe(12);
    expect(getEventEndDate(multiDay)?.getDate()).toBe(14);
  });

  it('detects multi-day events and overlap windows correctly', () => {
    const multiDay = { startDate: '2025-09-12', endDate: '2025-09-14' };
    const singleDay = { startDate: '2025-09-16' };

    expect(isMultiDayEvent(multiDay)).toBe(true);
    expect(isMultiDayEvent(singleDay)).toBe(false);
    expect(eventOverlaps(multiDay, new Date(2025, 8, 13), new Date(2025, 8, 13, 23, 59, 59, 999))).toBe(true);
    expect(eventOverlaps(singleDay, new Date(2025, 8, 12), new Date(2025, 8, 12, 23, 59, 59, 999))).toBe(false);
  });

  it('expands weekly, fortnightly, and monthly recurring events', () => {
    const rangeStart = new Date(2025, 8, 1);
    const rangeEnd = new Date(2025, 8, 30, 23, 59, 59, 999);

    const weekly = expandRecurringEvent(
      { name: 'Weekly Meetup', frequency: 'Weekly', dayWeek: 'Friday' },
      rangeStart,
      rangeEnd,
    );
    expect(weekly.map((item) => item.startDate)).toEqual([
      '2025-09-05',
      '2025-09-12',
      '2025-09-19',
      '2025-09-26',
    ]);

    const fortnightly = expandRecurringEvent(
      { name: 'Fortnightly Run', frequency: 'Fortnightly', dayWeek: 'Tuesday', startDate: '2025-09-02' },
      rangeStart,
      rangeEnd,
    );
    expect(fortnightly.map((item) => item.startDate)).toEqual([
      '2025-09-02',
      '2025-09-16',
      '2025-09-30',
    ]);

    const monthly = expandRecurringEvent(
      { name: 'Monthly Circle', frequency: 'Monthly', dayWeek: 'Wednesday', occurrence: 'first and third' },
      rangeStart,
      new Date(2025, 9, 31, 23, 59, 59, 999),
    );
    expect(monthly.map((item) => item.startDate)).toEqual([
      '2025-09-03',
      '2025-09-17',
      '2025-10-01',
      '2025-10-15',
    ]);
  });

  it('parses occurrence lists and keyword tags consistently', () => {
    expect(parseOccurrenceList('first and third')).toEqual([1, 3]);
    expect(parseOccurrenceList('2nd, last')).toEqual([2, 'last']);
    expect(splitKeywords('Sport, outside,  community ')).toEqual(['sport', 'outside', 'community']);
  });
});
