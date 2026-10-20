import type { ReactNode } from 'react';

/** Bordered rows of settings: fields with `layout="row"` and `SettingsItem`s. */
export function SettingsList({
  children,
  density = 'default',
}: {
  children: ReactNode;
  density?: 'default' | 'compact';
}) {
  return (
    <div
      data-slot="settings-list"
      className={
        density === 'compact'
          ? 'divide-y rounded-xl border bg-card *:px-3 *:py-1 *:*:min-h-6 *:*:*:min-h-6'
          : 'divide-y rounded-xl border bg-card *:px-4 *:py-3'
      }
    >
      {children}
    </div>
  );
}

type SettingsRowFrameProps = {
  label: ReactNode;
  /** Beside the label, such as a status badge. */
  badge?: ReactNode;
  /** Under the label. */
  description?: ReactNode;
  /** `control` gives an input half the row; `fit` lets a switch or a value take its own width. */
  value?: 'control' | 'wide' | 'fit';
  align?: 'start' | 'center';
  children: ReactNode;
};

/** The label at the start of a row and its value at the end. */
export function SettingsRowFrame({
  label,
  badge,
  description,
  value = 'fit',
  align = 'start',
  children,
}: SettingsRowFrameProps) {
  return (
    <div
      className={
        align === 'center'
          ? 'flex items-center justify-between gap-4'
          : 'flex items-start justify-between gap-4'
      }
    >
      <div
        className={
          value === 'wide'
            ? 'flex min-h-8 shrink-0 flex-col justify-center gap-0.5'
            : 'flex min-h-8 min-w-0 flex-1 flex-col justify-center gap-0.5'
        }
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {label}
          {badge}
        </div>
        {description}
      </div>
      <div
        className={
          value === 'control'
            ? 'flex w-1/2 max-w-sm shrink-0 flex-col gap-1'
            : value === 'wide'
              ? 'flex min-w-0 max-w-sm flex-1 flex-col gap-1'
              : 'flex min-h-8 min-w-0 max-w-1/2 items-center justify-end'
        }
      >
        {children}
      </div>
    </div>
  );
}

/** A row that only shows its value, such as one only an administrator can change. */
export function SettingsItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <SettingsRowFrame label={<span className="text-sm">{label}</span>}>
      <span className="min-w-0 wrap-break-word text-end font-medium text-sm">{children}</span>
    </SettingsRowFrame>
  );
}
