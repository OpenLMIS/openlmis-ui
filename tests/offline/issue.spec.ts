import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
import { records } from './device-fixtures';
import { login, stub } from './fixtures';

const home = '11111111-1111-4111-8111-111111111111';
const program = '22222222-2222-4222-8222-222222222222';
const catalog = JSON.parse(await readFile('public/locales/en.json', 'utf8'));

test('offline Issue retains its destination and queued event through persistent restart', {
  tag: '@offline-shell',
}, async ({ persistentContext, channel, browser }) => {
  test.skip(
    channel === 'chrome' && browser.version().startsWith('152.'),
    'Chrome 152 offline emulation resets navigator.onLine after worker navigation.',
  );
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-offline-issue-'));
  let context = await persistentContext(directory);
  let posts = 0;
  try {
    await stub(context, async () => 'finish', { home, program });
    await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
      if (route.request().method() === 'POST') posts++;
      await route.abort();
    });
    let page = context.pages()[0];
    await login(page);
    await expect
      .poll(async () =>
        (await records(page, 'homeStockDownloads')).some(
          (row) => row.programId === program && row.generation,
        ),
      )
      .toBe(true);
    await waitForOfflineShell(page);
    await context.setOffline(true);
    await page.goto('./offline-events');
    await expect(
      page.getByRole('heading', { name: catalog['offline-events.title'], exact: true }),
    ).toBeVisible();
    await page.goto('./stock-management/issue');
    const ready = page.getByRole('row').filter({ hasText: 'Fixture Medicines' });
    await expect(ready.getByRole('link', { name: 'Make Issue' })).toBeEnabled();
    await expect(ready.getByRole('link', { name: 'Make Issue' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page.getByRole('row').filter({ hasText: 'Never Downloaded' })).toContainText(
      'Not Downloaded',
    );
    await page.goto(`./stock-management/issue/${program}`);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('textbox', { name: /^Quantity, Fixture Product/ }).fill('5');
    await page.getByRole('combobox', { name: /^Issue To, Fixture Product/ }).click();
    await page.getByRole('option', { name: 'Fixture Ward', exact: true }).click();
    await page.getByRole('button', { name: 'Submit Offline', exact: true }).click();
    await page.getByRole('textbox', { name: 'Signature', exact: true }).fill('Fixture User');
    await page.getByRole('button', { name: 'Confirm', exact: true }).dblclick();
    await expect(page).toHaveURL(
      new RegExp(`stock-on-hand.*facilityId=${home}.*programId=${program}`),
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(
      page
        .getByRole('region', { name: 'Notifications alt+T' })
        .getByText('Event Queued', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-slot=sidebar-menu-badge]')).toHaveText('1');
    expect(posts).toBe(0);
    await context.close();
    context = await persistentContext(directory, true);
    await stub(context, async () => 'finish', { home, program });
    await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
      if (route.request().method() === 'POST') posts++;
      await route.abort();
    });
    page = context.pages()[0];
    await page.goto('./offline-events');
    await expect(
      page.getByRole('heading', { name: catalog['offline-events.title'], exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toContainText('Fixture Clinic');
    await expect(page.getByRole('table')).toContainText(catalog['offline-events.status-queued']);
    await expect(page.locator('[data-slot=sidebar-menu-badge]')).toHaveText('1');
    await expect(page.getByRole('table')).toContainText('Issue');
    const [event] = await records(page, 'stockEventQueue');
    expect(event.payload).toMatchObject({
      eventOrigin: 'ISSUE',
      lineItems: [{ destinationId: 'ward-node', quantity: 5 }],
    });
    expect(event.payload).not.toHaveProperty('documentNumber');
    expect(posts).toBe(0);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
