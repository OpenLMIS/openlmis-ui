import { expect } from '@playwright/test';
import { test } from './browser-fixtures';
import { enqueue, records } from './device-fixtures';
import { generation, login, stub } from './fixtures';

test('without Web Locks online reads and local drafts work but downloads and uploads stay disabled', async ({
  context,
  page,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
  });
  await stub(context, async () => 'finish');
  let posts = 0;
  await context.route('**/api/stockEvents', (route) => {
    posts++;
    return route.abort();
  });
  await login(page);
  await expect(page.getByRole('cell', { name: 'Fixture Medicines', exact: true })).toBeVisible();
  await expect(page.getByText('Offline Download Unavailable', { exact: true })).toBeVisible();
  expect(await generation(page)).toBeNull();
  await page.goto('./stock-management/adjustments/program');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: /^Quantity, Fixture Product/ }).fill('3');
  await page.getByRole('combobox', { name: /^Reason, Fixture Product/ }).click();
  await page.getByRole('option', { name: 'Damaged', exact: true }).click();
  await expect(page.getByRole('note').filter({ hasText: 'Saved on this device' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Signature', exact: true }).fill('No Locks');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page).toHaveURL(/adjustments$/);
  await page.goto('./stock-management/device-events');
  await expect(page.getByRole('table')).toContainText('Queued');
  await expect(page.getByText('Automatic Sync Unavailable', { exact: true })).toBeVisible();
  await page.reload();
  expect(await records(page, 'stockEventQueue')).toHaveLength(1);
  expect(await generation(page)).toBeNull();
  expect(posts).toBe(0);
});

test('sign-out and a different sign-in isolate device work and the original owner recovers it', {
  tag: '@offline-shell',
}, async ({ context, page }) => {
  await stub(context, async () => 'finish');
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.waitForFunction(async () =>
    Boolean(
      await (await caches.open('openlmis-ui-locales')).match(
        new URL('/v2/locales/en.json', location.origin),
      ),
    ),
  );
  await context.setOffline(true);
  await expect(page.getByRole('note').filter({ hasText: "You're Offline" })).toBeVisible();
  await enqueue(page, [{ signature: 'Private Original Signature' }]);
  await page.getByRole('button', { name: 'Account Menu' }).click();
  await page.getByRole('menuitem', { name: 'Log Out', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Sign Out', exact: true })
    .click();
  await expect(page).toHaveURL(/login/);
  await context.setOffline(false);
  await stub(context, async () => 'finish', undefined, 'other-user');
  await login(page, 'other-user');
  await page.goto('./stock-management/device-events');
  await expect(page.getByText('No Device Events', { exact: true })).toBeVisible();
  const storage = await page.evaluate(async () => ({
    names: (await indexedDB.databases()).map((db) => db.name),
    local: JSON.stringify(localStorage),
  }));
  expect(storage.names.some((name) => name?.endsWith(':other-user'))).toBe(true);
  expect(storage.names.some((name) => name?.endsWith(':download-user'))).toBe(true);
  expect(storage.local).not.toContain('Private Original Signature');
  expect(storage.local).not.toContain('Fixture Product');
  expect(storage.local).not.toContain('STOCK_ADJUST');
  expect(await records(page, 'stockEventQueue')).toHaveLength(1);
  await page.getByRole('button', { name: 'Account Menu' }).click();
  await page.getByRole('menuitem', { name: 'Log Out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await stub(context, async () => 'finish');
  let posts = 0;
  await context.route('**/api/stockEvents', (route) => {
    posts++;
    return route.fulfill({ status: 201, json: '11111111-1111-4111-8111-111111111111' });
  });
  await login(page);
  await page.goto('./stock-management/device-events');
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(1);
  expect(posts).toBe(1);
  expect((await records(page, 'stockEventDrafts'))[0].signature).toBe('Private Original Signature');
});
