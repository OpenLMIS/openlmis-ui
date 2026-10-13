import { describe, expect, it } from 'vitest';
import { hiddenBreadcrumbCount } from '@/lib/breadcrumb-fit';

describe('hiddenBreadcrumbCount', () => {
  it('hides middle crumbs from Home outward and keeps both endpoints even when truncation is needed', () => {
    const widths = [40, 130, 70, 90];
    expect(hiddenBreadcrumbCount(widths, 408, 26, 20)).toBe(0);
    expect(hiddenBreadcrumbCount(widths, 298, 26, 20)).toBe(1);
    expect(hiddenBreadcrumbCount(widths, 200, 26, 20)).toBe(2);
    expect(hiddenBreadcrumbCount(widths, 100, 26, 20)).toBe(2);
    expect(hiddenBreadcrumbCount([40, 10, 100, 90], 310, 26, 20)).toBe(2);
    expect(hiddenBreadcrumbCount([40, 300], 100, 26, 20)).toBe(0);
  });
});
