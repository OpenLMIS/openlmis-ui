import type {
  RequisitionProgram,
  RequisitionTemplate,
} from '@/features/requisitions/lib/requisition';
import type { RequisitionStatus } from '@/lib/requisition-status';
import { RIGHTS } from '@/lib/rights';

export type RequisitionAction =
  | 'sync'
  | 'submit'
  | 'submitAndAuthorize'
  | 'authorize'
  | 'approve'
  | 'reject'
  | 'delete'
  | 'skip'
  | 'print';
const SHIPPED_ACTIONS: readonly RequisitionAction[] = [
  'sync',
  'submit',
  'submitAndAuthorize',
  'authorize',
  'approve',
  'reject',
  'skip',
  'delete',
  'print',
];
type CapabilityContext = {
  status: RequisitionStatus;
  emergency: boolean;
  template: RequisitionTemplate;
  program: RequisitionProgram;
  grants: readonly string[];
  approvalNodes: readonly string[];
  currentNodeId?: string | null;
  unskipWhenApproving?: boolean;
  isSplit?: boolean;
};
type CapabilityGate = {
  actions: readonly RequisitionAction[];
  approverEditing?: boolean;
  patientsEditing?: boolean;
};

export function requisitionCapabilities(
  context: CapabilityContext,
  gate: CapabilityGate = {
    actions: SHIPPED_ACTIONS,
    approverEditing: true,
    patientsEditing: false,
  },
) {
  const { status, emergency, template, program, grants } = context;
  const has = (right: string) => grants.includes(right);
  const creator =
    (status === 'INITIATED' || status === 'REJECTED') && has(RIGHTS.requisitionCreate);
  const authorizer = status === 'SUBMITTED' && has(RIGHTS.requisitionAuthorize);
  const approver =
    (status === 'AUTHORIZED' || status === 'IN_APPROVAL') &&
    !!context.currentNodeId &&
    context.approvalNodes.includes(context.currentNodeId);
  const canEdit = creator || authorizer || approver;
  const skipColumn = template.columnsMap.skipped;
  const hasSkip = !!skipColumn?.isDisplayed;
  const canDelete =
    has(RIGHTS.requisitionDelete) &&
    ((['INITIATED', 'REJECTED', 'SKIPPED'].includes(status) && has(RIGHTS.requisitionCreate)) ||
      (status === 'SUBMITTED' && has(RIGHTS.requisitionAuthorize)));
  const allowed: RequisitionAction[] = [];
  if (creator || authorizer || approver) allowed.push('sync');
  if (creator) allowed.push(program.skipAuthorization ? 'submitAndAuthorize' : 'submit');
  if (authorizer) allowed.push('authorize');
  if (approver) {
    allowed.push('approve');
    if (!context.isSplit) allowed.push('reject');
  }
  if (canDelete) allowed.push('delete');
  if (creator && !emergency && program.periodsSkippable) allowed.push('skip');
  allowed.push('print');
  const editingOpen = !template.patientsTabEnabled || gate.patientsEditing === true;
  const editable = editingOpen && canEdit && (!approver || gate.approverEditing === true);
  const actionsOpen = editingOpen && (!approver || gate.approverEditing === true);
  const approvalColumn = template.patientsTabEnabled ? 'totalReceivedQuantity' : 'approvedQuantity';
  const approvalColumns = [approvalColumn, 'remarks'];
  return {
    editable,
    editableColumns: editable
      ? approver
        ? approvalColumns
        : Object.values(template.columnsMap)
            .filter(
              (c) =>
                c.isDisplayed &&
                c.source === 'USER_INPUT' &&
                c.name !== 'approvedQuantity' &&
                c.name !== approvalColumn &&
                c.name !== 'remarks' &&
                !(
                  program.name === 'TB Monthly' &&
                  (c.name === 'totalReceivedQuantity' ||
                    c.name === 'numberOfPatientsOnTreatmentNextMonth')
                ),
            )
            .map((c) => c.name)
      : [],
    actions: allowed.filter(
      (action) => gate.actions.includes(action) && (action === 'print' || actionsOpen),
    ),
    comments:
      editingOpen &&
      (canEdit ||
        ((status === 'INITIATED' || status === 'REJECTED') && has(RIGHTS.requisitionAuthorize))) &&
      (!approver || gate.approverEditing === true),
    addFullSupplyProduct:
      editable &&
      (creator || authorizer) &&
      (emergency || (hasSkip && skipColumn.option?.optionName === 'hideSkippedLineItems')),
    addNonFullSupplyProduct: editable && (creator || authorizer) && !!program.showNonFullSupplyTab,
    skipLines:
      editable &&
      !emergency &&
      hasSkip &&
      (creator || authorizer || (approver && !!context.unskipWhenApproving)),
    approver,
    deferred: allowed.filter(
      (action) => !gate.actions.includes(action) || (action !== 'print' && !actionsOpen),
    ),
  };
}
