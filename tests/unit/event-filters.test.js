import { describe, expect, it } from 'vitest';

import { matchesRecurring, matchesTags } from '../../js/event-filters.module.js';

describe('event filters', () => {
  it('hides recurring events only when the toggle is off', () => {
    expect(matchesRecurring({ _isRecurring: true }, false)).toBe(false);
    expect(matchesRecurring({ _isRecurring: true }, true)).toBe(true);
    expect(matchesRecurring({ _isRecurring: false }, false)).toBe(true);
  });

  it('matches tags in any mode and all mode', () => {
    const event = { keywords: 'sport, outside, social' };

    expect(matchesTags(event, null, 'any')).toBe(true);
    expect(matchesTags(event, new Set(['sport']), 'any')).toBe(true);
    expect(matchesTags(event, new Set(['music']), 'any')).toBe(false);
    expect(matchesTags(event, new Set(['sport', 'outside']), 'all')).toBe(true);
    expect(matchesTags(event, new Set(['sport', 'music']), 'all')).toBe(false);
  });
});
