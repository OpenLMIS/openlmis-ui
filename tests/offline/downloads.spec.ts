import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const programs = ['program', 'never'].map((id) => ({
  id,
  code: id,
  name: id === 'program' ? 'Fixture Medicines' : 'Never Downloaded',
  active: true,
}));
async function stub(context: BrowserContext, stock: () => Promise<'finish' | 'fail'>) {
  await context.route('**/api{,/**,?*}', async (route) => {
    const url = new URL(route.request().url());
    const fixtures: Record<string, unknown> = {
      '/api/oauth/token': {
        referenceDataUserId: 'download-user',
        username: 'download-user',
        access_token: 'fixture-token',
        expires_in: 1800,
      },
      '/api/users/download-user/permissionStrings': programs.flatMap(({ id }) => [
        `STOCK_ADJUST|home|${id}`,
        `STOCK_CARDS_VIEW|home|${id}`,
      ]),
      '/api/users/download-user': {
        id: 'download-user',
        username: 'download-user',
        firstName: 'Download',
        lastName: 'User',
        active: true,
        homeFacilityId: 'home',
        roleAssignments: [],
      },
      '/api/users/download-user/programs': programs,
      '/api/facilities/home': {
        id: 'home',
        code: 'HOME',
        name: 'Fixture Clinic',
        active: true,
        enabled: true,
        type: { id: 'type', code: 'CLINIC', name: 'Clinic' },
        geographicZone: { id: 'zone', code: 'ZONE', name: 'Zone', level: { name: 'District' } },
        supportedPrograms: programs.map((program) => ({
          ...program,
          supportActive: true,
          supportLocallyFulfilled: true,
        })),
      },
      '/api/orderables/search': {
        content: [
          {
            id: 'product',
            productCode: 'MED',
            fullProductName: 'Fixture Product',
            description: null,
            netContent: 10,
            meta: { versionNumber: 1 },
          },
        ],
        totalPages: 1,
      },
      '/api/validReasons': [
        {
          hidden: false,
          reason: {
            id: 'reason',
            name: 'Damaged',
            reasonType: 'DEBIT',
            reasonCategory: 'ADJUSTMENT',
            isFreeTextAllowed: true,
            tags: [],
          },
        },
      ],
    };
    if (url.pathname === '/api/v2/stockCardSummaries') {
      if (url.searchParams.get('programId') === 'never')
        return route.fulfill({ status: 503, json: { message: 'Unavailable program' } });
      if ((await stock()) === 'fail') return route.abort('timedout');
      return route
        .fulfill({
          json: {
            content: [
              {
                orderable: { id: 'product', versionNumber: 1 },
                canFulfillForMe: [
                  {
                    stockCard: { id: 'card' },
                    orderable: { id: 'product' },
                    lot: null,
                    stockOnHand: 20,
                  },
                ],
              },
            ],
            totalPages: 1,
          },
        })
        .catch(() => undefined);
    }
    return route.fulfill(
      url.pathname in fixtures ? { json: fixtures[url.pathname] } : { status: 404, json: {} },
    );
  });
  await context.route('**/localeSettings{,/**,?*}', (route) =>
    route.fulfill({ json: { timeZoneId: 'UTC' } }),
  );
}
async function login(page: Page) {
  await page.goto('http://127.0.0.1:9165/v2/login?redirect=%2Fstock-management%2Fadjustments');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('download-user');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}
async function generation(page: Page) {
  return page.evaluate(async () => {
    const name = (await indexedDB.databases()).find((db) =>
      db.name?.endsWith(':download-user'),
    )?.name;
    if (!name) return null;
    return new Promise<string | null>((resolve) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        const db = request.result;
        const read = db
          .transaction('adjustmentDownloads')
          .objectStore('adjustmentDownloads')
          .get(['home', 'program']);
        read.onsuccess = () => {
          db.close();
          resolve(read.result?.generation ?? null);
        };
      };
    });
  });
}

test('held and failed background downloads allow sign-in and navigation', async ({
  page,
  context,
}) => {
  let release!: (value: 'finish' | 'fail') => void;
  const held = new Promise<'finish' | 'fail'>((resolve) => {
    release = resolve;
  });
  await stub(context, () => held);
  await login(page);
  await expect(page.getByRole('cell', { name: 'Fixture Medicines', exact: true })).toBeVisible();
  await expect(
    page.getByRole('note').filter({ hasText: 'Fetching the necessary data for offline' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).first().click();
  await expect(page).toHaveURL(/\/home$/);
  release('fail');
  await expect(
    page.getByRole('note').filter({ hasText: 'Offline Download Incomplete' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});

test('complete bundle survives persistent-context restart offline and missing program shows download notice', async () => {
  const directory = await mkdtemp(resolve('.offline/profile-stage-4-'));
  let context = await chromium.launchPersistentContext(directory, {
    headless: true,
    serviceWorkers: 'allow',
  });
  try {
    await stub(context, async () => 'finish');
    let page = context.pages()[0];
    await login(page);
    await expect(page.getByText('Ready Offline', { exact: true })).toBeVisible();
    await expect.poll(() => generation(page)).not.toBeNull();
    await page.waitForFunction(() =>
      navigator.serviceWorker.controller?.scriptURL.endsWith('/v2/sw.js'),
    );
    await page.waitForFunction(async () =>
      Boolean(
        await (await caches.open('openlmis-ui-locales')).match(
          new URL('/v2/locales/en.json', location.origin),
        ),
      ),
    );
    await context.close();
    context = await chromium.launchPersistentContext(directory, {
      headless: true,
      serviceWorkers: 'allow',
      offline: true,
    });
    page = context.pages()[0];
    await page.goto('http://127.0.0.1:9165/v2/stock-management/adjustments');
    await expect(page.getByText('Ready Offline', { exact: true })).toBeVisible();
    await expect(page.getByText('Not Downloaded', { exact: true })).toBeVisible();
    await page
      .getByRole('row')
      .filter({ hasText: 'Fixture Medicines' })
      .getByRole('link', { name: 'Make Adjustment' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'HOME - Fixture Clinic - Fixture Medicines', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Product', exact: true })).toHaveValue(
      'Fixture Product',
    );
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('combobox', { name: /Reason, Fixture Product/ })).toBeVisible();
    await page.goto('http://127.0.0.1:9165/v2/stock-management/adjustments/never');
    await expect(page.getByText('Connect To Download This Data', { exact: true })).toBeVisible();
    await expect(page.getByText('No Access', { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('bounded Axios timeouts stop the spinner with Retry and keep the prior bundle', async ({
  page,
  context,
}) => {
  let slow = false;
  await context.addInitScript(() => {
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      if ((window as unknown as { shortenTimeout?: boolean }).shortenTimeout) this.timeout = 40;
      return send.call(this, body);
    };
  });
  await stub(context, async () => {
    if (slow) await new Promise((resolve) => setTimeout(resolve, 250));
    return 'finish';
  });
  await login(page);
  await expect(page.getByText('Ready Offline', { exact: true })).toBeVisible();
  const previous = await generation(page);
  slow = true;
  await page.evaluate(() => {
    (window as unknown as { shortenTimeout: boolean }).shortenTimeout = true;
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await expect(page.getByRole('note').filter({ hasText: 'The download timed out.' })).toBeVisible();
  await expect(
    page.getByRole('note').filter({ hasText: 'Fetching the necessary data for offline' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  expect(await generation(page)).toBe(previous);
});

test('another tab observes the batch and does not duplicate held stock reads', async ({
  page,
  context,
}) => {
  let release!: (value: 'finish' | 'fail') => void;
  let stockReads = 0;
  const held = new Promise<'finish' | 'fail'>((resolve) => {
    release = resolve;
  });
  await stub(context, () => {
    stockReads += 1;
    return held;
  });
  await login(page);
  await expect(
    page.getByRole('note').filter({ hasText: 'Fetching the necessary data for offline' }),
  ).toBeVisible();
  await expect.poll(() => stockReads).toBe(1);
  const other = await context.newPage();
  await other.goto('http://127.0.0.1:9165/v2/stock-management/adjustments');
  await expect(other.getByRole('cell', { name: 'Fixture Medicines', exact: true })).toBeVisible();
  await expect(
    other.getByRole('note').filter({ hasText: 'Fetching the necessary data for offline' }),
  ).toBeVisible();
  expect(stockReads).toBe(1);
  release('finish');
  await expect(other.getByText('Ready Offline', { exact: true })).toBeVisible();
  await expect(
    other.getByRole('note').filter({ hasText: 'Offline Download Incomplete' }),
  ).toBeVisible();
  expect(stockReads).toBe(1);
});
