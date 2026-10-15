import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
import { enqueue, records } from './device-fixtures';
import { generation, login, stub } from './fixtures';

const output = '.screenshots/fm-165-review-fixes';
for (const language of ['en', 'ar']) {
  for (const width of [390, 1440]) {
    test(`review fixes ${language} ${width}`, async ({ page, context }) => {
      await mkdir(output, { recursive: true });
      const catalog = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
      const report = {
        language,
        width,
        headless: true,
        stockPosts: 0,
        pageErrors: [] as string[],
        captures: [] as unknown[],
      };
      page.on('pageerror', (error) => report.pageErrors.push(error.message));
      await stub(context, async () => 'finish');
      await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
        report.stockPosts++;
        await route.fulfill({
          status: 400,
          json: {
            messageKey: 'stockmanagement.error.event.debitQuantityExceedSoh',
            message: 'Backdated stock would be negative',
            internal: 'secret-debug-value',
          },
        });
      });
      const height = width === 390 ? 844 : 1000;
      await page.setViewportSize({ width, height });
      await login(page);
      await expect.poll(() => generation(page)).not.toBeNull();
      await page.evaluate((language) => localStorage.setItem('i18nextLng', language), language);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      const capture = async (surface: string) => {
        await page.evaluate(() => document.fonts.ready);
        const path = `${output}/${language}-${width}-${surface}.png`;
        await page.screenshot({ path, fullPage: true, animations: 'disabled' });
        const metrics = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          dialogs: [...document.querySelectorAll('[role=dialog],[role=alertdialog]')]
            .filter((element) => element.getClientRects().length)
            .map((element) => {
              const { x, y, right, bottom } = element.getBoundingClientRect();
              return { x, y, right, bottom };
            }),
          labels: [...document.querySelectorAll('button[aria-label]')].map((element) =>
            element.getAttribute('aria-label'),
          ),
        }));
        expect(metrics.scroll).toBeLessThanOrEqual(width);
        for (const bounds of metrics.dialogs) {
          expect(bounds.x).toBeGreaterThanOrEqual(-1);
          expect(bounds.right).toBeLessThanOrEqual(width + 1);
          expect(bounds.y).toBeGreaterThanOrEqual(-1);
          expect(bounds.bottom).toBeLessThanOrEqual(height + 1);
        }
        report.captures.push({ surface, path, ...metrics });
      };
      await waitForOfflineShell(page);
      await context.setOffline(true);
      await enqueue(page, [
        { signature: 'Waiting' },
        { signature: 'Review' },
        { signature: 'Refused' },
      ]);
      await page.evaluate(async () => {
        const name = (await indexedDB.databases()).find((item) =>
          item.name?.endsWith(':download-user'),
        )?.name;
        if (!name) throw new Error('Missing device database');
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open(name);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(
              ['stockEventQueue', 'stockEventDrafts', 'stockEventSyncErrors'],
              'readwrite',
            );
            const queue = tx.objectStore('stockEventQueue');
            const rows = queue.getAll();
            rows.onsuccess = () =>
              rows.result.forEach((event, index) => {
                if (!index) return;
                event.status = index === 1 ? 'uncertain' : 'refused';
                event.attemptId = `attempt-${index}`;
                const draft = tx.objectStore('stockEventDrafts').get(event.draftId);
                draft.onsuccess = () =>
                  tx.objectStore('stockEventDrafts').put({ ...draft.result, state: event.status });
                tx.objectStore('stockEventSyncErrors').put({
                  localEventId: event.localEventId,
                  facilityId: event.facilityId,
                  programId: event.programId,
                  category: index === 1 ? 'uncertain' : 'refused',
                  message: 'Human refusal',
                  response: { internal: 'secret-debug-value' },
                  failedAt: Date.now(),
                  event,
                });
                if (index === 1) queue.put(event);
                else queue.delete(event.sequence);
              });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        });
      });
      await page.reload();
      await expect(
        page.getByRole('link', { name: catalog['device-events.review'], exact: true }).first(),
      ).toBeVisible();
      await capture('program-pending');
      if (width === 390)
        await page
          .getByRole('button', { name: catalog['sidebar.toggle-sidebar'], exact: true })
          .click();
      await capture('sidebar-many-notices');
      if (width === 390) {
        const content = page.locator('[data-slot=sidebar-content]');
        expect(await content.evaluate((element) => element.clientHeight)).toBeGreaterThan(300);
        await page.keyboard.press('Escape');
      }
      await page.keyboard.press('Control+k');
      const paletteInput = page.getByRole('combobox');
      await paletteInput.fill(catalog['nav.stock-management.issue']);
      await page.keyboard.press('ArrowDown');
      const unavailable = page
        .getByRole('option')
        .filter({ hasText: catalog['nav.stock-management.issue'] });
      await expect(unavailable).toHaveAttribute('data-unavailable', 'true');
      await expect(unavailable).toHaveAttribute('aria-selected', 'true');
      await expect(unavailable).toHaveAttribute('aria-describedby');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page
          .locator('[data-sonner-toast]')
          .filter({ hasText: catalog['offline.connection-required'] }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await page.goto('./stock-management/device-events');
      await expect(
        page.getByRole('heading', { name: catalog['device-events.title'], exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('table')).toContainText('Fixture Product');
      await expect(
        page.getByRole('columnheader', {
          name: catalog['device-events.occurred-date'],
          exact: true,
        }),
      ).toBeVisible();
      const actionBounds = await page
        .locator('tbody button[aria-haspopup=menu]')
        .first()
        .boundingBox();
      expect(actionBounds).not.toBeNull();
      expect(actionBounds?.x).toBeGreaterThanOrEqual(0);
      expect((actionBounds?.x ?? 0) + (actionBounds?.width ?? 0)).toBeLessThanOrEqual(width);
      await capture('device-events');
      await page.locator('tbody button[aria-haspopup=menu]').last().click();
      await page
        .getByRole('menuitem', { name: catalog['device-events.review-event'], exact: true })
        .click();
      const details = page.getByRole('dialog');
      await expect(details).toContainText('Human refusal');
      await expect(details).not.toContainText('secret-debug-value');
      await capture('refusal-details');
      await page
        .getByRole('button', { name: catalog['device-events.close'], exact: true })
        .first()
        .click();
      await page.locator('tbody button[aria-haspopup=menu]').nth(1).click();
      await page
        .getByRole('menuitem', { name: catalog['device-events.review-event'], exact: true })
        .click();
      await page
        .getByRole('button', { name: catalog['device-events.send-again'], exact: true })
        .click();
      const confirmation = page.getByRole('alertdialog');
      const before = await confirmation.textContent();
      await page.addStyleTag({
        content:
          '[data-slot=alert-dialog-content][data-closed] { animation-duration: 2s !important; }',
      });
      await page
        .getByRole('button', { name: catalog['device-events.cancel'], exact: true })
        .click();
      await expect(page.locator('[data-slot=alert-dialog-content][data-closed]')).toHaveText(
        before ?? '',
      );
      await expect(confirmation).not.toBeVisible();
      await page
        .getByRole('button', { name: catalog['device-events.close'], exact: true })
        .first()
        .click();
      await page
        .getByRole('button', { name: catalog['nav-user.account-menu'], exact: true })
        .click();
      await page.getByRole('menuitem', { name: catalog['nav-user.log-out'], exact: true }).click();
      const signOut = page.getByRole('alertdialog');
      const signOutText = await signOut.textContent();
      await capture('log-out');
      await page
        .getByRole('button', { name: catalog['sign-out-offline.stay'], exact: true })
        .click();
      await expect(page.locator('[data-slot=alert-dialog-content][data-closed]')).toHaveText(
        signOutText ?? '',
      );
      await expect(signOut).not.toBeVisible();
      await page.evaluate(async () => {
        const name = (await indexedDB.databases()).find((item) =>
          item.name?.endsWith(':download-user'),
        )?.name;
        if (!name) throw new Error('Missing device database');
        await new Promise<void>((resolve) => {
          const request = indexedDB.open(name);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(['stockEventQueue'], 'readwrite');
            tx.objectStore('stockEventQueue').clear();
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        });
      });
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await context.route('**/api/v2/stockCardSummaries?*', async (route) => {
        if (new URL(route.request().url()).searchParams.get('programId') === 'never') {
          await held;
          await route.fulfill({ status: 503, json: { message: 'Still unavailable' } });
        } else await route.fallback();
      });
      await context.setOffline(false);
      await page.goto('./stock-management/adjustments');
      await expect(
        page.getByRole('cell', { name: catalog['offline.download.downloading'], exact: true }),
      ).toBeVisible();
      await capture('program-downloading');
      release?.();
      await page.goto('./stock-management/adjustments/program');
      await page.getByRole('button', { name: catalog['stock-events.add'], exact: true }).click();
      await page
        .getByRole('textbox', { name: /^.+Fixture Product/ })
        .fill(language === 'ar' ? '١٢' : '12');
      await page.getByRole('combobox', { name: /^.+Fixture Product/ }).click();
      await page.getByRole('option', { name: 'Damaged', exact: true }).click();
      await page.getByRole('button', { name: catalog['stock-events.submit'], exact: true }).click();
      await page
        .getByRole('textbox', { name: catalog['stock-events.signature'], exact: true })
        .fill('Fixture User');
      await page
        .getByRole('button', { name: catalog['stock-events.confirm'], exact: true })
        .click();
      await expect(page.getByRole('alertdialog')).toContainText(
        'Backdated stock would be negative',
      );
      await capture('editor-refusal');
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: catalog['device-events.copy'], exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: catalog['stock-events.submit'], exact: true }),
      ).toBeEnabled();
      expect(report.stockPosts).toBe(1);
      expect(report.pageErrors).toEqual([]);
      await writeFile(
        `${output}/${language}-${width}-verification.json`,
        JSON.stringify(report, null, 2),
      );
      expect(
        (await records(page, 'stockEventDrafts')).some((draft) => draft.state === 'editing'),
      ).toBe(true);
    });
  }
}
