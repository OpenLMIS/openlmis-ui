import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { generation, login, stub } from './fixtures';

for (const offline of [true, false]) {
  test(`${offline ? 'offline' : 'connected'} Submit queues without POST and survives persistent restart`, async () => {
    const directory = await mkdtemp(resolve('.offline/profile-stage-6-'));
    let context = await chromium.launchPersistentContext(directory, {
      headless: true,
      serviceWorkers: 'allow',
    });
    let posts = 0;
    try {
      await stub(context, async () => 'finish');
      await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
        if (route.request().method() === 'POST') posts++;
        await route.abort();
      });
      let page = context.pages()[0];
      await login(page);
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
      await page.goto('http://127.0.0.1:9165/v2/stock-management/device-events');
      await expect(page.getByRole('heading', { name: 'Device Events', exact: true })).toBeVisible();
      await page.goto('http://127.0.0.1:9165/v2/stock-management/adjustments/program');
      if (offline) await context.setOffline(true);
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByRole('textbox', { name: /^Quantity, Fixture Product/ }).fill('12');
      await page.getByRole('combobox', { name: /^Reason, Fixture Product/ }).click();
      await page.getByRole('option', { name: 'Damaged', exact: true }).click();
      await page
        .getByRole('button', { name: offline ? 'Submit Offline' : 'Submit', exact: true })
        .click();
      await page.getByRole('textbox', { name: 'Signature', exact: true }).fill('Fixture User');
      await page.getByRole('button', { name: 'Confirm', exact: true }).dblclick();
      await expect(page).toHaveURL(/\/adjustments$/);
      await expect(page.getByText('Saved On This Device', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('note').filter({ hasText: '1 Event Waiting To Sync' }),
      ).toBeVisible();
      expect(posts).toBe(0);
      await context.close();
      context = await chromium.launchPersistentContext(directory, {
        headless: true,
        serviceWorkers: 'allow',
        offline: true,
      });
      await stub(context, async () => 'finish');
      await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
        if (route.request().method() === 'POST') posts++;
        await route.abort();
      });
      page = context.pages()[0];
      await page.goto('http://127.0.0.1:9165/v2/stock-management/device-events');
      await expect(page.getByRole('heading', { name: 'Device Events', exact: true })).toBeVisible();
      await expect(page.getByRole('table')).toContainText('Fixture Product');
      await expect(page.getByRole('table')).toContainText('Fixture Clinic');
      await expect(page.getByRole('table')).toContainText('Queued');
      await expect(
        page.getByRole('note').filter({ hasText: '1 Event Waiting To Sync' }),
      ).toBeVisible();
      expect(posts).toBe(0);
    } finally {
      await context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
