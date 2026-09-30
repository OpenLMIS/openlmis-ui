import { BellIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { THEME_PRESETS, type ThemePresetName } from '@/lib/theme-presets';

const CHART_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];
const CHART_BARS = [
  'h-6 bg-chart-1',
  'h-9 bg-chart-2',
  'h-7 bg-chart-3',
  'h-12 bg-chart-4',
  'h-10 bg-chart-5',
  'h-14 bg-chart-1',
  'h-8 bg-chart-2',
  'h-11 bg-chart-3',
  'h-9 bg-chart-4',
  'h-13 bg-chart-5',
];

export function ThemeSwatch({ preset }: { preset: ThemePresetName }) {
  const tokens = THEME_PRESETS[preset].light;
  return (
    <span
      aria-hidden
      className="flex h-12 w-full flex-col overflow-hidden rounded-md border"
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
      <span className="flex-1 bg-primary" />
      <span className="flex h-2.5">
        {CHART_COLORS.map((color) => (
          <span className={`flex-1 ${color}`} key={color} />
        ))}
      </span>
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
          className="flex flex-col gap-4 rounded-xl border bg-background p-4 text-foreground"
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button size="sm" type="button">
                {t('system-settings.save')}
              </Button>
              <Button size="sm" type="button" variant="outline">
                {t('system-settings.cancel')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{t('system-settings.theme.preview-badge')}</Badge>
              <span className="relative">
                <Button size="icon-sm" type="button" variant="secondary">
                  <BellIcon />
                </Button>
                <span className="absolute -top-0.5 -end-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked />
            <Switch checked={false} />
            <div className="flex-1">
              <Progress value={64} />
            </div>
          </div>
          <div className="flex h-14 items-end gap-1.5 border-b pb-px">
            {CHART_BARS.map((bar) => (
              <span className={`flex-1 rounded-t-sm ${bar}`} key={bar} />
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
      <div className="grid gap-4 @xl/main:grid-cols-2">
        <PreviewPanel mode="light" preset={preset} />
        <PreviewPanel mode="dark" preset={preset} />
      </div>
    </section>
  );
}
