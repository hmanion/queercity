import { expect, test } from '@playwright/test';

const fixedNowIso = '2025-09-11T12:00:00Z';

const outputFixture = [
  {
    name: 'Weekend Party',
    genre: 'Music',
    startDate: '2025-09-13T20:00:00',
    endDate: '2025-09-13T23:00:00',
    url: 'https://example.com/weekend-party',
    locName: 'Night Club',
    locTown: 'Manchester',
    keywords: 'dance',
  },
];

const directoryFixture = [
  {
    name: 'Today Recurring',
    genre: 'Active',
    frequency: 'Weekly',
    dayWeek: 'Thursday',
    startTime: '18:00',
    endTime: '19:30',
    url: 'https://example.com/today-recurring',
    locName: 'Gym Hall',
    locTown: 'Manchester',
    keywords: 'sport',
  },
  {
    name: 'Tomorrow Recurring',
    genre: 'Social',
    frequency: 'Weekly',
    dayWeek: 'Friday',
    startTime: '19:00',
    endTime: '21:00',
    url: 'https://example.com/tomorrow-recurring',
    locName: 'Cafe Space',
    locTown: 'Manchester',
    keywords: 'community',
  },
  {
    name: 'Later Recurring',
    genre: 'Arts',
    frequency: 'Weekly',
    dayWeek: 'Sunday',
    startTime: '14:00',
    endTime: '16:00',
    url: 'https://example.com/later-recurring',
    locName: 'Studio',
    locTown: 'Manchester',
    keywords: 'drawing',
  },
];

const pridesFixture = [
  {
    name: 'Manchester Pride',
    websiteUrl: 'https://example.com/manchester-pride',
    location: 'City Centre',
    borough: 'Manchester',
    startDate: '2025-09-20',
    endDate: '2025-09-21',
    eventCount: 3,
  },
  {
    name: 'Stockport Pride',
    websiteUrl: 'https://example.com/stockport-pride',
    location: 'Stockport',
    borough: 'Stockport',
    startDate: null,
    endDate: null,
    eventCount: 0,
  },
];

async function freezeTime(page) {
  await page.addInitScript((iso) => {
    const fixed = new Date(iso);
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixed.getTime());
          return;
        }
        super(...args);
      }
      static now() {
        return fixed.getTime();
      }
    }
    window.Date = MockDate;
  }, fixedNowIso);
}

async function mockStaticData(page) {
  await page.route('**/api/output.php*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(outputFixture) });
  });
  await page.route('**/api/directory.php*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(directoryFixture) });
  });
  await page.route('**/api/prides.php*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pridesFixture) });
  });
  await page.route('**/output.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(outputFixture) });
  });
  await page.route('**/directory.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(directoryFixture) });
  });
  await page.route('**/prides.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pridesFixture) });
  });
}

test.beforeEach(async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      pageErrors.push(new Error(msg.text()));
    }
  });
  pageErrorsRef.set(page, pageErrors);

  await freezeTime(page);
  await mockStaticData(page);
});

test.afterEach(async ({ page }) => {
  expect(pageErrorsRef.get(page) || []).toEqual([]);
});

const pageErrorsRef = new WeakMap();

test('homepage renders sections and preserves recurring events in Today/Tomorrow by design', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#category-filter-bar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today (1)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tomorrow (1)' })).toBeVisible();
  await expect(page.locator('#section-today')).toContainText('Today Recurring');
  await expect(page.locator('#section-tomorrow')).toContainText('Tomorrow Recurring');
  await expect(page.locator('#section-week')).not.toContainText('Later Recurring');

  await page.getByRole('button', { name: 'Recurring: Hidden' }).click();
  await expect(page.getByRole('button', { name: 'Recurring: Shown' })).toBeVisible();
  await expect(page.locator('#section-week')).toContainText('Later Recurring');
});

test('archive page loads without a recurring toggle', async ({ page }) => {
  await page.goto('/archive/');

  await expect(page.locator('#category-filter-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recurring: Hidden' })).toHaveCount(0);
});

test('weekdays page renders recurring events grouped by weekday', async ({ page }) => {
  await page.goto('/weekdays/');

  await expect(page.locator('#weekdaylist')).toContainText('Thursday');
  await expect(page.locator('#weekdaylist')).toContainText('Today Recurring');
  await expect(page.locator('#weekdaylist')).toContainText('Weekly');
});

test('prides page loads summary, filters, and map shell', async ({ page }) => {
  await page.goto('/prides/');

  await expect(page.locator('#prides-summary .prides-stat')).toHaveCount(4);
  await expect(page.locator('#prides-filter-bar select')).toHaveCount(2);
  await expect(page.locator('#prides-map svg')).toBeVisible();
  await expect(page.locator('#prides-map [data-borough]')).toHaveCount(10);
  await expect(page.locator('#prides-list')).toContainText('Manchester Pride');

  await page.locator('#borough-manchester').hover();
  await expect(page.locator('#prides-map-tooltip')).toContainText('Manchester: 1 pride');

  await page.locator('#borough-manchester').click();
  await expect(page.locator('#prides-borough-panel')).toContainText('Manchester Pride');

  await expect(page.locator('#borough-tameside')).toHaveAttribute('aria-disabled', 'true');
  await page.locator('#borough-tameside').hover();
  await expect(page.locator('#prides-map-tooltip')).toContainText('Tameside: No Pride listed this year.');
});
