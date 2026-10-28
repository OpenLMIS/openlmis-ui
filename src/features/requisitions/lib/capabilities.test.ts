import { expect, it } from 'vitest';
import type { CapabilityContext } from '@/features/requisitions/lib/capabilities';
import { requisitionCapabilities } from '@/features/requisitions/lib/capabilities';
import { column } from '@/features/requisitions/lib/fixtures/builders';

const context: CapabilityContext = {
  status: 'INITIATED',
  emergency: false,
  template: {
    columnsMap: {
      requestedQuantity: column('requestedQuantity', 1, { source: 'USER_INPUT' }),
      skipped: column('skipped', 0, {
        source: 'USER_INPUT',
        option: { optionName: 'hideSkippedLineItems' },
      }),
    },
  },
  program: { id: 'program', periodsSkippable: true, showNonFullSupplyTab: true },
  grants: ['REQUISITION_CREATE', 'REQUISITION_DELETE'],
  approvalNodes: ['node1'],
  currentNodeId: 'node1',
};
const future = {
  editing: true,
  approverEditing: true,
  patientsEditing: true,
  actions: [
    'sync',
    'submit',
    'submitAndAuthorize',
    'authorize',
    'approve',
    'reject',
    'delete',
    'skip',
    'print',
  ] as const,
};
const policy = (overrides: Partial<CapabilityContext> = {}) =>
  requisitionCapabilities({ ...context, ...overrides }, future);

it('ships creator and authorizer editing while keeping approvers and patients closed', () => {
  expect(requisitionCapabilities(context)).toMatchObject({
    editable: true,
    actions: ['sync', 'submit', 'delete', 'skip', 'print'],
    comments: true,
  });
  expect(
    requisitionCapabilities({ ...context, status: 'SUBMITTED', grants: ['REQUISITION_AUTHORIZE'] }),
  ).toMatchObject({ editable: true, actions: ['sync', 'authorize', 'print'] });
  expect(requisitionCapabilities({ ...context, status: 'AUTHORIZED' })).toMatchObject({
    editable: false,
    actions: ['print'],
  });
  expect(
    requisitionCapabilities({
      ...context,
      template: { ...context.template, patientsTabEnabled: true },
    }),
  ).toMatchObject({ editable: false, actions: ['print'] });
});
it('allows whole-record skip without a skip column and comments for an initiated authorizer', () => {
  expect(policy({ template: { columnsMap: {} } }).actions).toContain('skip');
  expect(requisitionCapabilities({ ...context, grants: ['REQUISITION_AUTHORIZE'] })).toMatchObject({
    editable: false,
    comments: true,
    actions: ['print'],
  });
});
it.each(['INITIATED', 'REJECTED'])(
  'allows creators in %s and honors skip authorization',
  (status) => {
    expect(policy({ status: status as CapabilityContext['status'] })).toMatchObject({
      editable: true,
      editableColumns: ['requestedQuantity', 'skipped'],
      addFullSupplyProduct: true,
      addNonFullSupplyProduct: true,
      skipLines: true,
    });
    expect(
      policy({
        status: status as CapabilityContext['status'],
        program: { ...context.program, skipAuthorization: true },
      }).actions,
    ).toContain('submitAndAuthorize');
  },
);
it('allows authorizers only on submitted and makes final statuses read-only', () => {
  expect(policy({ status: 'SUBMITTED' }).editable).toBe(false);
  expect(
    policy({ status: 'SUBMITTED', grants: ['REQUISITION_AUTHORIZE', 'REQUISITION_DELETE'] })
      .actions,
  ).toEqual(['sync', 'authorize', 'delete', 'print']);
  for (const status of ['APPROVED', 'RELEASED', 'RELEASED_WITHOUT_ORDER', 'SKIPPED'] as const)
    expect(policy({ status }).editable).toBe(false);
});
it('predicts approval at the current node, independently from facility APPROVE used for Sync', () => {
  const approval = { status: 'AUTHORIZED' as const, grants: ['REQUISITION_APPROVE'] };
  expect(policy(approval)).toMatchObject({
    approver: true,
    editableColumns: ['approvedQuantity', 'remarks'],
    actions: ['sync', 'approve', 'reject', 'print'],
  });
  expect(policy({ ...approval, currentNodeId: 'node2' })).toMatchObject({
    approver: false,
    editable: false,
    actions: ['print'],
  });
  expect(policy({ ...approval, grants: [] }).actions).toEqual([
    'sync',
    'approve',
    'reject',
    'print',
  ]);
  expect(policy({ ...approval, isSplit: true }).actions).not.toContain('reject');
  expect(
    policy({ ...approval, program: { id: 'program', name: 'TB Monthly' } }).editableColumns,
  ).toEqual([
    'approvedQuantity',
    'remarks',
    'numberOfPatientsOnTreatmentNextMonth',
    'totalReceivedQuantity',
  ]);
});
it('limits product additions and line skipping, including approver unskip', () => {
  expect(policy({ emergency: true })).toMatchObject({
    addFullSupplyProduct: true,
    skipLines: false,
  });
  expect(policy({ template: { columnsMap: {} } })).toMatchObject({
    addFullSupplyProduct: false,
    skipLines: false,
  });
  expect(
    policy({ program: { id: 'program', showNonFullSupplyTab: false } }).addNonFullSupplyProduct,
  ).toBe(false);
  expect(policy({ status: 'IN_APPROVAL', grants: ['REQUISITION_APPROVE'] }).skipLines).toBe(false);
  expect(
    policy({ status: 'IN_APPROVAL', grants: ['REQUISITION_APPROVE'], unskipWhenApproving: true })
      .skipLines,
  ).toBe(true);
  expect(
    requisitionCapabilities({
      ...context,
      status: 'IN_APPROVAL',
      grants: ['REQUISITION_APPROVE'],
      unskipWhenApproving: true,
    }).skipLines,
  ).toBe(false);
});

it.each([false, true])(
  'uses patientsTabEnabled=%s for approval columns independently of the program name',
  (patientsTabEnabled) => {
    expect(
      policy({ status: 'AUTHORIZED', template: { columnsMap: {}, patientsTabEnabled } })
        .editableColumns,
    ).toEqual([patientsTabEnabled ? 'totalReceivedQuantity' : 'approvedQuantity', 'remarks']);
    expect(
      policy({
        status: 'AUTHORIZED',
        template: { columnsMap: {}, patientsTabEnabled },
        program: { id: 'program', name: 'TB Monthly' },
      }).editableColumns,
    ).toEqual(
      patientsTabEnabled
        ? ['totalReceivedQuantity', 'remarks', 'numberOfPatientsOnTreatmentNextMonth']
        : [
            'approvedQuantity',
            'remarks',
            'numberOfPatientsOnTreatmentNextMonth',
            'totalReceivedQuantity',
          ],
    );
  },
);
it.each(['INITIATED', 'SUBMITTED'] as const)(
  'excludes approval fields for the editor in %s',
  (status) => {
    expect(
      policy({
        status,
        grants: ['REQUISITION_CREATE', 'REQUISITION_AUTHORIZE'],
        template: {
          columnsMap: Object.fromEntries(
            ['requestedQuantity', 'approvedQuantity', 'remarks'].map((name) => [
              name,
              column(name, 0, { source: 'USER_INPUT' }),
            ]),
          ),
        },
      }).editableColumns,
    ).toEqual(['requestedQuantity']);
  },
);
it('denies delete on INITIATED with only CREATE', () => {
  expect(policy({ grants: ['REQUISITION_CREATE'] }).actions).not.toContain('delete');
  expect(
    requisitionCapabilities({ ...context, grants: ['REQUISITION_CREATE'] }).deferred,
  ).not.toContain('delete');
});
