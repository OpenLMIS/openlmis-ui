import type { SystemNotification } from '@/features/system-notifications/lib/types';

export function isDisplayed(
  {
    active,
    startDate,
    expiryDate,
  }: Pick<SystemNotification, 'active' | 'startDate' | 'expiryDate'>,
  now: number,
) {
  return (
    active &&
    (!startDate || Date.parse(startDate) <= now) &&
    (!expiryDate || Date.parse(expiryDate) >= now)
  );
}
