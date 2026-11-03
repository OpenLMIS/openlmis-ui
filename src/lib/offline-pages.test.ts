import '@/routes/-offline-pages';
import { expect, it } from 'vitest';
import { canRetainPageOffline, isOfflineCapable } from '@/lib/offline-pages';

it('permits saved requisition routes while unrelated routes still need a connection', () => {
  expect(canRetainPageOffline('/requisitions/view/r')).toBe(true);
  expect(isOfflineCapable('/requisitions/view/r')).toBe(true);
  expect(isOfflineCapable('/requisitions/approve/batch')).toBe(true);
  expect(canRetainPageOffline('/requisitions/view')).toBe(true);
  expect(canRetainPageOffline('/requisitions/viewer/r')).toBe(false);
  expect(canRetainPageOffline('/administration/users')).toBe(false);
  expect(canRetainPageOffline('/stock-management/stock-on-hand')).toBe(true);
});
