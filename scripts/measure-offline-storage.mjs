import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.OFFLINE_PREVIEW_URL || 'http://127.0.0.1:9166/v2/';
const output = '.offline/stage-9-storage.json';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  base,
  stockPosts: 0,
  blockedWrites: 0,
  samples: [],
  completed: false,
};
let refreshTimer;
try {
  await context.route('**/api{,/**,?*}', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (
      request.method() !== 'GET' &&
      !['/api/oauth/token', '/api/orderables/search'].includes(path)
    ) {
      if (path === '/api/stockEvents') report.stockPosts++;
      report.blockedWrites++;
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(new URL('login?redirect=%2Fstock-management%2Fadjustments', base).href);
  async function snapshot(label) {
    const value = await page.evaluate(async () => {
      const databases = [];
      for (const { name } of await indexedDB.databases()) {
        if (!name) continue;
        const database = await new Promise((resolve, reject) => {
          const open = indexedDB.open(name);
          open.onsuccess = () => resolve(open.result);
          open.onerror = () => reject(open.error);
        });
        const tables = [];
        for (const table of database.objectStoreNames) {
          const rows = await new Promise((resolve, reject) => {
            const read = database.transaction(table).objectStore(table).getAll();
            read.onsuccess = () => resolve(read.result);
            read.onerror = () => reject(read.error);
          });
          const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
          tables.push({
            table,
            count: rows.length,
            serializedBytes: bytes(rows),
            rowBytes: rows.map(bytes),
          });
        }
        database.close();
        databases.push({ name, tables });
      }
      const cacheSizes = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        let bytes = 0;
        const keys = await cache.keys();
        for (const key of keys) bytes += (await (await cache.match(key)).blob()).size;
        cacheSizes.push({ name, entries: keys.length, responseBodyBytes: bytes });
      }
      return {
        databases,
        caches: cacheSizes,
        estimate: await navigator.storage.estimate(),
        persisted: await navigator.storage.persisted(),
      };
    });
    report.samples.push({ label, ...value });
    return value;
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.waitForFunction(
    async () => (await (await caches.open('openlmis-ui-locales')).keys()).length === 5,
  );
  await snapshot('app-files-before-login');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('administrator');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.OFFLINE_MEASUREMENT_PASSWORD || 'password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Essential Meds', exact: true })).toBeVisible({
    timeout: 60_000,
  });
  async function bundles() {
    return page.evaluate(async () => {
      const name = (await indexedDB.databases()).find((db) =>
        db.name?.startsWith('openlmis-ui:'),
      )?.name;
      if (!name) return [];
      return new Promise((resolve) => {
        const open = indexedDB.open(name);
        open.onsuccess = () => {
          const db = open.result;
          const read = db
            .transaction('adjustmentDownloads')
            .objectStore('adjustmentDownloads')
            .getAll();
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
        };
      });
    });
  }
  await expect
    .poll(async () => (await bundles()).length, { timeout: 120_000 })
    .toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole('note').filter({ hasText: 'Fetching the necessary data for offline' }),
  ).toHaveCount(0, { timeout: 120_000 });
  const first = await bundles();
  report.bundles = first.map((bundle) => ({
    programId: bundle.programId,
    cards: bundle.cards.length,
    products: new Set(
      bundle.cards.map((card) => `${card.orderable.id}|${card.orderable.meta?.versionNumber}`),
    ).size,
    lots: new Set(bundle.cards.flatMap((card) => (card.lot ? [card.lot.id] : []))).size,
    reasons: bundle.reasons.length,
    scanning: bundle.scanning,
    bytes: Buffer.byteLength(JSON.stringify(bundle)),
  }));
  await snapshot('downloaded');
  const estimates = [];
  refreshTimer = setInterval(async () => {
    estimates.push(await page.evaluate(() => navigator.storage.estimate()).catch(() => ({})));
  }, 100);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await expect
    .poll(
      async () =>
        (await bundles()).filter((bundle) =>
          first.some(
            (old) => old.programId === bundle.programId && old.generation !== bundle.generation,
          ),
        ).length,
      { timeout: 120_000 },
    )
    .toBe(first.length);
  clearInterval(refreshTimer);
  report.refresh = {
    beforeCount: first.length,
    afterCount: (await bundles()).length,
    samples: estimates.length,
    peakObservedUsage: Math.max(...estimates.map((entry) => entry.usage || 0)),
  };
  await snapshot('replaced-downloads');
  await context.setOffline(true);
  const program = first.find((bundle) => bundle.cards.length)?.programId;
  const start = performance.now();
  await page.goto(new URL(`stock-management/adjustments/${program}`, base).href);
  await expect(page.getByRole('combobox', { name: 'Product', exact: true })).toBeEnabled();
  report.coldOfflineEditorMs = performance.now() - start;
  await page.evaluate(async () => {
    const name = (await indexedDB.databases()).find((db) =>
      db.name?.startsWith('openlmis-ui:'),
    )?.name;
    const db = await new Promise((resolve) => {
      const open = indexedDB.open(name);
      open.onsuccess = () => resolve(open.result);
    });
    const read = (table) =>
      new Promise((resolve) => {
        const request = db.transaction(table).objectStore(table).getAll();
        request.onsuccess = () => resolve(request.result);
      });
    const access = (await read('offlineAccess'))[0];
    const bundle = (await read('adjustmentDownloads')).find((bundle) => bundle.cards.length);
    const card = bundle.cards[0];
    const reason = bundle.reasons.find(
      (assignment) => !assignment.hidden && assignment.reason.reasonCategory === 'ADJUSTMENT',
    ).reason;
    const line = {
      key: crypto.randomUUID(),
      orderable: card.orderable,
      lot: card.lot,
      stockOnHand: card.stockOnHand,
      productHasLots: !!card.lot,
      useVVM: false,
      counterparty: '',
      counterpartyComments: '',
      reasonId: reason.id,
      reasonFreeText: '',
      quantity: { doses: '1', packs: '', remainder: '' },
      occurredDate: new Date().toISOString().slice(0, 10),
      vvmStatus: '',
    };
    const tx = db.transaction(
      ['stockEventDrafts', 'stockEventQueue', 'stockEventSyncErrors', 'stockEventReceipts'],
      'readwrite',
    );
    const draft = (count, state) => ({
      draftId: crypto.randomUUID(),
      localEventId: crypto.randomUUID(),
      userId: access.userId,
      facilityId: bundle.facilityId,
      programId: bundle.programId,
      kind: 'adjustment',
      revision: 1,
      state,
      downloadGeneration: bundle.generation,
      savedAt: Date.now(),
      updatedAt: Date.now(),
      lines: Array.from({ length: count }, () => ({ ...line, key: crypto.randomUUID() })),
    });
    const event = (draft) => {
      const payload = {
        facilityId: bundle.facilityId,
        programId: bundle.programId,
        signature: 'Local sizing fixture',
        eventOrigin: 'ADJUSTMENT',
        lineItems: draft.lines.map(() => ({
          orderableId: card.orderable.id,
          lotId: card.lot?.id,
          quantity: 1,
          occurredDate: new Date().toISOString().slice(0, 10),
          reasonId: reason.id,
        })),
      };
      const { state, savedAt, updatedAt, downloadGeneration, ...identity } = draft;
      return {
        ...identity,
        status: 'queued',
        queuedAt: Date.now(),
        payload,
        postBody: JSON.stringify(payload),
        facility: {
          id: access.homeFacility.id,
          code: access.homeFacility.code,
          name: access.homeFacility.name,
        },
        program: (({ id, code, name }) => ({ id, code, name }))(
          access.programs.find((program) => program.id === bundle.programId),
        ),
        stockCards: [{ id: card.id, orderableId: card.orderable.id, lotId: card.lot?.id }],
        reasons: [{ id: reason.id, name: reason.name }],
      };
    };
    for (const count of [1, 10, 100])
      tx.objectStore('stockEventDrafts').add(draft(count, 'archived'));
    for (let index = 0; index < 100; index++) {
      const row = { ...draft(10, 'queued'), signature: 'Local sizing fixture' };
      tx.objectStore('stockEventDrafts').add(row);
      tx.objectStore('stockEventQueue').add(event(row));
    }
    const refused = draft(10, 'refused');
    tx.objectStore('stockEventDrafts').add(refused);
    tx.objectStore('stockEventSyncErrors').add({
      localEventId: refused.localEventId,
      facilityId: bundle.facilityId,
      programId: bundle.programId,
      event: { ...event(refused), sequence: 101 },
      category: 'stock-changed',
      httpStatus: 400,
      message: 'Local sizing fixture refusal',
      failedAt: Date.now(),
      history: [],
    });
    const accepted = draft(10, 'accepted');
    tx.objectStore('stockEventDrafts').add(accepted);
    tx.objectStore('stockEventReceipts').add({
      draftId: accepted.draftId,
      revision: 1,
      localEventId: accepted.localEventId,
      acceptedAt: Date.now(),
      source: 'server',
      serverEventId: crypto.randomUUID(),
      event: { ...event(accepted), sequence: 102 },
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await snapshot('3-archived-100-queued-1-refused-1-accepted');
  expect(report.stockPosts).toBe(0);
  report.completed = true;
} finally {
  clearInterval(refreshTimer);
  await browser.close();
  await mkdir('.offline', { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
}
console.log(output);
