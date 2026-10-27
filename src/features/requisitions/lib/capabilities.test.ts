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

it('gates every editing capability and exposes allowed actions as deferred', () => {
  expect(requisitionCapabilities(context)).toMatchObject({
    editable: false,
    editableColumns: [],
    actions: ['print'],
    comments: false,
    addFullSupplyProduct: false,
    addNonFullSupplyProduct: false,
    skipLines: false,
    deferred: ['sync', 'submit', 'delete', 'skip'],
  });
  expect(requisitionCapabilities({ ...context, status: 'SKIPPED' }).deferred).toEqual(['delete']);
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
  expect(policy({ ...approval, grants: [] }).actions).toEqual(['approve', 'reject', 'print']);
  expect(policy({ ...approval, isSplit: true }).actions).not.toContain('reject');
  expect(
    policy({ ...approval, program: { id: 'program', name: 'TB Monthly' } }).editableColumns,
  ).toEqual(['totalReceivedQuantity', 'numberOfPatientsOnTreatmentNextMonth', 'remarks']);
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
