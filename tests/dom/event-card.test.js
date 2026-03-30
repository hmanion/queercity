import { describe, expect, it } from 'vitest';

import { buildEventCard } from '../../js/event-card.module.js';

describe('buildEventCard', () => {
  it('renders category, audience, multi-day, and recurring badges when applicable', () => {
    const event = {
      name: 'Weekend Gathering',
      url: 'https://example.com/event',
      genre: 'Activity',
      audienceLabel: 'flinta',
      startDate: '2025-09-12',
      endDate: '2025-09-14',
      locName: 'The Venue',
      locTown: 'Manchester',
      offers: { price: 0 },
      _isRecurring: true,
      _recurrenceFrequency: 'Weekly',
    };

    const card = buildEventCard(event, 0, {
      recurringLabelMode: 'main',
      dateText: () => 'Fri 12 Sep',
    });

    expect(card.querySelector('.name')?.textContent).toBe('Weekend Gathering');
    expect(card.querySelector('.location')?.textContent).toBe('The Venue');
    expect(card.querySelector('.category.Active')?.textContent).toBe('Active');
    expect(card.querySelector('.category.audience')?.textContent).toBe('FLINTA');
    expect(card.querySelector('.category.multiday')?.textContent).toBe('Multi-day');
    expect(card.querySelector('.category.recurring')?.textContent).toBe('Weekly');
    expect(card.querySelector('.eventboxcta-primary')?.textContent).toBe('FREE');
    expect(card.querySelector('.eventboxcta-secondary')?.textContent).toBe('RSVP');
    expect(card.querySelector('a')?.getAttribute('href')).toBe('https://example.com/event');
  });

  it('omits optional badges when event metadata is absent', () => {
    const card = buildEventCard(
      {
        name: 'One-off Night',
        genre: 'Music',
        startDate: '2025-09-12',
        locName: 'Club',
        price: 8,
      },
      1,
      { dateText: () => 'Fri 12 Sep 20:00' },
    );

    expect(card.querySelector('.category.Music')?.textContent).toBe('Music');
    expect(card.querySelector('.category.audience')).toBeNull();
    expect(card.querySelector('.category.multiday')).toBeNull();
    expect(card.querySelector('.category.recurring')).toBeNull();
    expect(card.querySelector('.eventboxcta-primary')?.textContent).toBe('£8');
    expect(card.querySelector('.eventboxcta-secondary')).toBeNull();
  });
});
