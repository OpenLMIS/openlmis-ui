import { expect } from '@playwright/test';
import { test, waitForOfflineShell } from './browser-fixtures';
import { records } from './device-fixtures';
import { login, stub } from './fixtures';

test('production shell reloads offline under /v2 after worker takeover', {
  tag: '@offline-shell',
}, async ({ page, context, baseURL }) => {
  await context.route('**/api{,/**,?*}', (route) => route.abort());
  await context.route('**/localeSettings{,/**,?*}', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await waitForOfflineShell(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await expect(page).toHaveURL(new URL('login', baseURL).href);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(
    new URL('sw.js', baseURL).href,
  );
});

test('a boot module that fails loads the page again', async ({ page, context }) => {
  let documents = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) documents++;
  });
  await context.route('**/api{,/**,?*}', (route) => route.abort());
  await context.route('**/localeSettings{,/**,?*}', (route) => route.abort());
  await context.route('**/assets/react-vendor-*.js', (route) =>
    documents > 1 ? route.fallback() : route.abort(),
  );
  await page.goto('./login');
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
});

test('Try Again recovers an offline chunk after an uncontrolled hard reload', {
  tag: '@offline-shell',
}, async ({ page, context, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Hard reload without worker control uses Chromium CDP.');
  await stub(context, async () => 'finish');
  await login(page);
  await expect.poll(async () => (await records(page, 'homeStockDownloads')).length).toBe(1);
  await waitForOfflineShell(page);
  await page.goto('./home');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.reload', { ignoreCache: true });
  await expect(
    page.getByRole('heading', { name: 'Welcome Back, Download', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true);
  await cdp.send('Network.clearBrowserCache');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Stock Management', exact: true }).click();
  await page.getByRole('link', { name: 'Stock On Hand', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Not Available Offline' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toBe(new URL('sw.js', baseURL).href);
  await expect(page.getByRole('heading', { name: 'Stock On Hand', exact: true })).toBeVisible();
});
