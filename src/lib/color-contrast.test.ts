import { describe, expect, it } from 'vitest';
import { contrastRatio, inSrgbGamut, parseOklch, toOklch } from '@/lib/color-contrast';

describe('parseOklch', () => {
  it('reads lightness, chroma and hue', () => {
    expect(parseOklch('oklch(0.5 0.134 242.749)')).toEqual({ l: 0.5, c: 0.134, h: 242.749 });
  });

  it('refuses anything else', () => {
    expect(() => parseOklch('#ffffff')).toThrow();
  });
});

describe('toOklch', () => {
  it('writes a colour back with three decimals', () => {
    expect(toOklch({ l: 0.5, c: 0.13444, h: 195 })).toBe('oklch(0.5 0.134 195)');
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)')).toBeCloseTo(21, 1);
    expect(contrastRatio('oklch(0.5 0.1 240)', 'oklch(0.5 0.1 240)')).toBeCloseTo(1, 5);
  });

  it('matches the known contrast of mid grey on white', () => {
    expect(contrastRatio('oklch(0.566 0 0)', 'oklch(1 0 0)')).toBeCloseTo(4.54, 1);
  });

  it('does not depend on the order of the two colours', () => {
    expect(contrastRatio('oklch(0.3 0 0)', 'oklch(0.9 0 0)')).toBeCloseTo(
      contrastRatio('oklch(0.9 0 0)', 'oklch(0.3 0 0)'),
      10,
    );
  });
});

describe('inSrgbGamut', () => {
  it('accepts a colour the screen can show and refuses one it cannot', () => {
    expect(inSrgbGamut({ l: 0.5, c: 0.1, h: 240 })).toBe(true);
    expect(inSrgbGamut({ l: 0.9, c: 0.3, h: 150 })).toBe(false);
  });
});
