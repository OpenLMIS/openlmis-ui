import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { generation, login, stub } from './fixtures';

for (const offline of [true, false]) {
  test(`${offline ? 'offline' : 'connected'} Submit retains its committed event through persistent restart`, async () => {
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
      expect(posts).toBe(offline ? 0 : 1);
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
      await expect(page.getByRole('table')).toContainText(offline ? 'Queued' : 'Uncertain');
      await expect(
        page.getByRole('note').filter({ hasText: '1 Event Waiting To Sync' }),
      ).toBeVisible();
      expect(posts).toBe(offline ? 0 : 1);
    } finally {
      await context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('connected acceptance shows Synced and restores the facility/program Stock on Hand landing', async ({
  context,
  page,
}) => {
  const home = '22222222-2222-4222-8222-222222222222';
  const program = '33333333-3333-4333-8333-333333333333';
  await stub(context, async () => 'finish', { home, program });
  let posts = 0;
  let answer!: () => Promise<void>;
  await context.route('**/api/stockEvents', async (route) => {
    posts++;
    expect(route.request().postDataJSON()).not.toHaveProperty('documentNumber');
    await new Promise<void>((resolve) => {
      answer = async () => {
        await route.fulfill({ status: 201, json: '11111111-1111-4111-8111-111111111111' });
        resolve();
      };
    });
  });
  await login(page);
  await expect(page).toHaveURL(/\/stock-management\/adjustments$/);
  await page.goto(`http://127.0.0.1:9165/v2/stock-management/adjustments/${program}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: /^Quantity, Fixture Product/ }).fill('1');
  await page.getByRole('combobox', { name: /^Reason, Fixture Product/ }).click();
  await page.getByRole('option', { name: 'Damaged', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Signature', exact: true }).fill('Fixture User');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => posts).toBe(1);
  await page.waitForTimeout(1800);
  await expect(page).toHaveURL(new RegExp(`/adjustments/${program}$`));
  await expect(page.getByText('Saved On This Device', { exact: true })).not.toBeVisible();
  await answer();
  await expect(page).toHaveURL(
    new RegExp(`stock-on-hand.*facilityId=${home}.*programId=${program}`),
  );
  await expect(page.getByText('Synced', { exact: true })).toBeVisible();
  expect(posts).toBe(1);
});
