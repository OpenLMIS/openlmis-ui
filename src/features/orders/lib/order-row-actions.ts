type ActionOrder = { status: string; supplyingFacility: { id: string } | null };
export type OrderAccess = { canEdit: boolean; retrySupplierIds: readonly string[] };
type ViewOrderAction = 'edit' | 'print' | 'download' | 'retry';

export function viewOrderActions(order: ActionOrder, access: OrderAccess): ViewOrderAction[] {
  if (order.status === 'CREATING') return access.canEdit ? ['edit'] : [];
  const actions: ViewOrderAction[] = ['print', 'download'];
  if (
    order.status === 'TRANSFER_FAILED' &&
    order.supplyingFacility &&
    access.retrySupplierIds.includes(order.supplyingFacility.id)
  ) {
    actions.push('retry');
  }
  return actions;
}

export function fulfillAction(order: { status: string }) {
  return order.status === 'FULFILLING' ? 'continue' : 'start';
}
