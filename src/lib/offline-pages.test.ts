import '@/routes/-offline-pages';
import { expect, it } from 'vitest';
import { canRetainPageOffline, isOfflineCapable } from '@/lib/offline-pages';

it('retains an open requisition offline without enabling a cold open or its list', () => {
  expect(canRetainPageOffline('/requisitions/view/r')).toBe(true);
  expect(isOfflineCapable('/requisitions/view/r')).toBe(false);
  expect(canRetainPageOffline('/requisitions/view')).toBe(false);
  expect(canRetainPageOffline('/requisitions/viewer/r')).toBe(false);
  expect(canRetainPageOffline('/administration/users')).toBe(false);
  expect(canRetainPageOffline('/stock-management/stock-on-hand')).toBe(true);
});
