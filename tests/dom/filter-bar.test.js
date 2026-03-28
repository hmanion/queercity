import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildFilterBar } from '../../js/filter-bar.module.js';

describe('buildFilterBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '<section id="bar"></section>';
  });

  it('toggles category state and emits selected category sets', () => {
    const onChangeCategories = vi.fn();
    const onChangeRecurring = vi.fn();
    const onChangeTags = vi.fn();

    buildFilterBar({
      barEl: document.getElementById('bar'),
      categories: ['Active', 'Music'],
      showCategories: true,
      initialTags: ['sport', 'dance'],
      showRecurringToggle: true,
      recurringDefaultOn: false,
      onChangeCategories,
      onChangeRecurring,
      onChangeTags,
    });

    const activeBtn = Array.from(document.querySelectorAll('.cat-pill')).find((btn) => btn.textContent === 'Active');
    const allBtn = Array.from(document.querySelectorAll('.cat-pill')).find((btn) => btn.textContent === 'All');
    const recurringBtn = document.querySelector('.toggle.recurring');

    activeBtn.click();
    expect(onChangeCategories).toHaveBeenLastCalledWith(new Set(['Active']));
    expect(activeBtn.classList.contains('active')).toBe(true);

    allBtn.click();
    expect(onChangeCategories).toHaveBeenLastCalledWith(null);
    expect(allBtn.classList.contains('active')).toBe(true);

    recurringBtn.click();
    expect(onChangeRecurring).toHaveBeenLastCalledWith(true);
    expect(recurringBtn.textContent).toContain('Shown');
  });

  it('updates tag options and prunes no-longer-valid selections', () => {
    const onChangeTags = vi.fn();

    const filter = buildFilterBar({
      barEl: document.getElementById('bar'),
      categories: ['Active'],
      showCategories: false,
      initialTags: ['sport', 'dance'],
      showRecurringToggle: false,
      onChangeTags,
    });

    const toggle = document.querySelector('.tags-toggle');
    toggle.click();

    const sport = document.querySelector('input[value="sport"]');
    sport.click();
    expect(onChangeTags).toHaveBeenLastCalledWith(new Set(['sport']), 'any');

    filter.setTagOptions(['dance', 'community']);
    expect(document.querySelector('input[value="sport"]')).toBeNull();
    expect(onChangeTags).toHaveBeenLastCalledWith(null, 'any');
  });
});
