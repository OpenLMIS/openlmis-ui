import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
import { records } from './device-fixtures';
import { login, stub } from './fixtures';

const home = '11111111-1111-4111-8111-111111111111';
const program = '22222222-2222-4222-8222-222222222222';

test('offline Receive queues a typed new lot inside the event without posting', {
  tag: '@offline-shell',
}, async ({ persistentContext, channel, browser }) => {
  test.skip(
    channel === 'chrome' && browser.version().startsWith('152.'),
    'Chrome 152 offline emulation resets navigator.onLine after worker navigation.',
  );
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-offline-receive-'));
  const context = await persistentContext(directory);
  let posts = 0;
  try {
    await stub(context, async () => 'finish', { home, program });
    await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
      if (route.request().method() === 'POST') posts++;
      await route.abort();
    });
    const page = context.pages()[0];
    await login(page);
    for (const table of ['homeStockDownloads', 'receiveCatalogDownloads']) {
      await expect
        .poll(async () =>
          (await records(page, table)).some((row) => row.programId === program && row.generation),
        )
        .toBe(true);
    }
    await waitForOfflineShell(page);
    await context.setOffline(true);
    await page.goto('./stock-management/receive');
    const receive = page
      .getByRole('row')
      .filter({ hasText: 'Fixture Medicines' })
      .getByRole('link', { name: 'Make Receive' });
    await expect(receive).toBeEnabled();
    await expect(receive).not.toHaveAttribute('aria-disabled', 'true');
    await receive.click();
    const product = page.getByRole('combobox', { name: 'Product', exact: true });
    await product.fill('Vacc');
    await page.getByRole('option', { name: /Fixture Vaccine/ }).click();
    await page.getByRole('combobox', { name: 'Lot Code', exact: true }).click();
    await page.getByRole('option', { name: 'Add New Lot', exact: true }).click();
    await page.getByRole('textbox', { name: 'New Lot Code', exact: true }).fill('NEW-1');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('textbox', { name: /^Quantity, Fixture Vaccine/ }).fill('5');
    await page.getByRole('combobox', { name: /^Received From, Fixture Vaccine/ }).click();
    await page.getByRole('option', { name: 'Fixture Supplier', exact: true }).click();
    await page.getByRole('button', { name: 'Submit Offline', exact: true }).click();
    await page.getByRole('textbox', { name: 'Signature', exact: true }).fill('Fixture User');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
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
    const [event] = await records(page, 'stockEventQueue');
    expect(event.payload).toMatchObject({
      eventOrigin: 'RECEIVE',
      lineItems: [
        {
          orderableId: 'vaccine',
          lot: { lotCode: 'NEW-1' },
          sourceId: 'supplier-node',
          quantity: 5,
        },
      ],
    });
    const { lineItems } = event.payload as { lineItems: unknown[] };
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]).not.toHaveProperty('lotId');
    expect(event.payload).not.toHaveProperty('documentNumber');
    expect(posts).toBe(0);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
