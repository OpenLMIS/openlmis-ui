import type {
  RequisitionProgram,
  RequisitionStatus,
  RequisitionTemplate,
} from '@/features/requisitions/lib/requisition';

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
export const SHIPPED_ACTIONS: readonly RequisitionAction[] = ['print'];
export const SHIPPED_EDITING = false;
export type CapabilityContext = {
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
export type CapabilityGate = { actions: readonly RequisitionAction[]; editing: boolean };

export function requisitionCapabilities(
  context: CapabilityContext,
  gate: CapabilityGate = { actions: SHIPPED_ACTIONS, editing: SHIPPED_EDITING },
) {
  const { status, emergency, template, program, grants } = context;
  const has = (right: string) => grants.includes(`REQUISITION_${right}`);
  const creator = (status === 'INITIATED' || status === 'REJECTED') && has('CREATE');
  const authorizer = status === 'SUBMITTED' && has('AUTHORIZE');
  const approver =
    (status === 'AUTHORIZED' || status === 'IN_APPROVAL') &&
    !!context.currentNodeId &&
    context.approvalNodes.includes(context.currentNodeId);
  const canEdit = creator || authorizer || approver;
  const skipColumn = template.columnsMap.skipped;
  const hasSkip = !!skipColumn?.isDisplayed;
  const canDelete =
    has('DELETE') &&
    ((['INITIATED', 'REJECTED', 'SKIPPED'].includes(status) && has('CREATE')) ||
      (status === 'SUBMITTED' && has('AUTHORIZE')));
  const allowed: RequisitionAction[] = [];
  if (creator || authorizer || (approver && has('APPROVE'))) allowed.push('sync');
  if (creator) allowed.push(program.skipAuthorization ? 'submitAndAuthorize' : 'submit');
  if (authorizer) allowed.push('authorize');
  if (approver) {
    allowed.push('approve');
    if (!context.isSplit) allowed.push('reject');
  }
  if (canDelete) allowed.push('delete');
  if (creator && !emergency && program.periodsSkippable && hasSkip) allowed.push('skip');
  allowed.push('print');
  const editable = gate.editing && canEdit;
  const approvalColumns =
    program.name === 'TB Monthly'
      ? ['totalReceivedQuantity', 'numberOfPatientsOnTreatmentNextMonth', 'remarks']
      : ['approvedQuantity', 'remarks'];
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
                !(
                  program.name === 'TB Monthly' &&
                  (c.name === 'totalReceivedQuantity' ||
                    c.name === 'numberOfPatientsOnTreatmentNextMonth')
                ),
            )
            .map((c) => c.name)
      : [],
    actions: allowed.filter((action) => gate.actions.includes(action)),
    comments: editable,
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
    deferred: allowed.filter((action) => !gate.actions.includes(action)),
  };
}
