import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './browser-fixtures';
import { generation, login, stub } from './fixtures';

const output = '.screenshots/fm-165-stage-9';
const reports: unknown[] = [];
for (const language of ['en', 'ar']) {
  for (const [size, width, height] of [
    ['desktop', 1440, 1000],
    ['phone', 390, 844],
  ] as const) {
    test(`${language} ${size} offline visual proof`, async ({ page, context, browser }) => {
      await mkdir(output, { recursive: true });
      const catalog = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
      const report = {
        date: new Date().toISOString(),
        language,
        width,
        height,
        browser: browser.version(),
        stockPosts: 0,
        passed: false,
        pageErrors: [] as string[],
        captures: [] as unknown[],
      };
      page.on('pageerror', (error) => report.pageErrors.push(error.message));
      await stub(context, async () => 'finish');
      await context.route('**/api/stockEvents{,/**,?*}', (route) => {
        if (route.request().method() === 'POST') report.stockPosts++;
        return route.abort();
      });
      await page.setViewportSize({ width, height });
      await login(page);
      await expect.poll(() => generation(page)).not.toBeNull();
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      await page.waitForFunction(
        async () => (await (await caches.open('openlmis-ui-locales')).keys()).length === 5,
      );
      await page.evaluate((language) => localStorage.setItem('i18nextLng', language), language);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      const capture = async (surface: string) => {
        await page.evaluate(() => document.fonts.ready);
        const path = `${output}/r2-${language}-${size}-${surface}.png`;
        await page.screenshot({ path, fullPage: true, animations: 'disabled' });
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          width: innerWidth,
          statuses: document.querySelectorAll('[role=status]').length,
          tableWidths: [...document.querySelectorAll('[data-slot=table-container]')].map((el) => ({
            scroll: el.scrollWidth,
            width: el.clientWidth,
          })),
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
        if (surface === 'program-readiness') {
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
      try {
        await context.setOffline(true);
        await expect(
          page.getByRole('cell', { name: 'Fixture Medicines', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText(catalog['offline.download.ready'], { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText(catalog['offline.download.not-downloaded'], { exact: true }),
        ).toBeVisible();
        await capture('program-readiness');
        await page.goto('./stock-management/adjustments/program');
        await page.getByRole('button', { name: catalog['stock-events.add'], exact: true }).click();
        await page
          .getByRole('textbox', { name: /^.+Fixture Product/ })
          .fill(language === 'ar' ? '١٢' : '12');
        await page.getByRole('combobox', { name: /^.+Fixture Product/ }).click();
        await page.getByRole('option', { name: 'Damaged', exact: true }).click();
        await expect(
          page.getByRole('note').filter({ hasText: catalog['stock-events.draft-saved'] }),
        ).toBeVisible();
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
        if (size === 'phone')
          await page
            .getByRole('button', { name: catalog['sidebar.toggle-sidebar'], exact: true })
            .click();
        await page
          .getByRole('link', { name: catalog['device-events.title'], exact: true })
          .first()
          .click();
        await expect(page.getByRole('table')).toContainText('Fixture Product');
        await capture('device-events');
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
        expect(report.stockPosts).toBe(0);
        expect(report.pageErrors).toEqual([]);
        report.passed = true;
      } finally {
        reports.push(report);
        await writeFile(
          `${output}/r2-${language}-${size}-verification.json`,
          JSON.stringify(report, null, 2),
        );
      }
    });
  }
}

test.afterAll(async () => {
  await writeFile(
    `${output}/r2-verification.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        fixture: 'fixture-only API responses',
        headless: true,
        reports,
      },
      null,
      2,
    ),
  );
});
