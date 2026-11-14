export type FacilityCceStatus =
  | 'unknown'
  | 'no-cce'
  | 'all-functioning'
  | 'not-fully-functioning'
  | 'not-functioning';

export function facilityCceStatus(
  items?: readonly { functionalStatus: string | null }[],
): FacilityCceStatus {
  if (!items) return 'unknown';
  if (!items.length) return 'no-cce';
  if (
    items.some(
      (item) =>
        !['FUNCTIONING', 'NEEDS_ATTENTION', 'AWAITING_REPAIR', 'UNSERVICEABLE'].includes(
          item.functionalStatus ?? '',
        ),
    )
  )
    return 'unknown';
  const functioning = items.filter((item) => item.functionalStatus === 'FUNCTIONING').length;
  return functioning === items.length
    ? 'all-functioning'
    : functioning
      ? 'not-fully-functioning'
      : 'not-functioning';
}
