import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { generation, login, stub } from './fixtures';

const output = '.screenshots/fm-165-stage-9';
for (const language of ['en', 'ar']) {
  for (const [size, width, height] of [
    ['desktop', 1440, 1000],
    ['phone', 390, 844],
  ] as const) {
    test(`${language} ${size} offline visual proof`, async ({ page, context, browser }) => {
      await mkdir(output, { recursive: true });
      const catalog = JSON.parse(await readFile(`public/locales/${language}.json`, 'utf8'));
      const report = {
        date: '2026-10-15',
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
        const path = `${output}/${language}-${size}-${surface}.png`;
        await page.screenshot({ path, fullPage: true, animations: 'disabled' });
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          width: innerWidth,
          statuses: document.querySelectorAll('[role=status]').length,
          dialogs: [...document.querySelectorAll('[role=dialog], [role=alertdialog]')]
            .filter((el) => el.getClientRects().length)
            .map((el) => {
              const { x, y, right, bottom } = el.getBoundingClientRect();
              return { x, y, right, bottom };
            }),
        }));
        expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
        expect(metrics.statuses).toBe(1);
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
        await page.goto('./stock-management/device-events');
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
        await writeFile(
          `${output}/${language}-${size}-verification.json`,
          JSON.stringify(report, null, 2),
        );
      }
    });
  }
}

test.afterAll(async () => {
  const reports = await Promise.all(
    ['en', 'ar'].flatMap((language) =>
      ['desktop', 'phone'].map(async (size) =>
        JSON.parse(await readFile(`${output}/${language}-${size}-verification.json`, 'utf8')),
      ),
    ),
  );
  await writeFile(
    `${output}/verification.json`,
    JSON.stringify(
      { date: '2026-10-15', fixture: 'fixture-only API responses', headless: true, reports },
      null,
      2,
    ),
  );
});
