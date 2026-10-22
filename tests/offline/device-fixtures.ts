import type { Page } from '@playwright/test';

export async function records(page: Page, table: string) {
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
export async function enqueue(
  page: Page,
  signatures: { signature: string; programId?: string; lineCount?: number }[],
) {
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
        signatures.forEach(({ signature, programId = 'program', lineCount = 1 }, index) => {
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
              orderable: {
                id: 'product',
                productCode: 'MED',
                fullProductName: 'Fixture Product',
              },
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
          const eventLines = Array.from({ length: lineCount }, () => ({
            ...lines[0],
            key: crypto.randomUUID(),
          }));
          payload.lineItems = Array.from({ length: lineCount }, () => ({
            ...payload.lineItems[0],
          }));
          tx.objectStore('stockEventQueue').add({
            ...identity,
            lines: eventLines,
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
            lines: eventLines,
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
