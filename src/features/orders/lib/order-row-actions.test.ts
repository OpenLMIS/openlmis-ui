import { describe, expect, it } from 'vitest';
import { fulfillAction, viewOrderActions } from '@/features/orders/lib/order-row-actions';

const order = { status: 'CREATING', supplyingFacility: { id: 'supplier' } };
const access = { canEdit: false, retrySupplierIds: ['supplier'] };

describe('order row actions', () => {
  it('offers only Edit for creating orders with create access', () => {
    expect(viewOrderActions(order, access)).toEqual([]);
    expect(viewOrderActions(order, { ...access, canEdit: true })).toEqual(['edit']);
  });

  it('offers retry only for failed transfers at an allowed supplier', () => {
    const failed = { ...order, status: 'TRANSFER_FAILED' };
    expect(viewOrderActions(failed, access)).toEqual(['print', 'download', 'retry']);
    expect(viewOrderActions(failed, { ...access, retrySupplierIds: ['other'] })).toEqual([
      'print',
      'download',
    ]);
    expect(viewOrderActions({ ...failed, supplyingFacility: null }, access)).toEqual([
      'print',
      'download',
    ]);
    expect(viewOrderActions({ ...order, status: 'ORDERED' }, access)).toEqual([
      'print',
      'download',
    ]);
  });

  it('continues fulfilling orders and starts ordered ones', () => {
    expect(fulfillAction({ status: 'FULFILLING' })).toBe('continue');
    expect(fulfillAction({ status: 'ORDERED' })).toBe('start');
  });
});
