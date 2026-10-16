import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';

import { generation, login, stub } from './fixtures';

test('held and failed background downloads allow sign-in and navigation', async ({
  page,
  context,
}) => {
  let release!: (value: 'finish' | 'fail') => void;
  const held = new Promise<'finish' | 'fail'>((resolve) => {
    release = resolve;
  });
  await stub(context, () => held);
  await login(page);
  await expect(page.getByRole('cell', { name: 'Fixture Medicines', exact: true })).toBeVisible();
  await expect(
    page.getByRole('note').filter({ hasText: 'Fetching the necessary data for offline' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Home', exact: true }).first().click();
  await expect(page).toHaveURL(/\/home$/);
  release('fail');
  await expect(
    page.getByRole('note').filter({ hasText: 'Offline Download Incomplete' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});

test('stale bundle survives offline restart with its download time and missing program shows download notice', {
  tag: '@offline-shell',
}, async ({ persistentContext }) => {
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-offline-4-'));
  let context = await persistentContext(directory);
  try {
    await stub(context, async () => 'finish');
    let page = context.pages()[0];
    await login(page);
    await expect(page.getByText('Ready Offline', { exact: true })).toBeVisible();
    await expect.poll(() => generation(page)).not.toBeNull();
    await waitForOfflineShell(page);
    const downloadedAt = (await page.getByText(/^Downloaded /).textContent()) ?? '';
    expect(downloadedAt).toBeTruthy();
    await page.evaluate(async () => {
      const name = (await indexedDB.databases()).find((db) =>
        db.name?.endsWith(':download-user'),
      )?.name;
      if (!name) throw new Error('Download database missing');
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('adjustmentDownloads', 'readwrite');
          const table = transaction.objectStore('adjustmentDownloads');
          const read = table.get(['home', 'program']);
          read.onsuccess = () => table.put({ ...read.result, stale: true });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    });
    await context.close();
    context = await persistentContext(directory, true);
    page = context.pages()[0];
    await page.goto('./stock-management/adjustments');
    await expect(page.getByText('Needs Refresh', { exact: true })).toBeVisible();
    await expect(page.getByText(downloadedAt, { exact: true })).toBeVisible();
    await expect(page.getByText('Not Downloaded', { exact: true })).toBeVisible();
    await page
      .getByRole('row')
      .filter({ hasText: 'Fixture Medicines' })
      .getByRole('link', { name: 'Make Adjustment' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'HOME - Fixture Clinic - Fixture Medicines', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Product', exact: true })).toHaveValue(
      'Fixture Product',
    );
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('combobox', { name: /Reason, Fixture Product/ })).toBeVisible();
    await page.goto('./stock-management/adjustments/never');
    await expect(
      page.getByText('Connect To Download This Data', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('No Access', { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('another tab observes the batch and does not duplicate held stock reads', async ({
  page,
  context,
}) => {
  let release!: (value: 'finish' | 'fail') => void;
  let stockReads = 0;
  const held = new Promise<'finish' | 'fail'>((resolve) => {
    release = resolve;
  });
  await stub(context, () => {
    stockReads += 1;
    return held;
  });
  await login(page);
  await expect(
    page.getByRole('note').filter({ hasText: 'Fetching the necessary data for offline' }),
  ).toBeVisible();
  await expect.poll(() => stockReads).toBe(1);
  const other = await context.newPage();
  await other.goto('./stock-management/adjustments');
  await expect(other.getByRole('cell', { name: 'Fixture Medicines', exact: true })).toBeVisible();
  await expect(
    other.getByRole('note').filter({ hasText: 'Fetching the necessary data for offline' }),
  ).toBeVisible();
  expect(stockReads).toBe(1);
  release('finish');
  await expect(other.getByText('Ready Offline', { exact: true })).toBeVisible();
  await expect(
    other.getByRole('note').filter({ hasText: 'Offline Download Incomplete' }),
  ).toBeVisible();
  expect(stockReads).toBe(1);
});
