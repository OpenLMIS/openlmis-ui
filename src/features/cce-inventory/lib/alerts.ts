import type { InventoryAlert } from '@/features/cce-inventory/lib/types';

export type DeviceAlerts = { active: InventoryAlert[]; past: InventoryAlert[] };

export function alertsByDevice(alerts: readonly InventoryAlert[]): Map<string, DeviceAlerts> {
  const grouped = new Map<string, DeviceAlerts>();
  for (const alert of alerts) {
    const device = grouped.get(alert.device_id) ?? { active: [], past: [] };
    (alert.end_ts || alert.dismissed ? device.past : device.active).push(alert);
    grouped.set(alert.device_id, device);
  }
  return grouped;
}

export function alertText(alert: InventoryAlert, language: string): string {
  const entries = Object.entries(alert.status);
  const base = language.split('-')[0];
  const match =
    entries.find(([locale]) => locale === language) ??
    entries.find(([locale]) => locale.split('-')[0] === base) ??
    entries.find(([locale]) => locale === 'en-US') ??
    entries[0];
  return match?.[1] ?? '';
}
