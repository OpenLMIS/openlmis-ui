import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, type Page, test } from '@playwright/test';
import { generation, login, stub } from './fixtures';

const uuid = (number: number) => `11111111-1111-4111-8111-${String(number).padStart(12, '0')}`;
async function records(page: Page, table: string) {
  return page.evaluate(async (table) => {
    const name = (await indexedDB.databases()).find((db) =>
      db.name?.endsWith(':download-user'),
    )?.name;
    if (!name) throw new Error('Missing database');
    return new Promise<Record<string, unknown>[]>((resolve) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction(table).objectStore(table).getAll();
        read.onsuccess = () => {
          db.close();
          resolve(read.result);
        };
      };
    });
  }, table);
}
async function enqueue(page: Page, signatures: { signature: string; programId?: string }[]) {
  await page.evaluate(async (signatures) => {
    const name = (await indexedDB.databases()).find((db) =>
      db.name?.endsWith(':download-user'),
    )?.name;
    if (!name) throw new Error('Missing database');
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['stockEventQueue', 'stockEventDrafts'], 'readwrite');
        signatures.forEach(({ signature, programId = 'program' }, index) => {
          const identity = {
            localEventId: crypto.randomUUID(),
            draftId: crypto.randomUUID(),
            revision: 1,
            kind: 'adjustment',
            facilityId: 'home',
            programId,
            userId: 'download-user',
          };
          const lines = [
            {
              key: crypto.randomUUID(),
              orderable: { id: 'product', productCode: 'MED', fullProductName: 'Fixture Product' },
              lot: null,
              stockOnHand: 20,
              productHasLots: false,
              useVVM: false,
              counterparty: '',
              counterpartyComments: '',
              reasonId: 'reason',
              reasonFreeText: '',
              quantity: { doses: '1', packs: '', remainder: '' },
              occurredDate: '2026-10-14',
              vvmStatus: '',
            },
          ];
          const payload = {
            facilityId: 'home',
            programId,
            signature,
            eventOrigin: 'ADJUSTMENT',
            lineItems: [
              {
                orderableId: 'product',
                quantity: 1,
                occurredDate: '2026-10-14',
                reasonId: 'reason',
              },
            ],
          };
          tx.objectStore('stockEventQueue').add({
            ...identity,
            lines,
            payload,
            postBody: JSON.stringify(payload),
            status: 'queued',
            queuedAt: Date.now() + index,
            facility: { id: 'home', code: 'HOME', name: 'Fixture Clinic' },
            program: { id: programId, code: programId, name: 'Fixture Medicines' },
            stockCards: [{ id: 'card', orderableId: 'product' }],
            reasons: [{ id: 'reason', name: 'Damaged' }],
          });
          tx.objectStore('stockEventDrafts').add({
            ...identity,
            lines,
            state: 'queued',
            savedAt: Date.now(),
            updatedAt: Date.now(),
            signature,
          });
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, signatures);
}
async function ready(page: Page) {
  await login(page);
  await expect.poll(() => generation(page)).not.toBeNull();
  await page.goto('http://127.0.0.1:9165/v2/stock-management/device-events');
  await expect(page.getByRole('heading', { name: 'Device Events', exact: true })).toBeVisible();
}
async function review(page: Page, index = 0) {
  await page.getByRole('button', { name: 'Review Event', exact: true }).nth(index).click();
  await page.getByRole('menuitem', { name: 'Review Event', exact: true }).click();
}
test('reconnect sends two immutable events in sequence, with receipts and Synced only after answers', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  const posts: Record<string, unknown>[] = [];
  const releases: (() => Promise<void>)[] = [];
  await context.route('**/api/stockEvents', async (route) => {
    posts.push(route.request().postDataJSON());
    await new Promise<void>((resolve) => {
      releases.push(async () => {
        await route.fulfill({ status: 201, json: uuid(posts.length) });
        resolve();
      });
    });
  });
  await ready(page);
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'First' }, { signature: 'Second' }]);
  await context.setOffline(false);
  await expect.poll(() => posts.length).toBe(1);
  await expect(page.getByRole('note').filter({ hasText: 'Syncing Device Events' })).toBeVisible();
  expect(await records(page, 'stockEventReceipts')).toHaveLength(0);
  await expect(page.getByRole('table')).not.toContainText('Synced');
  expect(posts[0].signature).toBe('First');
  expect(posts[0]).not.toHaveProperty('documentNumber');
  await releases[0]();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].signature).toBe('Second');
  expect(await records(page, 'stockEventReceipts')).toHaveLength(1);
  await releases[1]();
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(2);
  await expect(page.getByRole('table')).toContainText('Synced');
  expect(await records(page, 'stockEventQueue')).toHaveLength(0);
});
test('stock-changed refusal retains full signed payload and reason through reload', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  let posts = 0;
  await context.route('**/api/stockEvents', async (route) => {
    posts++;
    await route.fulfill({
      status: 400,
      json: {
        messageKey: 'stockmanagement.error.event.debitQuantityExceedSoh',
        message: 'Backdated stock would be negative',
        details: { date: '2026-09-01' },
      },
    });
  });
  await ready(page);
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Refused Original' }]);
  await context.setOffline(false);
  await expect.poll(async () => (await records(page, 'stockEventSyncErrors')).length).toBe(1);
  await page.reload();
  await expect(page.getByRole('table')).toContainText('Refused');
  await review(page);
  await expect(page.getByRole('dialog')).toContainText('Stock Changed');
  await expect(page.getByRole('dialog')).toContainText('Backdated stock would be negative');
  expect((await records(page, 'stockEventSyncErrors'))[0].event).toMatchObject({
    payload: { signature: 'Refused Original' },
  });
  expect(posts).toBe(1);
});
test('service 401 renews the same user, reads fresh grants, and resends exactly one frozen body', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  const posts: string[] = [];
  let grantReads = 0;
  await context.route('**/api/users/download-user/permissionStrings', async (route) => {
    grantReads++;
    await route.fallback();
  });
  await context.route('**/api/oauth/token{,?*}', (route) =>
    route.fulfill({
      json: {
        referenceDataUserId: 'download-user',
        username: 'download-user',
        access_token: `token-${Date.now()}`,
        expires_in: 1800,
      },
    }),
  );
  await context.route('**/api/stockEvents', (route) => {
    posts.push(route.request().postData() ?? '');
    return route.fulfill(
      posts.length === 1
        ? { status: 401, json: { error: 'invalid_token' } }
        : { status: 201, json: uuid(1) },
    );
  });
  await ready(page);
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'Renewal' }]);
  await context.setOffline(false);
  await expect.poll(() => posts.length).toBe(1);
  await expect(
    page.getByRole('note', { includeHidden: true }).filter({ hasText: 'Sign In To Sync' }),
  ).toBeVisible();
  const readsBefore = grantReads;
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Password', { exact: true }).fill('fixture-password');
  await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(1);
  expect(posts).toHaveLength(2);
  expect(posts[1]).toBe(posts[0]);
  expect(grantReads).toBeGreaterThan(readsBefore);
});
test('interrupted upload survives restart, barriers are scoped, and both explicit choices preserve attempts', async () => {
  const directory = await mkdtemp(resolve('.offline/profile-stage-7-'));
  let context = await chromium.launchPersistentContext(directory, {
    headless: true,
    serviceWorkers: 'allow',
  });
  const posts: string[] = [];
  const attach = async () => {
    await stub(context, async () => 'finish');
    await context.route('**/api/stockEvents', async (route) => {
      posts.push(route.request().postDataJSON().signature);
      if (posts.length === 1) await route.abort('failed');
      else await route.fulfill({ status: 201, json: uuid(posts.length) });
    });
  };
  try {
    await attach();
    let page = context.pages()[0];
    await ready(page);
    await context.setOffline(true);
    await enqueue(page, [{ signature: 'Unknown' }, { signature: 'Blocked' }]);
    await context.setOffline(false);
    await expect
      .poll(async () => (await records(page, 'stockEventQueue'))[0]?.status)
      .toBe('uncertain');
    expect(posts).toEqual(['Unknown']);
    await context.close();
    context = await chromium.launchPersistentContext(directory, {
      headless: true,
      serviceWorkers: 'allow',
    });
    await attach();
    page = context.pages()[0];
    await page.goto('http://127.0.0.1:9165/v2/stock-management/device-events');
    await expect(page.getByRole('table')).toContainText('Uncertain');
    expect(posts).toEqual(['Unknown']);
    await context.setOffline(true);
    await enqueue(page, [{ signature: 'Other Program', programId: 'never' }]);
    await context.setOffline(false);
    await expect.poll(() => posts.length).toBe(2);
    expect(posts).toEqual(['Unknown', 'Other Program']);
    await review(page);
    await expect(page.getByRole('dialog')).toContainText(
      'We could not confirm whether this event was recorded.',
    );
    await expect(
      page.getByRole('link', { name: 'Transaction History', exact: true }),
    ).toHaveAttribute('href', /facilityId=home/);
    await page.getByRole('button', { name: 'Send Again', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    expect(posts).toHaveLength(2);
    await page.getByRole('button', { name: 'It Was Recorded', exact: true }).click();
    await expect.poll(() => posts.length).toBe(3);
    expect(posts).toEqual(['Unknown', 'Other Program', 'Blocked']);
    await expect(page.getByRole('table')).toContainText('Marked As Recorded By You');
    await context.setOffline(true);
    await enqueue(page, [{ signature: 'Retry Unknown' }]);
    await context.route('**/api/stockEvents', async (route) => {
      posts.push(route.request().postDataJSON().signature);
      await route.abort('failed');
    });
    await context.setOffline(false);
    await expect
      .poll(async () =>
        (await records(page, 'stockEventQueue')).some((row) => row.status === 'uncertain'),
      )
      .toBe(true);
    await context.unroute('**/api/stockEvents');
    await context.route('**/api/stockEvents', async (route) => {
      posts.push(route.request().postDataJSON().signature);
      await route.fulfill({ status: 201, json: uuid(posts.length) });
    });
    await review(page, 3);
    await page.getByRole('button', { name: 'Send Again', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Send Again', exact: true })
      .dblclick();
    await expect.poll(() => posts.length).toBe(5);
    expect(posts.slice(3)).toEqual(['Retry Unknown', 'Retry Unknown']);
    const drafts = await records(page, 'stockEventDrafts');
    expect(
      drafts.some(
        (draft) =>
          Array.isArray(draft.history) && draft.history.some((item) => item.choice === 'resend'),
      ),
    ).toBe(true);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('two tabs reconnecting have one uploader and never overlap POSTs', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  let active = 0;
  let maximum = 0;
  let posts = 0;
  let release!: () => Promise<void>;
  await context.route('**/api/stockEvents', async (route) => {
    active++;
    maximum = Math.max(maximum, active);
    posts++;
    if (posts === 1)
      await new Promise<void>((resolve) => {
        release = async () => {
          await route.fulfill({ status: 201, json: uuid(1) });
          active--;
          resolve();
        };
      });
    else {
      await route.fulfill({ status: 201, json: uuid(2) });
      active--;
    }
  });
  await ready(page);
  const other = await context.newPage();
  await other.goto('/v2/stock-management/device-events');
  await expect(other.getByRole('heading', { name: 'Device Events', exact: true })).toBeVisible();
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'First' }, { signature: 'Second' }]);
  await context.setOffline(false);
  await expect.poll(() => posts).toBe(1);
  expect(maximum).toBe(1);
  await release();
  await expect.poll(async () => (await records(page, 'stockEventReceipts')).length).toBe(2);
  expect(posts).toBe(2);
  expect(maximum).toBe(1);
});

test('recovery without viewing rights offers both choices without protected history reads', async ({
  context,
  page,
}) => {
  await stub(context, async () => 'finish');
  let posts = 0;
  let historyReads = 0;
  await context.route('**/api/users/download-user/permissionStrings', (route) =>
    route.fulfill({ json: ['STOCK_ADJUST|home|program'] }),
  );
  await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
    if (route.request().method() === 'POST') posts++;
    else historyReads++;
    await route.abort('failed');
  });
  await login(page);
  await expect(page).toHaveURL(/\/stock-management\/adjustments$/);
  await page.goto('http://127.0.0.1:9165/v2/stock-management/device-events');
  await expect(page.getByRole('heading', { name: 'Device Events', exact: true })).toBeVisible();
  await expect(page.getByText('No Events Waiting To Sync', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await enqueue(page, [{ signature: 'No View' }]);
  await context.setOffline(false);
  await expect
    .poll(async () => (await records(page, 'stockEventQueue'))[0]?.status)
    .toBe('uncertain');
  await review(page);
  await expect(page.getByRole('dialog')).toContainText(
    'You do not have access to Stock Cards or Transaction History, so you cannot check this event yourself. Ask someone with access to check before choosing.',
  );
  await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'It Was Recorded', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Send Again', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
  expect(historyReads).toBe(0);
});
