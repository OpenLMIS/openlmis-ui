import type { InventoryAlert } from '@/features/cce-inventory/lib/types';

export function activeAlertsByDevice(
  alerts: readonly InventoryAlert[],
): Map<string, InventoryAlert[]> {
  const grouped = new Map<string, InventoryAlert[]>();
  for (const alert of alerts) {
    const active = grouped.get(alert.device_id) ?? [];
    if (!alert.end_ts && !alert.dismissed) active.push(alert);
    grouped.set(alert.device_id, active);
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
