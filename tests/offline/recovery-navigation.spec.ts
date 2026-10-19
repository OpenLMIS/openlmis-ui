import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './browser-fixtures';
import { enqueue, records } from './device-fixtures';
import { generation, login, stub } from './fixtures';

const catalog = JSON.parse(
  await readFile(new URL('../../public/locales/en.json', import.meta.url), 'utf8'),
);

test('copying a refusal replaces its dialog entry and Back returns to the device list', async ({
  page,
  context,
}) => {
  await stub(context, async () => 'finish');
  let posts = 0;
  await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
    posts++;
    await route.fulfill({
      status: 400,
      json: { messageKey: 'stockmanagement.error.event.invalid', message: 'Fixture refusal' },
    });
  });
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Correction navigation' }]);
  await context.setOffline(false);
  await expect.poll(async () => (await records(page, 'stockEventSyncErrors')).length).toBe(1);
  await page.goto('./offline-events');
  await page.locator('tbody button[aria-haspopup=menu]').click();
  await page
    .getByRole('menuitem', { name: catalog['device-events.review-event'], exact: true })
    .click();
  await expect(page).toHaveURL(/offline-events\?event=/);
  await page.getByRole('dialog').getByRole('button', { name: 'Copy For Correction' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Copy For Correction' }).click();
  await expect(page).toHaveURL(/\/stock-management\/adjustments\/program$/);
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
  await page.goBack();
  await expect(page).toHaveURL(/\/offline-events$/);
  await expect(
    page.getByRole('heading', { name: catalog['device-events.title'], exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(posts).toBe(1);
});
