import { expect, it } from 'vitest';
import { alertsByDevice, alertText } from '@/features/cce-inventory/lib/alerts';
import type { InventoryAlert } from '@/features/cce-inventory/lib/types';

const alert = (overrides: Partial<InventoryAlert> = {}): InventoryAlert => ({
  alert_id: 'a1',
  alert_type: 'no_data',
  device_id: 'fridge',
  start_ts: '2018-02-26T11:41:45Z',
  end_ts: null,
  dismissed: false,
  status: { 'en-US': 'Less than 50% data available for this equipment' },
  ...overrides,
});

it('counts an alert as active only while it has no end and is not dismissed, as legacy', () => {
  const grouped = alertsByDevice([
    alert({ alert_id: 'open' }),
    alert({ alert_id: 'ended', end_ts: '2018-03-01T00:00:00Z' }),
    alert({ alert_id: 'dismissed', dismissed: true }),
    alert({ alert_id: 'other device', device_id: 'freezer', end_ts: '2018-03-01T00:00:00Z' }),
  ]);

  expect(grouped.get('fridge')?.active.map((a) => a.alert_id)).toEqual(['open']);
  expect(grouped.get('fridge')?.past.map((a) => a.alert_id)).toEqual(['ended', 'dismissed']);
  expect(grouped.get('freezer')).toEqual({ active: [], past: [expect.anything()] });
  expect(grouped.get('cold box')).toBeUndefined();
});

it('reads an alert in the page language, then en-US, then any text the server sent', () => {
  const text = { 'en-US': 'No data', 'fr-FR': 'Pas de données', pt: 'Sem dados' };

  expect(alertText(alert({ status: text }), 'fr')).toBe('Pas de données');
  expect(alertText(alert({ status: text }), 'pt')).toBe('Sem dados');
  expect(alertText(alert({ status: text }), 'ar')).toBe('No data');
  expect(alertText(alert({ status: { sw: 'Hakuna data' } }), 'ar')).toBe('Hakuna data');
  expect(alertText(alert({ status: {} }), 'en')).toBe('');
});
