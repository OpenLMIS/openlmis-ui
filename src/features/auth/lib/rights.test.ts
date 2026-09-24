import { describe, expect, it } from 'vitest';
import { toRights } from '@/features/auth/lib/rights';

describe('toRights', () => {
  it('keeps each right once, whatever facility or program it was granted for', () => {
    const rights = toRights([
      'REQUISITION_VIEW|f1|p1',
      'REQUISITION_VIEW|f2|p1',
      'ORDERS_VIEW|depot',
      'USERS_MANAGE',
    ]);

    expect([...rights].sort()).toEqual(['ORDERS_VIEW', 'REQUISITION_VIEW', 'USERS_MANAGE']);
  });
});
