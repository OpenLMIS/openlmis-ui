import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './browser-fixtures';
import { enqueue, records } from './device-fixtures';
import { generation, login, stub } from './fixtures';

const catalog = JSON.parse(
  await readFile(new URL('../../public/locales/en.json', import.meta.url), 'utf8'),
);

test('sign-out and a different sign-in isolate device work and the original owner recovers it', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await context.setOffline(true);
  await expect(page.getByRole('note').filter({ hasText: "You're Offline" })).toBeVisible();
  await enqueue(page, [{ signature: 'Private Original Signature' }]);
  await page.getByRole('button', { name: 'Account Menu' }).click();
  await page.getByRole('menuitem', { name: 'Log Out', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Log Out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('textbox', { name: 'Username', exact: true })).toBeVisible();
  await context.setOffline(false);
  await stub(context, async () => 'finish', undefined, 'other-user');
  await login(page, 'other-user');
  await page.goto('./offline-events');
  await expect(
    page.getByText(catalog['offline-events.no-events-title'], { exact: true }),
  ).toBeVisible();
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
  await expect(page.getByRole('textbox', { name: 'Username', exact: true })).toBeVisible();
  await stub(context, async () => 'finish');
  let posts = 0;
  await context.route('**/api/stockEvents', (route) => {
    posts++;
    return route.fulfill({ status: 201, json: '11111111-1111-4111-8111-111111111111' });
  });
  await login(page);
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(1);
  await page
    .getByRole('link', { name: catalog['offline-events.title'], exact: true })
    .first()
    .click();
  expect(posts).toBe(1);
  expect((await records(page, 'stockEventDrafts'))[0].signature).toBe('Private Original Signature');
});
