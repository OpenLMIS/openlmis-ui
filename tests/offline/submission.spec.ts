import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
import { generation, login, stub } from './fixtures';

const catalog = JSON.parse(await readFile('public/locales/en.json', 'utf8'));

test('offline Submit retains its committed event through persistent restart', {
  tag: '@offline-shell',
}, async ({ persistentContext, channel, browser }) => {
  test.skip(
    channel === 'chrome' && browser.version().startsWith('152.'),
    'Chrome 152 offline emulation resets navigator.onLine after worker navigation.',
  );
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-offline-6-'));
  let context = await persistentContext(directory);
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
    await waitForOfflineShell(page);
    await context.setOffline(true);
    await page.goto('./offline-events');
    await expect(
      page.getByRole('heading', { name: catalog['offline-events.title'], exact: true }),
    ).toBeVisible();
    await page.goto('./stock-management/adjustments/program');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('textbox', { name: /^Quantity, Fixture Product/ }).fill('12');
    await page.getByRole('combobox', { name: /^Reason, Fixture Product/ }).click();
    await page.getByRole('option', { name: 'Damaged', exact: true }).click();
    await page.getByRole('button', { name: 'Submit Offline', exact: true }).click();
    await page.getByRole('textbox', { name: 'Signature', exact: true }).fill('Fixture User');
    await page.getByRole('button', { name: 'Confirm', exact: true }).dblclick();
    await expect(page).toHaveURL(/\/stock-management\/stock-on-hand\?/);
    await expect(
      page
        .getByRole('region', { name: 'Notifications alt+T' })
        .getByText('Event Queued', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-slot=sidebar-menu-badge]')).toHaveText('1');
    expect(posts).toBe(0);
    await context.close();
    context = await persistentContext(directory, true);
    await stub(context, async () => 'finish');
    await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
      if (route.request().method() === 'POST') posts++;
      await route.abort();
    });
    page = context.pages()[0];
    await page.goto('./offline-events');
    await expect(
      page.getByRole('heading', { name: catalog['offline-events.title'], exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toContainText('Fixture Medicines');
    await expect(page.getByRole('table')).toContainText(catalog['offline-events.status-queued']);
    await expect(page.locator('[data-slot=sidebar-menu-badge]')).toHaveText('1');
    expect(posts).toBe(0);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('connected acceptance shows submitted confirmation and restores the facility/program Stock on Hand landing', async ({
  context,
  page,
}) => {
  const home = '22222222-2222-4222-8222-222222222222';
  const program = '33333333-3333-4333-8333-333333333333';
  await stub(context, async () => 'finish', { home, program });
  const posts: Record<string, unknown>[] = [];
  let answer!: () => Promise<void>;
  await context.route('**/api/stockEvents', async (route) => {
    posts.push(route.request().postDataJSON());
    await new Promise<void>((resolve) => {
      answer = async () => {
        await route.fulfill({ status: 201, json: '11111111-1111-4111-8111-111111111111' });
        resolve();
      };
    });
  });
  await login(page);
  await expect(page).toHaveURL(/\/stock-management\/adjustments$/);
  await page.goto(`./stock-management/adjustments/${program}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: /^Quantity, Fixture Product/ }).fill('1');
  await page.getByRole('combobox', { name: /^Reason, Fixture Product/ }).click();
  await page.getByRole('option', { name: 'Damaged', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Signature', exact: true }).fill('Fixture User');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).not.toHaveProperty('documentNumber');
  await expect(page).toHaveURL(new RegExp(`/adjustments/${program}$`));
  await expect(
    page
      .getByRole('region', { name: 'Notifications alt+T' })
      .getByText('Saved On This Device', { exact: true }),
  ).not.toBeVisible();
  await answer();
  await expect(page).toHaveURL(
    new RegExp(`stock-on-hand.*facilityId=${home}.*programId=${program}`),
  );
  await expect(
    page
      .getByRole('region', { name: 'Notifications alt+T' })
      .getByText('Adjustment Submitted', { exact: true }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
});
