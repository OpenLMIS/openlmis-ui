import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/logo';
import { appConfig } from '@/lib/config';

type BrandingPreviewProps = {
  appName: string;
  logoUrl: string;
  showAppName: boolean;
};

function PreviewItem({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-muted-foreground text-xs">{caption}</figcaption>
      <div
        aria-hidden
        className="flex h-32 items-center justify-center rounded-xl border bg-muted/40 p-4 dark:bg-background"
      >
        {children}
      </div>
    </figure>
  );
}

export function BrandingPreview({ appName, logoUrl, showAppName }: BrandingPreviewProps) {
  const { t } = useTranslation();
  const name = appName.trim() || appConfig.BRAND;

  return (
    <section aria-labelledby="branding-preview-title" className="flex flex-col gap-3">
      <h2 className="font-medium text-sm" id="branding-preview-title">
        {t('system-settings.branding.preview-title')}
      </h2>
      <div className="grid gap-3 @xl/main:grid-cols-3">
        <PreviewItem caption={t('system-settings.branding.preview-tab')}>
          <div className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm shadow-xs">
            <img alt="" className="size-4 shrink-0 object-contain" src={logoUrl} />
            <span className="truncate" dir="auto">
              {name}
            </span>
          </div>
        </PreviewItem>
        <PreviewItem caption={t('system-settings.branding.preview-sidebar')}>
          <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border bg-sidebar px-3 py-2 text-sidebar-foreground shadow-xs">
            <Logo alt="" className={showAppName ? undefined : 'h-7 max-w-full'} src={logoUrl} />
            {showAppName && (
              <span className="truncate font-semibold text-sm" dir="auto">
                {name}
              </span>
            )}
          </div>
        </PreviewItem>
        <PreviewItem caption={t('system-settings.branding.preview-sign-in')}>
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <Logo alt="" className="h-7" src={logoUrl} />
            <p className="font-semibold text-sm">{t('login.heading')}</p>
            <p className="line-clamp-2 text-muted-foreground text-xs">
              {t('login.subtitle', { appName: name })}
            </p>
          </div>
        </PreviewItem>
      </div>
    </section>
  );
}
