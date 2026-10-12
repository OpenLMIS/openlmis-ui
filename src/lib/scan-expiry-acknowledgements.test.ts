import { beforeEach, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  acknowledgeScanExpiry,
  isScanExpiryAcknowledged,
} from '@/lib/scan-expiry-acknowledgements';

beforeEach(() => {
  useLoginData.setState({ referenceDataUserId: null });
  useLoginData.setState({ referenceDataUserId: 'user' });
});
it('remembers a batch by lot id, otherwise by case-insensitive lot code', () => {
  acknowledgeScanExpiry({ id: 'lot', lotCode: 'Batch' });
  expect(isScanExpiryAcknowledged({ id: 'LOT', lotCode: 'Different' })).toBe(true);
  expect(isScanExpiryAcknowledged({ id: 'other', lotCode: 'Batch' })).toBe(false);
  acknowledgeScanExpiry({ lotCode: 'Batch' });
  expect(isScanExpiryAcknowledged({ lotCode: 'BATCH' })).toBe(true);
  expect(isScanExpiryAcknowledged({ lotCode: 'other' })).toBe(false);
});
it('keeps acknowledgement through same-user renewal and clears it on user changes', () => {
  acknowledgeScanExpiry({ id: 'lot', lotCode: 'Batch' });
  useLoginData.setState({ accessToken: 'renewed', expired: false });
  expect(isScanExpiryAcknowledged({ id: 'lot', lotCode: 'Batch' })).toBe(true);
  useLoginData.setState({ referenceDataUserId: 'other' });
  expect(isScanExpiryAcknowledged({ id: 'lot', lotCode: 'Batch' })).toBe(false);
  acknowledgeScanExpiry({ id: 'lot', lotCode: 'Batch' });
  useLoginData.setState({ referenceDataUserId: null });
  expect(isScanExpiryAcknowledged({ id: 'lot', lotCode: 'Batch' })).toBe(false);
});
