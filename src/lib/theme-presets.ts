import { inSrgbGamut, parseOklch, toOklch } from '@/lib/color-contrast';

export const THEME_TOKENS = [
  'primary',
  'primary-foreground',
  'brand',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
] as const;

type ThemeTokens = Record<(typeof THEME_TOKENS)[number], string>;

type ThemePreset = { light: ThemeTokens; dark: ThemeTokens };

const BLUE_CHARTS = {
  'chart-1': 'oklch(0.76 0.12 240)',
  'chart-2': 'oklch(0.67 0.15 240)',
  'chart-3': 'oklch(0.58 0.158 240)',
  'chart-4': 'oklch(0.49 0.14 240)',
  'chart-5': 'oklch(0.4 0.115 240)',
};

const BLUE: ThemePreset = {
  light: {
    primary: 'oklch(0.5 0.134 242.749)',
    'primary-foreground': 'oklch(0.977 0.013 236.62)',
    brand: 'oklch(0.745 0.123 230.4)',
    'sidebar-primary': 'oklch(0.588 0.158 241.966)',
    'sidebar-primary-foreground': 'oklch(0.977 0.013 236.62)',
    ...BLUE_CHARTS,
  },
  dark: {
    primary: 'oklch(0.443 0.11 240.79)',
    'primary-foreground': 'oklch(0.977 0.013 236.62)',
    brand: 'oklch(0.745 0.123 230.4)',
    'sidebar-primary': 'oklch(0.685 0.169 237.323)',
    'sidebar-primary-foreground': 'oklch(0.293 0.066 243.157)',
    ...BLUE_CHARTS,
  },
};

function shiftHue(value: string, hue: number, chromaScale: number): string {
  const { l, c } = parseOklch(value);
  let chroma = c * chromaScale;
  while (chroma > 0 && !inSrgbGamut({ l, c: chroma, h: hue })) chroma -= 0.002;
  return toOklch({ l, c: Math.max(0, chroma), h: hue });
}

function fromBlue(hue?: number, chromaScale = 1): ThemePreset {
  const derive = (tokens: ThemeTokens) =>
    Object.fromEntries(
      THEME_TOKENS.map((token) => [
        token,
        shiftHue(tokens[token], hue ?? parseOklch(tokens[token]).h, chromaScale),
      ]),
    ) as ThemeTokens;
  return { light: derive(BLUE.light), dark: derive(BLUE.dark) };
}

export const THEME_PRESETS = {
  blue: fromBlue(),
  sapphire: fromBlue(258),
  indigo: fromBlue(275),
  purple: fromBlue(295),
  fuchsia: fromBlue(322, 0.75),
  pink: fromBlue(350, 0.7),
  rose: fromBlue(12, 0.7),
  red: fromBlue(27, 0.8),
  orange: fromBlue(48),
  amber: fromBlue(75),
  olive: fromBlue(125, 0.7),
  green: fromBlue(150),
  emerald: fromBlue(172),
  teal: fromBlue(195),
  cyan: fromBlue(215),
  brown: fromBlue(55, 0.45),
  slate: fromBlue(255, 0.3),
  graphite: fromBlue(255, 0),
} satisfies Record<string, ThemePreset>;

export type ThemePresetName = keyof typeof THEME_PRESETS;

export const DEFAULT_THEME_PRESET: ThemePresetName = 'blue';

function isThemePresetName(name: string | null): name is ThemePresetName {
  return name !== null && Object.hasOwn(THEME_PRESETS, name);
}

export function presetName(name: string | null): ThemePresetName {
  return isThemePresetName(name) ? name : DEFAULT_THEME_PRESET;
}

function declarations(tokens: ThemeTokens): string {
  return THEME_TOKENS.map((token) => `--${token}:${tokens[token]};`).join('');
}

export function themePresetCss(preset: ThemePreset): string {
  return `:root{${declarations(preset.light)}}.dark{${declarations(preset.dark)}}`;
}

export function applyThemePreset(name: string | null): void {
  let style = document.getElementById('app-theme');
  if (!style) {
    style = document.createElement('style');
    style.id = 'app-theme';
    document.head.append(style);
  }
  style.textContent = themePresetCss(THEME_PRESETS[presetName(name)]);
}
