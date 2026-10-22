import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
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
      json: {
        messageKey: 'stockmanagement.error.event.invalid',
        message: 'Fixture refusal',
        internal: 'secret-debug-value',
      },
    });
  });
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Correction navigation' }]);
  await context.setOffline(false);
  await expect.poll(async () => (await records(page, 'stockEventSyncErrors')).length).toBe(1);
  await page.goto('./offline-events?tab=errors');
  await page.locator('tbody button[aria-haspopup=menu]').click();
  await page
    .getByRole('menuitem', { name: catalog['offline-events.review-event'], exact: true })
    .click();
  await expect(page).toHaveURL(/offline-events\?tab=errors&event=/);
  await expect(page.getByRole('dialog')).toContainText('Fixture refusal');
  await expect(page.getByRole('dialog')).not.toContainText('secret-debug-value');
  await page.getByRole('dialog').getByRole('button', { name: 'Copy For Correction' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Copy For Correction' }).click();
  await expect(page).toHaveURL(/\/stock-management\/adjustments\/program$/);
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
  await page.goBack();
  await expect(page).toHaveURL(/\/offline-events\?tab=errors$/);
  await expect(
    page.getByRole('heading', { name: catalog['offline-events.title'], exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(posts).toBe(1);
});

test('Arabic phone navigation keeps /v2 and palette focus after the offline dialog', async ({
  page,
  context,
}) => {
  const labels = JSON.parse(await readFile('public/locales/ar.json', 'utf8'));
  await page.setViewportSize({ width: 390, height: 844 });
  await stub(context, async () => 'finish');
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await waitForOfflineShell(page);
  await page.evaluate(() => localStorage.setItem('i18nextLng', 'ar'));
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Pending navigation' }]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('img', { name: new RegExp(labels['offline.title']) })).toBeVisible();
  await page
    .getByRole('note')
    .getByRole('link', { name: labels['offline-events.title'], exact: true })
    .click();
  await expect(page).toHaveURL(/\/v2\/offline-events$/);
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox');
  await input.fill(labels['nav.stock-management.issue']);
  await page.keyboard.press('ArrowDown');
  const issue = page.getByRole('option', {
    name: labels['nav.stock-management.issue'],
    exact: true,
  });
  await expect(issue).toHaveAttribute('aria-describedby');
  await page.keyboard.press('Enter');
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: labels['dialog.close'], exact: true })
    .click();
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(/\/v2\/offline-events$/);
});

test('a retained server page has an offline heading and restores its field focus on reconnect', async ({
  page,
  context,
}) => {
  await stub(context, async () => 'finish');
  await login(page);
  await page.goto('./profile');
  const field = page.getByRole('textbox', { name: 'First Name', exact: true });
  await field.fill('Retained');
  await field.focus();
  await context.setOffline(true);
  await expect(
    page.getByRole('heading', { level: 1, name: catalog['offline.page-title'], exact: true }),
  ).toBeFocused();
  await expect(field).not.toBeVisible();
  await context.setOffline(false);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Retained');
});

test('reconnect restores focus inside a retained page dialog', async ({ page, context }) => {
  await stub(context, async () => 'finish');
  await login(page);
  await page.goto('./profile?dialog=password');
  const field = page.getByRole('textbox', { name: 'Confirm New Password', exact: true });
  await field.fill('Fixture confirmation');
  await field.focus();
  await context.setOffline(true);
  await expect(
    page.getByRole('heading', { level: 1, name: catalog['offline.page-title'], exact: true }),
  ).toBeFocused();
  await context.setOffline(false);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Fixture confirmation');
});
