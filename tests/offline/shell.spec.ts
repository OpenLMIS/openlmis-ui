import { expect, test } from '@playwright/test';

test('production shell reloads offline under /v2 after worker takeover', async ({
  page,
  context,
}) => {
  await context.route('**/api{,/**,?*}', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith('/v2/sw.js'),
  );
  await page.waitForFunction(async () => {
    const cache = await caches.open('openlmis-ui-locales');
    return Boolean(await cache.match(new URL('/v2/locales/en.json', location.origin)));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/v2\/login/);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain(
    '/v2/sw.js',
  );
});
