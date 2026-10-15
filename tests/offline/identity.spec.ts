import { expect } from '@playwright/test';
import { test } from './browser-fixtures';
import { enqueue, records } from './device-fixtures';
import { generation, login, stub } from './fixtures';

test.beforeEach(async ({ context }) => {
  await stub(context, async () => 'finish');
  await context.route('**/api/users/download-user/permissionStrings', (route) =>
    route.fulfill({
      json: ['STOCK_ADJUST|home|program', 'STOCK_CARDS_VIEW|home|program', 'USERS_MANAGE'],
    }),
  );
  await context.route('**/api/stockEvents', (route) => route.abort());
});

test('offline shell disables server navigation and blocks direct routes without protected requests', {
  tag: '@offline-shell',
}, async ({ page, context, channel, browser }) => {
  test.skip(
    channel === 'chrome' && browser.version().startsWith('152.'),
    'Chrome 152 offline emulation resets navigator.onLine after worker navigation; see FM-165 stage 9 diagnostics.',
  );
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
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  const protectedRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/users') protectedRequests.push(request.url());
  });
  const issue = page.getByRole('button', { name: 'Issue', exact: true });
  await expect(issue).toBeDisabled();
  await issue.click({ force: true });
  await expect(page).toHaveURL(/adjustments$/);
  await page.keyboard.press('Control+k');
  const option = page.getByRole('option', { name: /Users/ });
  await expect(option).toHaveAttribute('aria-disabled', 'true');
  await expect(option).toContainText('Connect to open this page.');
  await page.getByRole('combobox').fill('Users');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/adjustments$/);
  await page.keyboard.press('Escape');
  await page.goto('./administration/users');
  await expect(page.getByRole('heading', { name: 'Connect To Open This Page' })).toBeVisible();
  expect(protectedRequests).toHaveLength(0);
  await context.setOffline(false);
  await page.goto('./home');
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /^(Home|Welcome.*)$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add User', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
});

test('logout gives one retained-work warning offline and online and retains the queue after sign-out', {
  tag: '@offline-shell',
}, async ({ page, context }) => {
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
  await enqueue(page, [{ signature: 'Retain Me' }]);
  await page.reload();
  for (const offline of [true, false]) {
    await context.setOffline(offline);
    await page.getByRole('button', { name: 'Account Menu' }).click();
    await page.getByRole('menuitem', { name: 'Log Out' }).click();
    const warning = page.getByRole('alertdialog');
    await expect(warning).toContainText('saved only on this device');
    await expect(warning).toContainText('sign in again as this user');
    await expect(warning).toHaveCount(1);
    await warning.getByRole('button', { name: 'Stay Signed In' }).click();
  }
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Account Menu' }).click();
  await page.getByRole('menuitem', { name: 'Log Out' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Sign Out', exact: true })
    .click();
  await expect(page).toHaveURL(/login/);
  expect(await records(page, 'stockEventQueue')).toHaveLength(1);
});

test('offline expiry keeps editor drafts usable through reload and resumes only after same-user renewal', {
  tag: '@offline-shell',
}, async ({ page, context, channel, browser }) => {
  test.skip(
    channel === 'chrome' && browser.version().startsWith('152.'),
    'Chrome 152 offline emulation resets navigator.onLine after worker navigation; see FM-165 stage 9 diagnostics.',
  );
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
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Wait For Renewal' }]);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('login-data-storage') ?? '{}');
    saved.state.expired = true;
    localStorage.setItem('login-data-storage', JSON.stringify(saved));
  });
  await page.goto('./stock-management/adjustments/program');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'HOME - Fixture Clinic - Fixture Medicines' }),
  ).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'Sign In To Sync' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Product', exact: true })).toHaveValue(
    'Fixture Product',
  );
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect
    .poll(async () =>
      (await records(page, 'stockEventDrafts')).some((row) => row.state === 'editing'),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByRole('table')).toContainText('Fixture Product');
  let posts = 0;
  await context.route('**/api/stockEvents', async (route) => {
    posts += 1;
    await route.fulfill({ status: 201, json: '11111111-1111-4111-8111-111111111111' });
  });
  await context.setOffline(false);
  const renewal = page.getByRole('dialog');
  await expect(renewal).toBeVisible();
  expect(posts).toBe(0);
  await renewal.getByLabel('Password', { exact: true }).fill('fixture-password');
  await renewal.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(renewal).toHaveCount(0);
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(1);
  expect(posts).toBe(1);
  await expect(page.getByRole('table')).toContainText('Fixture Product');
});
