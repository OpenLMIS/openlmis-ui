import { describe, expect, it } from 'vitest';
import { toJoyridePlacement } from '@/features/onboarding/lib/placement';

describe('toJoyridePlacement', () => {
  it('maps inline sides to the physical side that matches the reading direction', () => {
    expect(toJoyridePlacement('inline-start', 'ltr')).toBe('left');
    expect(toJoyridePlacement('inline-end', 'ltr')).toBe('right');
    expect(toJoyridePlacement('inline-start', 'rtl')).toBe('right');
    expect(toJoyridePlacement('inline-end', 'rtl')).toBe('left');
  });

  it('keeps block sides and centre in both directions', () => {
    expect(toJoyridePlacement('top', 'rtl')).toBe('top');
    expect(toJoyridePlacement('bottom', 'rtl')).toBe('bottom');
    expect(toJoyridePlacement('center', 'rtl')).toBe('center');
  });
});
