import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';

async function records(page: Page, table: string, userId = 'download-user') {
  return page.evaluate(
    async ({ table, userId }) => {
      const name = (await indexedDB.databases()).find((db) =>
        db.name?.endsWith(`:${userId}`),
      )?.name;
      if (!name) return [];
      return new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction(table).objectStore(table).getAll();
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
        };
      });
    },
    { table, userId },
  );
}

import { login } from './fixtures';
import { batchId, home, program, requisition, requisitionStubs } from './requisitions-fixtures';

for (const language of ['en', 'ar']) {
  test(`saved single and batch reopen after an offline browser restart (${language})`, {
    tag: '@offline-requisitions',
  }, async ({ persistentContext }) => {
    const directory = await mkdtemp(join(tmpdir(), 'openlmis-requisitions-'));
    let context = await persistentContext(directory);
    const mutations: string[] = [];
    const labels = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
    try {
      await requisitionStubs(context, mutations);
      let page = context.pages()[0];
      await login(page, 'download-user', 'View Requisitions', '/requisitions/view');
      await page.waitForFunction(async () =>
        (await indexedDB.databases()).some((db) => db.name?.endsWith(':download-user')),
      );
      await expect
        .poll(async () => {
          const databases = await page.evaluate(() => indexedDB.databases());
          return databases.some((db) => db.name?.endsWith(':download-user'))
            ? (await records(page, 'requisitionAccess')).length
            : 0;
        })
        .toBe(1);
      await page.goto(`./requisitions/view/${requisition}?tab=fullSupply`);
      await expect(page.getByText('Fixture Medicine', { exact: true }).first()).toBeVisible();
      await expect.poll(async () => (await records(page, 'requisitionCopies')).length).toBe(1);
      await page.goto(`./requisitions/approve/batch?ids=${batchId}`);
      await expect(page.getByText(/Fixture Medicine/).first()).toBeVisible();
      await expect.poll(async () => (await records(page, 'requisitionCopies')).length).toBe(2);
      const copies = await records(page, 'requisitionCopies');
      await mkdir('.screenshots/FM-191', { recursive: true });
      await writeFile(
        `.screenshots/FM-191/fixture-copy-sizes-${language}.json`,
        JSON.stringify(
          copies.map((copy) => ({ id: copy.id, bytes: Buffer.byteLength(JSON.stringify(copy)) })),
          null,
          2,
        ),
      );
      expect(copies.find((copy) => copy.id === batchId)?.single).toBeUndefined();
      expect(await records(page, 'requisitionDrafts')).toEqual([]);
      expect(await records(page, 'requisitionBatchDrafts')).toEqual([]);
      await waitForOfflineShell(page);
      await page.evaluate((language) => localStorage.setItem('i18nextLng', language), language);
      await context.close();
      context = await persistentContext(directory, true);
      page = context.pages()[0];
      page.on('dialog', (dialog) => dialog.accept());
      await page.goto(`./requisitions/view?facility=${home}&offline=true`);
      await expect(page.getByText('November 2026', { exact: true }).first()).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      await expect(
        page.getByRole('columnheader', { name: labels['requisitions.offline.label'], exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `.screenshots/FM-191/view-offline-${language}-desktop.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(
        page.getByText(labels['requisitions.offline.label'], { exact: true }).first(),
      ).toBeVisible();
      await page.screenshot({
        path: `.screenshots/FM-191/view-offline-${language}-phone.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`./requisitions/view/${requisition}?tab=fullSupply`);
      await expect(page.getByText('Fixture Medicine', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Fixture Clinic', { exact: false }).first()).toBeVisible();
      const add = page.getByRole('button', {
        name: labels['requisitions.edit.add-product'],
        exact: true,
      });
      await add.click();
      await expect(page.getByText('Available Medicine', { exact: true })).toBeVisible();
      await page.getByRole('checkbox', { name: /Available Medicine/ }).check();
      await page.getByRole('dialog').locator('button[type=submit]').click();
      await expect(page.getByText('Available Medicine', { exact: true }).first()).toBeVisible();
      await expect.poll(async () => (await records(page, 'requisitionDrafts')).length).toBe(1);
      await page.reload();
      await expect(page.getByText('Available Medicine', { exact: true }).first()).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await mkdir('.screenshots/FM-191', { recursive: true });
      await page.screenshot({
        path: `.screenshots/FM-191/single-offline-${language}-phone.png`,
        fullPage: true,
      });
      await page.goto(`./requisitions/approve?program=${program}`);
      await expect(page.getByText('November 2026', { exact: true }).first()).toBeVisible();
      await page.goto(`./requisitions/approve/batch?ids=${batchId}`);
      await expect(page.getByText(/Fixture Medicine/).first()).toBeVisible();
      const quantity = page.getByRole('textbox').first();
      await quantity.fill('7');
      await expect.poll(async () => (await records(page, 'requisitionBatchDrafts')).length).toBe(1);
      await page.reload();
      await expect(page.getByRole('textbox').first()).toHaveValue('7');
      await page.screenshot({
        path: `.screenshots/FM-191/batch-offline-${language}-phone.png`,
        fullPage: true,
      });
      await page.goto(`./requisitions/view?facility=${home}&offline=true`);
      await page
        .getByRole('button', { name: labels['requisitions.offline.remove'], exact: true })
        .first()
        .click();
      await expect(page.getByRole('alertdialog')).toContainText(
        labels['requisitions.offline.dirty-warning'],
      );
      await page.screenshot({
        path: `.screenshots/FM-191/remove-cancel-${language}-phone.png`,
        fullPage: true,
      });
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: labels['dialog.cancel'], exact: true })
        .click();
      expect(await records(page, 'requisitionCopies')).toHaveLength(2);
      expect(mutations).toEqual([]);
    } finally {
      await context.unrouteAll({ behavior: 'ignoreErrors' });
      await context.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('removal rejects a stale dirty warning and stops the other tab from recreating work', {
  tag: '@offline-requisitions',
}, async ({ persistentContext }) => {
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-requisition-removal-'));
  const context = await persistentContext(directory);
  const mutations: string[] = [];
  try {
    await requisitionStubs(context, mutations);
    const editor = context.pages()[0];
    await login(editor, 'download-user', 'View Requisitions', '/requisitions/view');
    await editor.goto(`./requisitions/view/${requisition}?tab=fullSupply`);
    await expect.poll(async () => (await records(editor, 'requisitionCopies')).length).toBe(1);
    const input = editor.getByRole('textbox', { name: /^Requested Quantity:/ });
    await input.fill('5');
    await expect.poll(async () => (await records(editor, 'requisitionDrafts')).length).toBe(1);
    const list = await context.newPage();
    await list.goto(`./requisitions/view?facility=${home}&offline=true`);
    const openRemoval = async () => {
      await list.getByRole('button', { name: /Actions For/i }).click();
      await list.getByRole('menuitem', { name: 'Remove From This Device' }).click();
      await expect(list.getByRole('alertdialog')).toContainText('unsynced changes');
    };
    await openRemoval();
    const previous = (await records(editor, 'requisitionDrafts'))[0].revision;
    await input.fill('6');
    await expect
      .poll(async () => (await records(editor, 'requisitionDrafts'))[0].revision)
      .not.toBe(previous);
    await list
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Remove From This Device' })
      .click();
    await expect(list.getByRole('alertdialog')).toContainText('saved copy changed');
    expect(await records(list, 'requisitionCopies')).toHaveLength(1);
    await list.getByRole('button', { name: 'Cancel', exact: true }).click();
    await openRemoval();
    await list
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Remove From This Device' })
      .click();
    await expect.poll(async () => (await records(list, 'requisitionCopies')).length).toBe(0);
    await expect(
      editor.getByRole('alertdialog').getByRole('heading', { name: 'Copy Removed' }),
    ).toBeVisible();
    await expect(editor.locator('input[placeholder=Doses]')).toBeDisabled();
    expect(await records(editor, 'requisitionDrafts')).toEqual([]);
    await expect(list.getByText('No Saved Requisitions', { exact: true })).toBeVisible();
    await expect(list.locator('main h1')).toBeFocused();
    expect(mutations).toEqual([]);
  } finally {
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('reconnect rechecks the server version and rights before sending saved local edits', {
  tag: '@offline-requisitions',
}, async ({ persistentContext }) => {
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-requisition-reconnect-'));
  const context = await persistentContext(directory);
  const mutations: string[] = [];
  const controls: { modifiedDate?: string; noCreate?: boolean } = {};
  try {
    await requisitionStubs(context, mutations, controls);
    const page = context.pages()[0];
    await login(page, 'download-user', 'View Requisitions', '/requisitions/view');
    await page.goto(`./requisitions/view/${requisition}?tab=fullSupply`);
    await expect.poll(async () => (await records(page, 'requisitionCopies')).length).toBe(1);
    const input = page.getByRole('textbox', { name: /^Requested Quantity:/ });
    await input.fill('5');
    await expect.poll(async () => (await records(page, 'requisitionDrafts')).length).toBe(1);
    await context.setOffline(true);
    await expect(
      page.getByRole('button', { name: 'Save/Sync With Server', exact: true }),
    ).toBeDisabled();
    controls.modifiedDate = '2026-11-04T10:00:00Z';
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Save/Sync With Server', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect(mutations).toEqual([]);
    expect((await records(page, 'requisitionDrafts'))[0]).toMatchObject({
      modifiedDate: '2026-11-03T10:00:00Z',
    });
    await page.getByRole('alertdialog').getByRole('button', { name: 'Close', exact: true }).click();
    controls.modifiedDate = undefined;
    controls.noCreate = true;
    await context.setOffline(true);
    await expect(
      page.getByRole('button', { name: 'Save/Sync With Server', exact: true }),
    ).toBeDisabled();
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Save/Sync With Server', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect(mutations).toEqual([]);
    expect(await records(page, 'requisitionDrafts')).toHaveLength(1);
  } finally {
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('an incomplete available-product download never publishes offline readiness', {
  tag: '@offline-requisitions',
}, async ({ persistentContext }) => {
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-requisition-incomplete-'));
  const context = await persistentContext(directory);
  const mutations: string[] = [];
  try {
    await requisitionStubs(context, mutations, { missingAvailable: true });
    const page = context.pages()[0];
    await login(page, 'download-user', 'View Requisitions', '/requisitions/view');
    await page.goto(`./requisitions/view/${requisition}?tab=fullSupply`);
    await expect(page.getByText('Copy Not Saved', { exact: true })).toBeVisible();
    expect(await records(page, 'requisitionCopies')).toEqual([]);
    await waitForOfflineShell(page);
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Not Available Offline', exact: true }),
    ).toBeVisible();
    expect(mutations).toEqual([]);
  } finally {
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a clean copy survives sign-out and never appears in another user’s local list', {
  tag: '@offline-requisitions',
}, async ({ persistentContext }) => {
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-requisition-owner-'));
  const context = await persistentContext(directory);
  const mutations: string[] = [];
  const controls: { userId?: string } = {};
  try {
    await requisitionStubs(context, mutations, controls);
    await context.route('**/api/users/auth/logout', (route) => route.fulfill({ json: {} }));
    const page = context.pages()[0];
    await login(page, 'download-user', 'View Requisitions', '/requisitions/view');
    await page.goto(`./requisitions/view/${requisition}?tab=fullSupply`);
    await expect.poll(async () => (await records(page, 'requisitionCopies')).length).toBe(1);
    await page.getByRole('button', { name: 'Account Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Log Out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
    controls.userId = 'second-user';
    await login(page, 'second-user', 'View Requisitions', '/requisitions/view');
    await expect
      .poll(async () => (await records(page, 'requisitionAccess', 'second-user')).length)
      .toBe(1);
    await page.goto(`./requisitions/view?facility=${home}&offline=true`);
    await expect(page.getByText('No Saved Requisitions', { exact: true })).toBeVisible();
    expect(await records(page, 'requisitionCopies', 'second-user')).toEqual([]);
    expect(await records(page, 'requisitionCopies', 'download-user')).toHaveLength(1);
    expect(mutations).toEqual([]);
  } finally {
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('supervision-only VIEW access keeps its sidebar link after a cold offline boot', {
  tag: '@offline-requisitions',
}, async ({ persistentContext }) => {
  const directory = await mkdtemp(join(tmpdir(), 'openlmis-requisition-supervision-'));
  let context = await persistentContext(directory);
  const mutations: string[] = [];
  try {
    await requisitionStubs(context, mutations, { supervisionOnlyView: true });
    let page = context.pages()[0];
    await login(page, 'download-user', 'View Requisitions', '/requisitions/view');
    await page.goto(`./requisitions/view/${requisition}?tab=fullSupply`);
    await expect.poll(async () => (await records(page, 'requisitionCopies')).length).toBe(1);
    await waitForOfflineShell(page);
    await context.close();
    context = await persistentContext(directory, true);
    page = context.pages()[0];
    const roleRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/roles') roleRequests.push(request.url());
    });
    await page.goto('./home');
    await page.getByRole('button', { name: 'Requisitions', exact: true }).click();
    const view = page.getByRole('link', { name: 'View', exact: true });
    await expect(view).toBeVisible();
    await expect(view).toHaveAttribute('href', '/v2/requisitions/view');
    expect(roleRequests).toEqual([]);
    expect(mutations).toEqual([]);
  } finally {
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
