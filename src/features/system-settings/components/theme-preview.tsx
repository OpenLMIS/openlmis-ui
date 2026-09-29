import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { THEME_PRESETS, type ThemePresetName } from '@/lib/theme-presets';

const CHART_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];
const CHART_HEIGHTS = ['h-4', 'h-6', 'h-9', 'h-7', 'h-10'];

export function ThemeSwatch({ preset }: { preset: ThemePresetName }) {
  const tokens = THEME_PRESETS[preset].light;
  return (
    <span
      aria-hidden
      className="flex shrink-0 overflow-hidden rounded-md border"
      style={
        {
          '--primary': tokens.primary,
          '--chart-1': tokens['chart-1'],
          '--chart-2': tokens['chart-2'],
          '--chart-3': tokens['chart-3'],
          '--chart-4': tokens['chart-4'],
          '--chart-5': tokens['chart-5'],
        } as CSSProperties
      }
    >
      <span className="size-6 bg-primary" />
      {CHART_COLORS.map((color) => (
        <span className={`h-6 w-2 ${color}`} key={color} />
      ))}
    </span>
  );
}

function PreviewPanel({ preset, mode }: { preset: ThemePresetName; mode: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const tokens = THEME_PRESETS[preset][mode];
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-muted-foreground text-xs">
        {t(
          mode === 'light'
            ? 'system-settings.theme.preview-light'
            : 'system-settings.theme.preview-dark',
        )}
      </figcaption>
      <div aria-hidden className={mode} inert>
        <div
          className="flex flex-col gap-3 rounded-xl border bg-background p-4 text-foreground"
          style={
            {
              '--primary': tokens.primary,
              '--primary-foreground': tokens['primary-foreground'],
              '--chart-1': tokens['chart-1'],
              '--chart-2': tokens['chart-2'],
              '--chart-3': tokens['chart-3'],
              '--chart-4': tokens['chart-4'],
              '--chart-5': tokens['chart-5'],
            } as CSSProperties
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" type="button">
              {t('system-settings.save')}
            </Button>
            <Button size="sm" type="button" variant="outline">
              {t('system-settings.cancel')}
            </Button>
            <Badge>{t('system-settings.theme.preview-badge')}</Badge>
          </div>
          <div className="flex h-10 items-end gap-1.5">
            {CHART_COLORS.map((color, step) => (
              <span className={`w-5 rounded-t-sm ${CHART_HEIGHTS[step]} ${color}`} key={color} />
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

export function ThemePreview({ preset }: { preset: ThemePresetName }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="theme-preview-title" className="flex flex-col gap-3">
      <h2 className="font-medium text-sm" id="theme-preview-title">
        {t('system-settings.theme.preview-title')}
      </h2>
      <div className="grid gap-3 @xl/main:grid-cols-2">
        <PreviewPanel mode="light" preset={preset} />
        <PreviewPanel mode="dark" preset={preset} />
      </div>
    </section>
  );
}
