import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type BrowserContext, expect, type Page } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
import { records } from './device-fixtures';
import { login, stub } from './fixtures';

const listUrl = './stock-management/physical-inventory';
const editorUrl = `${listUrl}/program`;
const count = (page: Page, product: string) =>
  page.getByRole('textbox', { name: new RegExp(`^Current Stock, ${product}`) });
async function saved(page: Page) {
  await expect(page.getByText('Saved On This Device', { exact: true })).toBeVisible();
}

test('inventory counts and new lots survive offline restart and only explicit Save sends them', {
  tag: '@offline-shell',
}, async ({ persistentContext }) => {
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-offline-inventory-'));
  let context = await persistentContext(directory);
  const writes: { method: string; path: string; body: unknown }[] = [];
  const blocked: string[] = [];
  let allowSave = false;
  const fixtures = async (context: BrowserContext) => {
    await stub(context, async () => 'finish', {
      home: 'home',
      program: 'program',
      inventory: true,
    });
    await context.route('**/api{,/**,?*}', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      if (method === 'GET' || path === '/api/oauth/token' || path === '/api/orderables/search')
        return route.fallback();
      writes.push({ method, path, body: request.postDataJSON() });
      if (allowSave && method === 'POST' && path === '/api/lots')
        return route.fulfill({ json: { id: 'new-lot', ...request.postDataJSON() } });
      if (allowSave && method === 'PUT' && path === '/api/physicalInventories/inventory')
        return route.fulfill({ status: 204 });
      blocked.push(`${method} ${path}`);
      return route.abort('blockedbyclient');
    });
  };
  try {
    await fixtures(context);
    let page = context.pages()[0];
    await login(page, 'download-user', 'Fixture Medicines', '/stock-management/physical-inventory');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(count(page, 'Fixture Product')).toHaveValue('20');
    await saved(page);
    await expect
      .poll(async () => (await records(page, 'physicalInventoryReference')).length)
      .toBe(1);
    await waitForOfflineShell(page);
    await context.setOffline(true);
    await context.close();
    context = await persistentContext(directory, true);
    await fixtures(context);
    page = context.pages()[0];
    await page.goto(listUrl);
    await expect(page.getByText('Fixture Medicines', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Never Downloaded', { exact: true })).toBeVisible();
    await expect(page.getByText('Open this draft online first.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Continue', exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await page.waitForURL((url) => url.pathname.endsWith('/physical-inventory/program'));
    await page.reload();
    await expect(count(page, 'Fixture Product')).toHaveValue('20');
    await count(page, 'Fixture Product').fill('0012');
    await saved(page);
    await page.getByRole('button', { name: 'Add Product', exact: true }).click();
    const add = page.getByRole('dialog', {
      name: 'Add Products To Physical Inventory',
      exact: true,
    });
    await add.getByRole('combobox', { name: 'Product', exact: true }).fill('Second');
    await page.getByRole('option', { name: 'Second Product', exact: true }).click();
    await add.getByRole('combobox', { name: 'Lot Code', exact: true }).click();
    await page.getByRole('option', { name: 'Add New Lot', exact: true }).click();
    await add.getByRole('textbox', { name: 'New Lot Code', exact: true }).fill('OFFLINE-LOT');
    await add.getByRole('button', { name: 'Add', exact: true }).click();
    await add.getByRole('textbox', { name: /^Current Stock, Second Product/ }).fill('0');
    await add
      .getByRole('button', { name: 'Add 1 Item To Physical Inventory', exact: true })
      .click();
    await saved(page);
    await page.reload();
    await expect(count(page, 'Fixture Product')).toHaveValue('0012');
    await expect(
      page.getByRole('textbox', { name: /^Current Stock, Second Product.*OFFLINE-LOT/ }),
    ).toHaveValue('0');
    for (const name of ['Save', 'Delete'])
      await expect(page.getByRole('button', { name, exact: true }).first()).toBeDisabled();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Invalid Line Items');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page
      .getByRole('textbox', { name: /^Current Stock, Second Product.*EXISTING/ })
      .fill('20');
    await saved(page);
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Connection Required To Submit');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Close', exact: true }).click();
    expect(writes).toEqual([]);
    await page.goto(`${listUrl}/never`);
    await expect(
      page.getByRole('heading', { name: 'Not Available Offline', exact: true }),
    ).toBeVisible();
    await page.goto(editorUrl);
    await expect(count(page, 'Fixture Product')).toHaveValue('0012');
    await context.setOffline(false);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    await expect(count(page, 'Fixture Product')).toHaveValue('0012');
    expect(writes).toEqual([]);
    allowSave = true;
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Save', exact: true })
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await expect(page.getByText('Draft Saved', { exact: true })).toBeVisible();
    expect(writes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /api/lots',
      'PUT /api/physicalInventories/inventory',
    ]);
    expect(writes[1].body).toMatchObject({
      lineItems: expect.arrayContaining([
        expect.objectContaining({ orderableId: 'product', quantity: 12 }),
        expect.objectContaining({ orderableId: 'second', lotId: 'new-lot', quantity: 0 }),
      ]),
    });
    expect(blocked).toEqual([]);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
