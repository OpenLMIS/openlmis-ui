import { expect, it } from 'vitest';
import { orderReturnState, orderReturnTarget } from '@/features/orders/lib/order-return';

it('uses the caller fallback when there is no order return state', () => {
  const create = { to: '/requisitions/create-orders' as const, search: {} };
  const fulfill = { to: '/orders/fulfillment' as const, search: { page: 2 } };
  expect(orderReturnTarget({}, create)).toEqual(create);
  expect(orderReturnTarget({}, fulfill)).toEqual(fulfill);
});

it.each(['/orders/view', '/orders/fulfillment', '/orders/proof-of-delivery'] as const)(
  'preserves the saved list search for %s over the caller fallback',
  (to) => {
    const target = { to, search: { page: 3, programId: 'program' } };
    expect(orderReturnTarget(orderReturnState(target), { to: '/orders/view', search: {} })).toEqual(
      target,
    );
  },
);
