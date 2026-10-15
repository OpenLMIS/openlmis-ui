import type { BrowserContext, Page } from '@playwright/test';

export async function stub(
  context: BrowserContext,
  stock: () => Promise<'finish' | 'fail'>,
  ids: { home: string; program: string; programName?: string } = {
    home: 'home',
    program: 'program',
  },
  userId = 'download-user',
) {
  const programs = [ids.program, 'never'].map((id) => ({
    id,
    code: id,
    name: id === ids.program ? (ids.programName ?? 'Fixture Medicines') : 'Never Downloaded',
    active: true,
  }));
  await context.route('**/api{,/**,?*}', async (route) => {
    const url = new URL(route.request().url());
    const fixtures: Record<string, unknown> = {
      '/api/oauth/token': {
        referenceDataUserId: userId,
        username: userId,
        access_token: 'fixture-token',
        expires_in: 1800,
      },
      [`/api/users/${userId}/permissionStrings`]: programs.flatMap(({ id }) => [
        `STOCK_ADJUST|${ids.home}|${id}`,
        `STOCK_CARDS_VIEW|${ids.home}|${id}`,
      ]),
      [`/api/users/${userId}`]: {
        id: userId,
        username: userId,
        firstName: 'Download',
        lastName: 'User',
        active: true,
        homeFacilityId: ids.home,
        roleAssignments: [],
      },
      [`/api/users/${userId}/programs`]: programs,
      [`/api/facilities/${ids.home}`]: {
        id: ids.home,
        code: 'HOME',
        name: 'Fixture Clinic',
        active: true,
        enabled: true,
        type: { id: 'type', code: 'CLINIC', name: 'Clinic' },
        geographicZone: { id: 'zone', code: 'ZONE', name: 'Zone', level: { name: 'District' } },
        supportedPrograms: programs.map((program) => ({
          ...program,
          supportActive: true,
          supportLocallyFulfilled: true,
        })),
      },
      '/api/facilities/minimal': {
        content: [
          { id: ids.home, code: 'HOME', name: 'Fixture Clinic', supportedPrograms: programs },
        ],
      },
      '/api/stockCardSummaries': { content: [], totalElements: 0, totalPages: 0 },
      '/api/orderables/search': {
        content: [
          {
            id: 'product',
            productCode: 'MED',
            fullProductName: 'Fixture Product',
            description: null,
            netContent: 10,
            meta: { versionNumber: 1 },
          },
        ],
        totalPages: 1,
      },
      '/api/validReasons': [
        {
          hidden: false,
          reason: {
            id: 'reason',
            name: 'Damaged',
            reasonType: 'DEBIT',
            reasonCategory: 'ADJUSTMENT',
            isFreeTextAllowed: true,
            tags: [],
          },
        },
      ],
    };
    if (url.pathname === '/api/v2/stockCardSummaries') {
      if (url.searchParams.get('programId') === 'never')
        return route.fulfill({ status: 503, json: { message: 'Unavailable program' } });
      if ((await stock()) === 'fail') return route.abort('timedout');
      return route
        .fulfill({
          json: {
            content: [
              {
                orderable: { id: 'product', versionNumber: 1 },
                canFulfillForMe: [
                  {
                    stockCard: { id: 'card' },
                    orderable: { id: 'product' },
                    lot: null,
                    stockOnHand: 20,
                  },
                ],
              },
            ],
            totalPages: 1,
          },
        })
        .catch(() => undefined);
    }
    return route.fulfill(
      url.pathname in fixtures ? { json: fixtures[url.pathname] } : { status: 404, json: {} },
    );
  });
  await context.route('**/localeSettings{,/**,?*}', (route) =>
    route.fulfill({ json: { timeZoneId: 'UTC' } }),
  );
}
export async function login(
  page: Page,
  username = 'download-user',
  programName = 'Fixture Medicines',
) {
  await page.goto('./login?redirect=%2Fstock-management%2Fadjustments');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(/\/stock-management\/adjustments$/);
  await page.getByRole('cell', { name: programName, exact: true }).waitFor();
}
export async function generation(page: Page) {
  return page.evaluate(async () => {
    const name = (await indexedDB.databases()).find((db) =>
      db.name?.endsWith(':download-user'),
    )?.name;
    if (!name) return null;
    return new Promise<string | null>((resolve) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        const db = request.result;
        const read = db
          .transaction('adjustmentDownloads')
          .objectStore('adjustmentDownloads')
          .get(['home', 'program']);
        read.onsuccess = () => {
          db.close();
          resolve(read.result?.generation ?? null);
        };
      };
    });
  });
}
