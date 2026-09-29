export type Oklch = { l: number; c: number; h: number };

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

export function parseOklch(value: string): Oklch {
  const match = OKLCH.exec(value);
  if (!match) throw new Error(`Not an oklch colour: ${value}`);
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

const round = (value: number) => Math.round(value * 1000) / 1000;

export function toOklch({ l, c, h }: Oklch): string {
  return `oklch(${round(l)} ${round(c)} ${round(h)})`;
}

function toLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
    -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
    -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
  ];
}

export function inSrgbGamut(color: Oklch): boolean {
  return toLinearSrgb(color).every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4);
}

function luminance(color: string): number {
  const [r, g, b] = toLinearSrgb(parseOklch(color)).map((channel) =>
    Math.min(1, Math.max(0, channel)),
  );
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}
