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
export function requisitionCapabilities(context: CapabilityContext) {
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
  const approvalColumn = template.patientsTabEnabled ? 'totalReceivedQuantity' : 'approvedQuantity';
  const approvalColumns = [
    approvalColumn,
    ...(template.patientsTabEnabled ? ['numberOfPatientsOnTreatmentNextMonth'] : []),
    'remarks',
  ];
  return {
    editable: canEdit,
    patientsEditable: !!template.patientsTabEnabled && (creator || authorizer),
    editableColumns: canEdit
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
                  template.patientsTabEnabled &&
                  (c.name === 'totalReceivedQuantity' ||
                    c.name === 'numberOfPatientsOnTreatmentNextMonth')
                ),
            )
            .map((c) => c.name)
      : [],
    actions: allowed,
    comments:
      canEdit ||
      ((status === 'INITIATED' || status === 'REJECTED') && has(RIGHTS.requisitionAuthorize)),
    addFullSupplyProduct:
      canEdit &&
      (creator || authorizer) &&
      (emergency || (hasSkip && skipColumn.option?.optionName === 'hideSkippedLineItems')),
    addNonFullSupplyProduct: canEdit && (creator || authorizer) && !!program.showNonFullSupplyTab,
    skipLines:
      canEdit &&
      !emergency &&
      hasSkip &&
      (creator || authorizer || (approver && !!context.unskipWhenApproving)),
    approver,
  };
}

export function isApprovalKind(kind: string): kind is 'approve' | 'reject' {
  return kind === 'approve' || kind === 'reject';
}
