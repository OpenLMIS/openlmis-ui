import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
import { enqueue } from './device-fixtures';
import { generation, login, stub } from './fixtures';

const runLabel = process.env.OFFLINE_PROOF_LABEL || 'offline-proof';
const output = process.env.OFFLINE_PROOF_OUTPUT || `.screenshots/${runLabel}`;
for (const programName of ['Fixture Medicines', 'Expanded Program on Immunization']) {
  const variant = programName === 'Fixture Medicines' ? '' : '-long-program';
  for (const language of ['en', 'ar']) {
    for (const [size, width, height] of [
      ['desktop', 1400, 1000],
      ['phone', 390, 844],
    ] as const) {
      if (size === 'phone' && programName === 'Fixture Medicines') continue;
      test(`${language} ${size}${variant} offline visual proof`, async ({
        page,
        context,
        browser,
      }, testInfo) => {
        await mkdir(output, { recursive: true });
        const catalog = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
        const report = {
          date: new Date().toISOString(),
          language,
          programName,
          width,
          height,
          browser: browser.version(),
          stockPosts: 0,
          passed: false,
          pageErrors: [] as string[],
          captures: [] as unknown[],
        };
        try {
          page.on('pageerror', (error) => report.pageErrors.push(error.message));
          await stub(context, async () => 'finish', {
            home: 'home',
            program: 'program',
            programName,
          });
          await context.route('**/api/stockEvents{,/**,?*}', (route) => {
            if (route.request().method() === 'POST') report.stockPosts++;
            return route.abort();
          });
          await page.setViewportSize({ width, height });
          await login(page, 'download-user', programName);
          await expect.poll(() => generation(page)).not.toBeNull();
          await waitForOfflineShell(page);
          await page.evaluate((language) => localStorage.setItem('i18nextLng', language), language);
          await page.reload();
          await expect(page.locator('html')).toHaveAttribute(
            'dir',
            language === 'ar' ? 'rtl' : 'ltr',
          );
          const capture = async (surface: string) => {
            await page.evaluate(() => document.fonts.ready);
            const path = `${output}/${runLabel}-${language}-${size}${variant}-${surface}.png`;
            await page.screenshot({ path, fullPage: true, animations: 'disabled' });
            const metrics = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              width: innerWidth,
              statuses: document.querySelectorAll('[role=status]').length,
              tableWidths: [...document.querySelectorAll('[data-slot=table-container]')].map(
                (el) => ({
                  scroll: el.scrollWidth,
                  width: el.clientWidth,
                }),
              ),
              headers: [...document.querySelectorAll('th')].map((el) => ({
                scroll: el.scrollWidth,
                width: el.clientWidth,
              })),
              dialogs: [...document.querySelectorAll('[role=dialog], [role=alertdialog]')]
                .filter((el) => el.getClientRects().length)
                .map((el) => {
                  const { x, y, right, bottom } = el.getBoundingClientRect();
                  return { x, y, right, bottom };
                }),
            }));
            expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
            expect(metrics.statuses).toBe(1);
            if (surface === 'program-picker') {
              const brokenWords = await page.locator('tbody td').evaluateAll((cells) => {
                const broken: string[] = [];
                for (const cell of cells) {
                  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
                  let node = walker.nextNode();
                  while (node) {
                    for (const match of (node.textContent ?? '').matchAll(/\S+/gu)) {
                      const range = document.createRange();
                      range.setStart(node, match.index);
                      range.setEnd(node, match.index + match[0].length);
                      const lines = new Set(
                        [...range.getClientRects()].map((rect) => Math.round(rect.y)),
                      );
                      if (lines.size > 1) broken.push(match[0]);
                    }
                    node = walker.nextNode();
                  }
                }
                return broken;
              });
              expect(brokenWords, 'picker words must stay on one line').toEqual([]);
              const clipped = await page
                .locator('tbody td div, tbody td span')
                .evaluateAll((elements) =>
                  elements
                    .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
                    .map((el) => el.textContent),
                );
              expect(clipped, 'picker text must fit its container').toEqual([]);
              for (const item of [...metrics.tableWidths, ...metrics.headers])
                expect(item.scroll).toBeLessThanOrEqual(item.width);
            }
            for (const rect of metrics.dialogs) {
              expect(rect.x).toBeGreaterThanOrEqual(-1);
              expect(rect.right).toBeLessThanOrEqual(width + 1);
              expect(rect.y).toBeGreaterThanOrEqual(-1);
              expect(rect.bottom).toBeLessThanOrEqual(height + 1);
            }
            report.captures.push({ surface, path, ...metrics });
          };
          await context.setOffline(true);
          await expect(page.getByText(programName, { exact: true }).first()).toBeVisible();
          await capture('program-picker');
          await page.goto('./stock-management/adjustments/program');
          const units = page.getByRole('radiogroup', { name: catalog['quantity-unit.label'] });
          await expect(units).toBeVisible();
          const beforeSave = await units.boundingBox();
          if (!beforeSave) throw new Error('Missing quantity-unit control');
          await page
            .getByRole('button', { name: catalog['stock-events.add'], exact: true })
            .click();
          await page
            .getByRole('textbox', { name: /^.+Fixture Product/ })
            .fill(language === 'ar' ? '١٢' : '12');
          await page.getByRole('combobox', { name: /^.+Fixture Product/ }).click();
          await page.getByRole('option', { name: 'Damaged', exact: true }).click();
          const saved = page
            .locator('[data-slot=badge]')
            .filter({ hasText: catalog['stock-events.draft-saved'] });
          await expect(saved).toBeVisible();
          const toolbar = page
            .getByRole('textbox', { name: catalog['stock-events.keywords'] })
            .locator('xpath=ancestor::fieldset/..');
          await expect(toolbar.locator('[data-slot=badge]')).toContainText(
            catalog['stock-events.draft-saved'],
          );
          expect(
            await saved.evaluate((note) =>
              (() => {
                const units = document.querySelector('[role=radiogroup]');
                return Boolean(
                  units && note.compareDocumentPosition(units) & Node.DOCUMENT_POSITION_FOLLOWING,
                );
              })(),
            ),
          ).toBe(true);
          const afterSave = await units.boundingBox();
          expect(afterSave?.x).toBeCloseTo(beforeSave.x, 0);
          expect(afterSave?.y).toBeCloseTo(beforeSave.y, 0);
          await capture('editor-draft-status');
          await page
            .getByRole('button', { name: catalog['stock-events.submit-offline'], exact: true })
            .click();
          await page
            .getByRole('textbox', { name: catalog['stock-events.signature'], exact: true })
            .fill('Fixture User');
          await capture('submit-offline');
          await page
            .getByRole('button', { name: catalog['stock-events.confirm'], exact: true })
            .click();
          await expect(page).toHaveURL(/adjustments$/);
          await capture('saved-device');
          await page
            .getByRole('note')
            .getByRole('link', { name: catalog['device-events.title'], exact: true })
            .first()
            .click();
          await expect(
            page.getByRole('heading', { name: catalog['device-events.title'], exact: true }),
          ).toBeVisible();
          await capture('offline-events');
          if (size === 'phone')
            await page
              .getByRole('button', { name: catalog['sidebar.toggle-sidebar'], exact: true })
              .click();
          await expect(
            page.getByRole('note').filter({ hasText: catalog['offline.title'] }),
          ).toBeVisible();
          await capture('sidebar-notices');
          if (size === 'phone') await page.keyboard.press('Escape');
          else {
            await page
              .getByRole('button', { name: catalog['sidebar.toggle-sidebar'], exact: true })
              .click();
            await capture('sidebar-collapsed');
            await page
              .getByRole('button', { name: catalog['sidebar.toggle-sidebar'], exact: true })
              .click();
          }
          await page
            .getByRole('button', { name: catalog['nav-user.account-menu'], exact: true })
            .click();
          await page
            .getByRole('menuitem', { name: catalog['nav-user.log-out'], exact: true })
            .click();
          await expect(page.getByRole('alertdialog')).toBeVisible();
          await capture('sign-out-warning');
          await page
            .getByRole('button', { name: catalog['sign-out-offline.stay'], exact: true })
            .click();
          await page.goto('./stock-management/issue');
          await expect(
            page.getByRole('heading', { name: catalog['offline.page-title'], exact: true }),
          ).toBeVisible();
          await capture('blocked-page');
          expect(report.pageErrors).toEqual([]);
          report.passed = true;
        } finally {
          await writeFile(testInfo.outputPath('visual-verification.json'), JSON.stringify(report));
          await writeFile(
            `${output}/${runLabel}-${language}-${size}${variant}-verification.json`,
            JSON.stringify(report, null, 2),
          );
        }
      });
    }
  }
}

for (const language of ['en', 'ar']) {
  for (const width of [390, 1400]) {
    test(`offline feedback visual proof ${language} ${width}`, async ({ page, context }) => {
      const catalog = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
      await stub(context, async () => 'finish');
      await context.route('**/api/stockEvents{,/**,?*}', async (route) => {
        await route.abort('blockedbyclient');
      });
      await login(page);
      await expect.poll(() => generation(page)).not.toBeNull();
      await page.evaluate((language) => localStorage.setItem('i18nextLng', language), language);
      await page.reload();
      await waitForOfflineShell(page);
      await context.setOffline(true);
      await enqueue(page, [
        { signature: 'First', lineCount: 32 },
        { signature: 'Second', lineCount: 32 },
      ]);
      await page.reload();
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await expect(
        page.getByRole('link', { name: catalog['device-events.title'], exact: true }),
      ).toBeVisible();
      await mkdir(output, { recursive: true });
      await page.screenshot({
        path: `${output}/${runLabel}-${language}-${width}-feedback-picker.png`,
        fullPage: true,
      });
      await page.goto('./offline-events');
      await expect(
        page.getByRole('heading', { name: catalog['device-events.title'], exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Fixture Clinic', { exact: true })).toHaveCount(2);
      await page.screenshot({
        path: `${output}/${runLabel}-${language}-${width}-feedback-events.png`,
        fullPage: true,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390) {
        const trash = page
          .locator('ul button')
          .filter({ has: page.locator('svg.lucide-trash-2') })
          .first();
        await trash.click();
        const confirmation = page.getByRole('alertdialog');
        await expect(confirmation).toContainText(catalog['device-events.remove-warning']);
        await confirmation
          .getByRole('button', { name: catalog['device-events.cancel'], exact: true })
          .click();
        await expect(trash).toBeFocused();
        await expect(
          page.getByRole('listitem').filter({ has: page.locator('svg.lucide-eye') }),
        ).toHaveCount(2);
        await page
          .locator('ul button')
          .filter({ has: page.locator('svg.lucide-eye') })
          .first()
          .click();
      } else {
        await page.locator('tbody button[aria-haspopup=menu]').first().click();
        await page
          .getByRole('menuitem', { name: catalog['device-events.review-event'], exact: true })
          .click();
      }
      const eventDetails = page.getByRole('dialog');
      await expect(
        eventDetails.getByText('Fixture Product', { exact: true }).first(),
      ).toBeVisible();
      await expect(
        eventDetails.getByText(catalog['device-events.attempted-at'], { exact: true }),
      ).toHaveCount(0);
      if (width === 390) {
        await expect(eventDetails.getByRole('table')).toHaveCount(0);
        await expect(eventDetails.getByRole('listitem')).toHaveCount(32);
      } else {
        await expect(eventDetails.getByRole('table')).toBeVisible();
        await expect(
          eventDetails.getByRole('columnheader', {
            name: catalog['stock-events.reason-comments'],
            exact: true,
          }),
        ).toHaveCount(0);
      }
      await eventDetails.evaluate(async (dialog) => {
        await document.fonts.ready;
        await Promise.all(
          dialog
            .getAnimations({ subtree: true })
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
            .map((animation) => animation.finished.catch(() => {})),
        );
      });
      const dialogLayout = await eventDetails.evaluate((dialog) => {
        const info = dialog.querySelector('[data-slot=settings-list]');
        const lines = dialog.querySelector('[data-event-lines-region]');
        const footer = dialog.querySelector('[data-slot=dialog-footer]');
        if (!info || !lines || !footer) throw new Error('Missing details regions');
        return {
          info: info.getBoundingClientRect().height,
          lines: getComputedStyle(lines).overflowY,
          bottom: footer.getBoundingClientRect().bottom,
          height: innerHeight,
        };
      });
      expect(dialogLayout.info).toBeLessThan(250);
      expect(dialogLayout.lines).toBe('auto');
      expect(dialogLayout.bottom).toBeLessThanOrEqual(dialogLayout.height);
      const fixedBefore = await eventDetails.locator('[data-slot=settings-list]').boundingBox();
      const footerBefore = await eventDetails.locator('[data-slot=dialog-footer]').boundingBox();
      const scroll = eventDetails.locator('[data-event-lines-region]');
      await scroll.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      expect(await scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      expect(await eventDetails.locator('[data-slot=settings-list]').boundingBox()).toEqual(
        fixedBefore,
      );
      expect(await eventDetails.locator('[data-slot=dialog-footer]').boundingBox()).toEqual(
        footerBefore,
      );
      await scroll.evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: `${output}/${runLabel}-${language}-${width}-feedback-details.png`,
        fullPage: true,
      });
      await eventDetails
        .locator('[data-slot=dialog-footer]')
        .getByRole('button', { name: catalog['device-events.close'], exact: true })
        .click();
      if (width === 390)
        await page
          .getByRole('button', { name: catalog['sidebar.toggle-sidebar'], exact: true })
          .click();
      await page
        .getByRole('button', { name: catalog['nav.stock-management'], exact: true })
        .click();
      const issue = page.getByRole('button', {
        name: catalog['nav.stock-management.issue'],
        exact: true,
      });
      await issue.hover();
      await page.screenshot({
        path: `${output}/${runLabel}-${language}-${width}-feedback-unavailable-sidebar.png`,
        fullPage: true,
      });
      await issue.click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toHaveText(new RegExp(catalog['offline.navigation-title']));
      await page.screenshot({
        path: `${output}/${runLabel}-${language}-${width}-feedback-navigation.png`,
        fullPage: true,
      });
      await dialog.getByRole('button', { name: catalog['dialog.close'], exact: true }).click();
      await expect(issue).toBeFocused();
      await expect(page).toHaveURL(/\/offline-events$/);
      if (width === 390) await page.keyboard.press('Escape');
      await page.keyboard.press('Control+k');
      const input = page.getByRole('combobox');
      await input.fill(catalog['nav.stock-management.issue']);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: catalog['dialog.close'], exact: true }).click();
      await expect(input).toBeFocused();
      if (width === 1400) {
        await page.keyboard.press('Escape');
        await page.evaluate(() => localStorage.setItem('theme', 'dark'));
        await page.reload();
        await expect(page.locator('html')).toHaveClass(/dark/);
        await page.goto('./stock-management/adjustments');
        await expect(
          page.getByRole('link', { name: catalog['device-events.title'], exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: `${output}/${runLabel}-${language}-${width}-feedback-dark-notices.png`,
          fullPage: true,
        });
      }
    });
  }
}

for (const language of ['en', 'ar']) {
  for (const appearance of ['light', 'dark']) {
    test(`notice countdown visual proof ${language} ${appearance}`, async ({ page, context }) => {
      const catalog = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
      await stub(context, async () => 'finish');
      await context.route('**/api/stockEvents{,/**,?*}', (route) => route.abort());
      await page.setViewportSize({ width: 1400, height: 1000 });
      await login(page);
      await expect.poll(() => generation(page)).not.toBeNull();
      await waitForOfflineShell(page);
      await page.evaluate(
        ({ language, appearance }) => {
          localStorage.setItem('i18nextLng', language);
          localStorage.setItem('theme', appearance);
        },
        { language, appearance },
      );
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      if (appearance === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
      else await expect(page.locator('html')).not.toHaveClass(/dark/);
      await context.setOffline(true);
      await expect(
        page.getByRole('note').filter({ hasText: catalog['offline.title'] }),
      ).toBeVisible();
      await context.setOffline(false);
      const notice = page.getByRole('note').filter({ hasText: catalog['offline.back-online'] });
      await expect(notice).toBeVisible();
      await notice.hover();
      const edge = notice.locator('div[aria-hidden=true]');
      await expect(edge.locator(':scope > div')).toHaveCSS('animation-play-state', 'paused');
      const shape = await edge.evaluate((bar) => {
        const alert = bar.closest('[data-slot=alert]');
        if (!alert) throw new Error('Missing countdown alert');
        const parent = alert.getBoundingClientRect();
        const rect = bar.getBoundingClientRect();
        return {
          start: rect.left - parent.left,
          end: parent.right - rect.right,
          bottom: parent.bottom - rect.bottom,
          height: rect.height,
          overflow: getComputedStyle(alert).overflow,
          isolation: getComputedStyle(alert).isolation,
          paused: getComputedStyle(bar.firstElementChild as Element).animationPlayState,
        };
      });
      expect(shape).toEqual({
        start: 1,
        end: 1,
        bottom: 1,
        height: 2,
        overflow: 'hidden',
        isolation: 'isolate',
        paused: 'paused',
      });
      await mkdir(output, { recursive: true });
      await page.screenshot({
        path: `${output}/${runLabel}-${language}-${appearance}-countdown.png`,
        fullPage: true,
      });
    });
  }
}

test.afterAll(async ({ browser }, testInfo) => {
  const directory = testInfo.project.outputDir;
  const files = (await readdir(directory, { recursive: true }))
    .filter((path) => path.endsWith('/visual-verification.json'))
    .sort();
  const reports = await Promise.all(
    files.map(async (path) => JSON.parse(await readFile(`${directory}/${path}`, 'utf8'))),
  );
  await writeFile(
    `${output}/${runLabel}-verification.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        fixture: 'fixture-only API responses',
        browser: browser.version(),
        headless: true,
        reports,
      },
      null,
      2,
    ),
  );
});
