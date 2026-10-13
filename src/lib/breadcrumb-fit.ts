export function hiddenBreadcrumbCount(
  widths: readonly number[],
  available: number,
  separatorSpace: number,
  ellipsisWidth: number,
): number {
  let total = widths.reduce((sum, width) => sum + width, 0);
  total += Math.max(0, widths.length - 1) * separatorSpace;
  if (total <= available) return 0;
  total += ellipsisWidth + separatorSpace;
  for (let hidden = 1; hidden < widths.length - 1; hidden++) {
    total -= widths[hidden] + separatorSpace;
    if (total <= available) return hidden;
  }
  return Math.max(0, widths.length - 2);
}
