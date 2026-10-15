import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './browser-fixtures';
import { generation, login, stub } from './fixtures';

const editorUrl = 'http://127.0.0.1:9165/v2/stock-management/adjustments/program';
const quantity = (page: Page) => page.getByRole('textbox', { name: /^Quantity, Fixture Product/ });
async function addLine(page: Page) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(quantity(page)).toBeVisible();
}
async function saved(page: Page) {
  await expect(page.getByRole('note').filter({ hasText: 'Saved on this device' })).toBeVisible();
}
async function rows(page: Page) {
  return page.evaluate(async () => {
    const name = (await indexedDB.databases()).find((db) =>
      db.name?.endsWith(':download-user'),
    )?.name;
    if (!name) throw new Error('Draft database missing');
    return new Promise<
      {
        state: string;
        lines: { quantity: { doses: string; packs: string; remainder: string } }[];
      }[]
    >((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction('stockEventDrafts').objectStore('stockEventDrafts').getAll();
        read.onsuccess = () => {
          db.close();
          resolve(read.result);
        };
        read.onerror = () => reject(read.error);
      };
    });
  });
}

test('offline edits restore exact quantity text after reload and persistent browser restart', async ({
  persistentContext,
}) => {
  const directory = await mkdtemp(resolve('.offline/profile-stage-5-'));
  let context = await persistentContext(directory);
  try {
    await stub(context, async () => 'finish');
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
    await page.goto(editorUrl);
    await context.setOffline(true);
    await addLine(page);
    await quantity(page).fill('0012');
    await saved(page);
    await page.getByRole('radio', { name: 'Packs', exact: true }).click();
    await page.getByRole('textbox', { name: /^Quantity, Fixture Product.*Packs/ }).fill('٠١');
    await page.getByRole('textbox', { name: /^Quantity, Fixture Product.*Doses/ }).fill('٠٢');
    await saved(page);
    const before = await rows(page);
    await page.reload();
    await expect(
      page.getByRole('textbox', { name: /^Quantity, Fixture Product.*Packs/ }),
    ).toHaveValue('٠١');
    await expect(
      page.getByRole('textbox', { name: /^Quantity, Fixture Product.*Doses/ }),
    ).toHaveValue('٠٢');
    expect(await rows(page)).toEqual(before);
    await context.close();
    context = await persistentContext(directory, true);
    page = context.pages()[0];
    await page.goto(editorUrl);
    await expect(
      page.getByRole('textbox', { name: /^Quantity, Fixture Product.*Packs/ }),
    ).toHaveValue('٠١');
    await expect(
      page.getByRole('textbox', { name: /^Quantity, Fixture Product.*Doses/ }),
    ).toHaveValue('٠٢');
    expect(await rows(page)).toEqual(before);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('two tabs detect stale writes and preserve both edits through copy and load choices', async ({
  page,
  context,
}) => {
  await stub(context, async () => 'finish');
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await page.goto(editorUrl);
  await addLine(page);
  await quantity(page).fill('0011');
  await saved(page);
  const other = await context.newPage();
  await other.goto(editorUrl);
  await expect(quantity(other)).toHaveValue('0011');
  await quantity(page).fill('0022');
  await saved(page);
  await quantity(other).fill('0033');
  await expect(other.getByRole('alertdialog')).toBeVisible();
  await expect(
    other.getByText('This draft was edited in another tab', { exact: true }),
  ).toBeVisible();
  await other.getByRole('button', { name: 'Keep An Archived Copy', exact: true }).click();
  await expect(quantity(other)).toHaveValue('0022');
  const retained = await rows(page);
  expect(retained.find((draft) => draft.state === 'archived')?.lines[0].quantity.doses).toBe(
    '0033',
  );
  expect(retained.find((draft) => draft.state === 'editing')?.lines[0].quantity.doses).toBe('0022');
  await quantity(page).fill('0044');
  await saved(page);
  await quantity(other).fill('0055');
  await expect(other.getByRole('alertdialog')).toBeVisible();
  await other.getByRole('button', { name: 'Load Saved Draft', exact: true }).click();
  await expect(quantity(other)).toHaveValue('0044');
  expect((await rows(page)).filter((draft) => draft.state === 'archived')).toHaveLength(1);
});
