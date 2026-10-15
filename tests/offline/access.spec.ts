import { expect } from '@playwright/test';
import { test } from './browser-fixtures';

test('signed-in access and home programs survive an offline reload', {
  tag: '@offline-shell',
}, async ({ page, context }) => {
  let offline = false;
  await context.route('**/api{,/**,?*}', async (route) => {
    if (offline) return route.abort('internetdisconnected');
    const path = new URL(route.request().url()).pathname;
    const fixtures: Record<string, unknown> = {
      '/api/oauth/token': {
        referenceDataUserId: 'offline-user',
        username: 'offline-user',
        access_token: 'fixture-token',
        expires_in: 1800,
      },
      '/api/users/offline-user/permissionStrings': ['STOCK_ADJUST|home|program'],
      '/api/users/offline-user': {
        id: 'offline-user',
        username: 'offline-user',
        firstName: 'Offline',
        lastName: 'User',
        active: true,
        homeFacilityId: 'home',
        roleAssignments: [],
      },
      '/api/users/offline-user/programs': [
        { id: 'program', code: 'MED', name: 'Fixture Medicines', active: true },
      ],
      '/api/facilities/home': {
        id: 'home',
        code: 'HOME',
        name: 'Fixture Clinic',
        active: true,
        enabled: true,
        type: { id: 'type', code: 'CLINIC', name: 'Clinic' },
        geographicZone: { id: 'zone', code: 'ZONE', name: 'Zone', level: { name: 'District' } },
        supportedPrograms: [
          {
            id: 'program',
            code: 'MED',
            name: 'Fixture Medicines',
            supportActive: true,
            supportLocallyFulfilled: true,
          },
        ],
      },
    };
    if (!(path in fixtures)) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: fixtures[path] });
  });
  await context.route('**/localeSettings{,/**,?*}', (route) => route.abort());
  await page.goto('./login?redirect=%2Fstock-management%2Fadjustments');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('offline-user');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Fixture Medicines', exact: true })).toBeVisible();
  await page.waitForFunction(async () => {
    const databases = await indexedDB.databases();
    const name = databases.find((db) => db.name?.endsWith(':offline-user'))?.name;
    if (!name) return false;
    return new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('offlineAccess')) {
          db.close();
          resolve(false);
          return;
        }
        const read = db
          .transaction('offlineAccess')
          .objectStore('offlineAccess')
          .get('offline-user');
        read.onsuccess = () => {
          db.close();
          resolve(Boolean(read.result));
        };
        read.onerror = () => {
          db.close();
          reject(read.error);
        };
      };
    });
  });
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith('/v2/sw.js'),
  );
  await page.waitForFunction(async () => {
    const cache = await caches.open('openlmis-ui-locales');
    return Boolean(await cache.match(new URL('/v2/locales/en.json', location.origin)));
  });
  offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(/\/v2\/stock-management\/adjustments/);
  await expect(page.getByRole('cell', { name: 'Fixture Medicines', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connect To Download This Data' })).toHaveCount(0);
});
