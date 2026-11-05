import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { extname, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const evidence = '.screenshots/FM-39-perf';
const source = JSON.parse(await readFile(`${evidence}/timing.json`, 'utf8'));
const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const timings = new Map();
for (const result of source.results.filter((r) => r.ui === 'new'))
  for (const row of result.rows ?? []) {
    if (!(row.server > 0)) continue;
    const path = row.path.split('?')[0].replace(/\/users\/[^/]+/, '/users/user');
    timings.set(path, [...(timings.get(path) ?? []), row.server]);
  }
const fixtureSource = stripTypeScriptTypes(await readFile('tests/offline/fixtures.ts', 'utf8'));
const fixtureUrl = `data:text/javascript;base64,${Buffer.from(fixtureSource).toString('base64')}`;
const requisitionSource = stripTypeScriptTypes(
  await readFile('tests/offline/requisitions-fixtures.ts', 'utf8'),
).replace("'./fixtures'", JSON.stringify(fixtureUrl));
const { requisitionStubs, home, program, batchId } = await import(
  `data:text/javascript;base64,${Buffer.from(requisitionSource).toString('base64')}`
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const origin = 'https://fm39.invalid';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
for (const [version, dir] of [
  ['before', `${evidence}/dist`],
  ['after', 'dist'],
]) {
  for (const mode of ['early', 'settled', 'warm']) {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 900 },
    });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith('/api'))
        return route.fulfill({ json: { content: [], totalElements: 0, totalPages: 0 } });
      const path =
        url.pathname.startsWith('/assets/') || /\.[a-z]+$/.test(url.pathname)
          ? url.pathname
          : '/index.html';
      try {
        const body = await readFile(resolve(dir, `.${path}`));
        const contentType =
          {
            '.js': 'application/javascript',
            '.html': 'text/html',
            '.json': 'application/json',
            '.css': 'text/css',
            '.woff2': 'font/woff2',
            '.png': 'image/png',
          }[extname(path)] ?? 'application/octet-stream';
        return route.fulfill({ body, contentType });
      } catch {
        return route.fulfill({ status: 404, body: '' });
      }
    });
    await requisitionStubs(context, []);
    await context.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      await delay(median(timings.get(path.replace(/\/users\/[^/]+/, '/users/user')) ?? [180]));
      if (path.endsWith('/permissionStrings'))
        return route.fulfill({
          json: [
            `REQUISITION_VIEW|${home}|${program}`,
            `REQUISITION_CREATE|${home}|${program}`,
            `REQUISITION_AUTHORIZE|${home}|${program}`,
            `REQUISITION_APPROVE|${home}|${program}`,
            `ORDER_CREATE|${home}|${program}`,
            'ORDERS_EDIT',
          ],
        });
      if (path.endsWith('/periodsForInitiate'))
        return route.fulfill({
          json: [
            { id: 'period', name: 'November 2026', startDate: '2026-11-01', endDate: '2026-11-30' },
          ],
        });
      if (path.endsWith('/requisitionsForConvert'))
        return route.fulfill({
          json: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 },
        });
      return route.fallback();
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        'login-data-storage',
        JSON.stringify({
          state: {
            referenceDataUserId: 'download-user',
            username: 'download-user',
            accessToken: 'fixture-token',
            isAuthenticated: true,
            sessionSource: 'own',
            expired: false,
          },
          version: 0,
        }),
      ),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(`${origin}/home`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Requisitions', exact: true }).click();
    if (mode !== 'early') await delay(10000);
    const steps = [
      ['view-picker', '/requisitions/view', () => page.locator('main input#facility').waitFor()],
      [
        'initiate-picker',
        '/requisitions/initiate',
        () => page.locator('main input#programId').waitFor(),
      ],
      [
        'initiate-search',
        `/requisitions/initiate?mode=my&facilityId=${home}&programId=${program}`,
        () => page.getByText('November 2026', { exact: true }).first().waitFor(),
      ],
      [
        'approve-list',
        '/requisitions/approve',
        () => page.locator('main tbody tr').filter({ hasText: 'Fixture Clinic' }).first().waitFor(),
      ],
      [
        'batch-open',
        `/requisitions/approve/batch?ids=${batchId}&program=${program}`,
        () => page.getByRole('table', { name: 'Approve Requisitions' }).waitFor(),
      ],
      [
        'convert-list',
        '/requisitions/convert',
        () => page.getByRole('heading', { level: 1 }).waitFor(),
      ],
      [
        'orders-options',
        '/requisitions/create-orders',
        () => page.getByRole('combobox').first().waitFor(),
      ],
    ];
    for (const [step, path, ready] of steps) {
      try {
        if (mode === 'warm') {
          await page.goto(origin + path);
          await ready();
          await page.locator('a[href="/home"]').first().click();
        }
        if (mode === 'warm' && ['initiate-search', 'batch-open'].includes(step)) {
          const parent = step === 'batch-open' ? '/requisitions/approve' : '/requisitions/initiate';
          await page.locator(`a[href="${parent}"]`).first().click();
          await page.waitForURL((url) => url.pathname === parent);
          await page
            .getByRole('button', {
              name: step === 'batch-open' ? /View Selected/ : 'Search',
              exact: step !== 'batch-open',
            })
            .waitFor();
        }
        const start = Date.now();
        if (step === 'initiate-search')
          await page.getByRole('button', { name: 'Search', exact: true }).click();
        else if (step === 'batch-open') {
          await page.getByRole('checkbox').last().check();
          await page.getByRole('button', { name: /View Selected/ }).click();
        } else await page.locator(`a[href="${path}"]`).first().click();
        await page.waitForURL((url) => url.pathname === path.split('?')[0]);
        await ready();
        results.push({ version, mode, step, ms: Date.now() - start });
      } catch (error) {
        results.push({ version, mode, step, error: String(error).slice(0, 150) });
      }
      console.log(JSON.stringify(results.at(-1)));
    }
    await context.close();
  }
}
await browser.close();
await writeFile(
  `${evidence}/mock-round2.json`,
  JSON.stringify(
    {
      note: 'Intercepted production assets and API fixtures. No network reaches a server. Sequential steps, one run per mode, not live parity proof.',
      results,
    },
    null,
    2,
  ),
);
