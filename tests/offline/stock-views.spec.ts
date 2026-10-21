import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
import { records } from './device-fixtures';
import { login, stub } from './fixtures';

const home = '11111111-1111-4111-8111-111111111111';
const program = '22222222-2222-4222-8222-222222222222';
const selection = `?mode=my&facilityId=${home}&programId=${program}`;
const plain = (message: string) => message.replace(/<\/?strong>/g, '');
const history = {
  id: 'card',
  facility: { id: home, code: 'HOME', name: 'Fixture Clinic' },
  program: { id: program, code: 'P', name: 'Fixture Medicines' },
  orderable: {
    id: 'product',
    productCode: 'MED',
    fullProductName: 'Fixture Product',
    netContent: 10,
  },
  lot: null,
  active: true,
  stockOnHand: 20,
  lineItems: [
    {
      id: 'line',
      occurredDate: '2026-01-01',
      quantity: 20,
      stockOnHand: 20,
      eventOrigin: 'ADJUSTMENT',
      documentNumber: 'SAVED-HISTORY-1',
      username: 'Fixture Author',
      source: { name: 'Fixture Warehouse' },
    },
  ],
};

for (const language of ['en', 'ar']) {
  test(`home stock and viewed history survive an offline browser restart (${language})`, {
    tag: '@offline-shell',
  }, async ({ persistentContext }) => {
    const labels = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
    const directory = await mkdtemp(join(tmpdir(), 'openlmis-stock-views-'));
    let context = await persistentContext(directory);
    try {
      await stub(context, async () => 'finish', { home, program });
      await context.route('**/api/stockCards/card', (route) => route.fulfill({ json: history }));
      let page = context.pages()[0];
      await login(page);
      await expect
        .poll(async () =>
          (await records(page, 'homeStockDownloads')).some((row) => row.programId === program),
        )
        .toBe(true);
      await page.goto('./stock-management/stock-on-hand/card');
      await expect(page.getByText('SAVED-HISTORY-1', { exact: true })).toBeVisible();
      await expect.poll(async () => (await records(page, 'stockCardHistory')).length).toBe(1);
      await waitForOfflineShell(page);
      await page.evaluate((language) => localStorage.setItem('i18nextLng', language), language);
      await context.close();
      context = await persistentContext(directory, true);
      page = context.pages()[0];
      const stockRequests: string[] = [];
      page.on('request', (request) => {
        if (/\/api\/(stockCards|v2\/stockCardSummaries|orderables|lots)/.test(request.url()))
          stockRequests.push(request.url());
      });
      await page.goto(`./stock-management/stock-on-hand${selection}`);
      await expect(page.getByText('Fixture Product', { exact: true }).first()).toBeVisible();
      const snapshot = page
        .getByRole('note')
        .filter({ hasText: plain(labels['stock-on-hand.offline-snapshot']) });
      await expect(snapshot).toBeVisible();
      await expect(
        snapshot.getByText(language === 'ar' ? /^تم التنزيل في / : /^Downloaded /),
      ).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByText('Fixture Product', { exact: true }).first()).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('./stock-management/stock-on-hand/card');
      await expect(page.getByText('SAVED-HISTORY-1', { exact: true })).toBeVisible();
      await expect(page.getByText('Fixture Author', { exact: true })).toBeVisible();
      await expect(page.getByText('Fixture Warehouse', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('note').getByText(plain(labels['stock-card.offline-history']), {
          exact: true,
        }),
      ).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByText('SAVED-HISTORY-1', { exact: true })).toBeVisible();
      await page.goto('./stock-management/stock-on-hand/missing');
      await expect(
        page.getByText(labels['offline.notice-title'], { exact: true }).first(),
      ).toBeVisible();
      await page.goto(
        `./stock-management/stock-on-hand?mode=my&facilityId=${home}&programId=33333333-3333-4333-8333-333333333333`,
      );
      await expect(
        page.getByRole('heading', { name: labels['offline.unavailable-title'], exact: true }),
      ).toBeVisible();
      expect(stockRequests).toEqual([]);
    } finally {
      await context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
