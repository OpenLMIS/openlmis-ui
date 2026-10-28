import type {
  RequisitionLineItem,
  RequisitionReason,
} from '@/features/requisitions/lib/requisition';
import { wholeNumberText } from '@/lib/whole-number';

type Adjustment = NonNullable<RequisitionLineItem['stockAdjustments']>[number];
export const adjustmentQuantitySchema = wholeNumberText(
  {
    required: 'stock-events.required',
    invalid: 'requisitions.edit.adjustment-positive',
    tooLarge: 'stock-events.number-too-large',
  },
  { min: { value: 1, tooSmall: 'requisitions.edit.adjustment-positive' } },
);
export const adjustmentTotal = (
  adjustments: readonly Adjustment[],
  reasons: readonly RequisitionReason[],
) =>
  adjustments.reduce((total, item) => {
    const reason = reasons.find((reason) => reason.id === item.reasonId);
    return total + (reason ? item.quantity * (reason.reasonType === 'CREDIT' ? 1 : -1) : 0);
  }, 0);
