import type { BrowserContext } from '@playwright/test';
import { stub } from './fixtures';

export const home = '11111111-1111-4111-8111-111111111111';
export const program = '22222222-2222-4222-8222-222222222222';
export const requisition = '33333333-3333-4333-8333-333333333333';
export const batchId = '44444444-4444-4444-8444-444444444444';
const node = 'node';
const period = {
  id: 'period',
  name: 'November 2026',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  durationInMonths: 1,
};
const facility = {
  id: home,
  code: 'HOME',
  name: 'Fixture Clinic',
  type: { id: 'type' },
  geographicZone: { name: 'Zone', level: { name: 'District' } },
};
const programRecord = {
  id: program,
  code: 'MED',
  name: 'Fixture Medicines',
  active: true,
  enableDatePhysicalStockCountCompleted: false,
};
const product = (id: string, name: string) => ({
  id,
  productCode: id.toUpperCase(),
  fullProductName: name,
  netContent: 1,
  roundToZero: false,
  meta: { versionNumber: 1 },
  dispensable: { displayUnit: 'tablet' },
  programs: [
    {
      programId: program,
      fullSupply: true,
      pricePerPack: 1,
      orderableCategoryDisplayName: 'Medicines',
      orderableCategoryDisplayOrder: 1,
    },
  ],
});
export function single(id = requisition) {
  return {
    id,
    emergency: id === requisition,
    status: id === batchId ? 'AUTHORIZED' : 'INITIATED',
    facility: { id: home },
    program: { id: program },
    processingPeriod: { id: 'period' },
    supervisoryNode: node,
    createdDate: '2026-11-03T10:00:00Z',
    modifiedDate: '2026-11-03T10:00:00Z',
    draftStatusMessage: '',
    availableProducts: [
      { id: 'product', versionNumber: 1 },
      { id: 'extra', versionNumber: 1 },
    ],
    template: {
      populateStockOnHandFromStockCards: false,
      patientsTabEnabled: true,
      columnsMap: {
        'orderable.productCode': {
          name: 'orderable.productCode',
          label: 'Product Code',
          isDisplayed: true,
          displayOrder: 1,
          source: 'REFERENCE_DATA',
        },
        'orderable.fullProductName': {
          name: 'orderable.fullProductName',
          label: 'Product',
          isDisplayed: true,
          displayOrder: 2,
          source: 'REFERENCE_DATA',
        },
        requestedQuantity: {
          name: 'requestedQuantity',
          label: 'Requested Quantity',
          isDisplayed: true,
          displayOrder: 3,
          source: 'USER_INPUT',
        },
      },
    },
    requisitionLineItems: [
      {
        id: 'line',
        orderable: { id: 'product', versionNumber: 1 },
        approvedProduct: { id: 'approved', versionNumber: 1 },
        requestedQuantity: 1,
        skipped: false,
      },
    ],
    statusHistory: [{ status: 'AUTHORIZED', createdDate: '2026-11-03T10:00:00Z' }],
  };
}
const summary = (id: string) => ({
  ...single(id),
  program: programRecord,
  facility,
  processingPeriod: period,
  statusChanges: { AUTHORIZED: { changeDate: '2026-11-03T10:00:00Z' } },
});
export async function requisitionStubs(
  context: BrowserContext,
  mutations: string[],
  controls: {
    modifiedDate?: string;
    requestedQuantity?: number;
    noCreate?: boolean;
    missingAvailable?: boolean;
    userId?: string;
    supervisionOnlyView?: boolean;
  } = {},
) {
  await stub(context, async () => 'finish', { home, program });
  await context.route('**/config.json', (route) =>
    route.fulfill({
      json: {
        authServerClientId: 'fixture-client',
        authServerClientSecret: 'fixture-secret',
        featureFlags: { BATCH_APPROVE_SCREEN: true },
      },
    }),
  );
  await context.route('**/localeSettings', (route) =>
    route.fulfill({
      json: {
        currencyCode: 'USD',
        currencySymbol: '$',
        currencyDecimalPlaces: 2,
        groupingSize: 3,
        groupingSeparator: ',',
        decimalSeparator: '.',
        currencySymbolSide: 'left',
        timeZoneId: 'UTC',
      },
    }),
  );
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const userId = controls.userId ?? 'download-user';
    const readPost =
      request.method() === 'POST' &&
      ['/api/orderables/search', '/api/facilityTypeApprovedProducts/search'].includes(path);
    if (request.method() !== 'GET' && path !== '/api/oauth/token' && !readPost) {
      mutations.push(`${request.method()} ${path}`);
      await route.fulfill({ status: 503, json: { message: 'Fixture blocks all server writes' } });
      return;
    }
    let data: unknown;
    if (path === '/api/oauth/token')
      data = {
        referenceDataUserId: userId,
        username: userId,
        access_token: 'fixture-token',
        expires_in: 1800,
      };
    else if (path === `/api/users/${userId}/programs`) data = [programRecord];
    else if (path === `/api/users/${userId}/permissionStrings`)
      data = [
        ...(controls.supervisionOnlyView ? [] : [`REQUISITION_VIEW|${home}|${program}`]),
        ...(controls.noCreate ? [] : [`REQUISITION_CREATE|${home}|${program}`]),
        `REQUISITION_APPROVE|${home}|${program}`,
        `REQUISITION_AUTHORIZE|${home}|${program}`,
      ];
    else if (path === `/api/users/${userId}`)
      data = {
        id: userId,
        username: userId,
        firstName: 'Download',
        active: true,
        homeFacilityId: home,
        roleAssignments: [{ roleId: 'approver', programId: program, supervisoryNodeId: node }],
      };
    else if (path === '/api/roles')
      data = [
        { id: 'approver', rights: [{ name: 'REQUISITION_VIEW' }, { name: 'REQUISITION_APPROVE' }] },
      ];
    else if (path === '/api/programs') data = [programRecord];
    else if (path === `/api/programs/${program}`) data = programRecord;
    else if (path === '/api/supervisoryNodes') {
      const nodes = [
        {
          id: node,
          requisitionGroup: { id: 'group' },
          ...(controls.supervisionOnlyView ? { partnerNodeOf: { id: 'partner' } } : {}),
        },
        ...(controls.supervisionOnlyView
          ? [{ id: 'partner', requisitionGroup: { id: 'group' } }]
          : []),
      ];
      const ids = url.searchParams.getAll('id');
      data = {
        content: nodes.filter((node) => !ids.length || ids.includes(node.id)),
        totalPages: 1,
      };
    } else if (path === '/api/requisitionGroups/group')
      data = {
        id: 'group',
        memberFacilities: [{ ...facility, supportedPrograms: [programRecord] }],
      };
    else if (path === `/api/facilities/${home}`)
      data = {
        ...facility,
        active: true,
        enabled: true,
        geographicZone: { ...facility.geographicZone, id: 'zone', code: 'Z' },
        supportedPrograms: [{ ...programRecord, supportActive: true }],
      };
    else if (path === '/api/processingPeriods/period') data = period;
    else if (path === '/api/orderables/search') {
      const body = request.postDataJSON();
      data = {
        content: [
          product('product', 'Fixture Medicine'),
          product('extra', 'Available Medicine'),
        ].filter(
          (p) =>
            (!controls.missingAvailable || p.id !== 'extra') &&
            body.identities.some((i: { id: string }) => i.id === p.id),
        ),
        totalPages: 1,
      };
    } else if (path === '/api/facilityTypeApprovedProducts/search')
      data = {
        content: [{ id: 'approved', meta: { versionNumber: 1 }, maxPeriodsOfStock: 3 }],
        totalPages: 1,
      };
    else if (path === '/api/requisitions/search')
      data = {
        content: [summary(requisition), summary(batchId)],
        totalElements: 2,
        totalPages: 1,
        number: 0,
        size: 20,
      };
    else if (path === '/api/requisitions/requisitionsForApproval')
      data = { content: [summary(batchId)], totalElements: 1, totalPages: 1, number: 0, size: 20 };
    else if (
      path === `/api/v2/requisitions/${requisition}` ||
      path === `/api/v2/requisitions/${batchId}`
    )
      data = {
        ...single(path.split('/').at(-1)),
        ...(controls.modifiedDate ? { modifiedDate: controls.modifiedDate } : {}),
        ...(controls.requestedQuantity === undefined
          ? {}
          : {
              requisitionLineItems: single().requisitionLineItems.map((line) => ({
                ...line,
                requestedQuantity: controls.requestedQuantity,
              })),
            }),
      };
    else if (path.endsWith('/statusMessages'))
      data = [
        {
          id: 'message',
          status: 'INITIATED',
          body: 'Saved history comment',
          createdDate: '2026-11-03T10:00:00Z',
          authorFirstName: 'Fixture Author',
        },
      ];
    else if (path === '/api/requisitions' && url.searchParams.has('retrieveAll'))
      data = {
        requisitionDtos: [
          {
            id: batchId,
            status: 'AUTHORIZED',
            modifiedDate: '2026-11-03T10:00:00Z',
            facilityName: 'Fixture Clinic',
            periodName: period.name,
            requisitionLineItems: [
              {
                id: 'batch-line',
                orderable: product('product', 'Fixture Medicine'),
                approvedQuantity: 0,
                skipped: false,
              },
            ],
          },
        ],
        requisitionErrors: [],
      };
    if (data === undefined) await route.fallback();
    else await route.fulfill({ json: data, headers: { etag: '"fixture-v1"' } });
  });
}
