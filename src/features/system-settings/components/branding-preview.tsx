import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/logo';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type BrandingPreviewProps = {
  appName: string;
  logoUrl: string;
};

export function BrandingPreview({ appName, logoUrl }: BrandingPreviewProps) {
  const { t } = useTranslation();
  const name = appName.trim() || t('system-settings.branding.preview-empty-name');

  return (
    <section aria-labelledby="branding-preview-title" className="flex flex-col gap-3">
      <h2 className="font-medium text-sm" id="branding-preview-title">
        {t('system-settings.branding.preview-title')}
      </h2>
      <div className="grid gap-3 @xl/main:grid-cols-2">
        <figure className="flex flex-col gap-2">
          <figcaption className="text-muted-foreground text-xs">
            {t('system-settings.branding.preview-sidebar')}
          </figcaption>
          <div className="flex h-12 items-center gap-2 overflow-hidden rounded-xl border bg-sidebar px-3 text-sidebar-foreground">
            <Logo alt={name} src={logoUrl} />
            <span className="truncate font-semibold text-sm">{name}</span>
          </div>
        </figure>
        <figure className="flex flex-col gap-2">
          <figcaption className="text-muted-foreground text-xs">
            {t('system-settings.branding.preview-sign-in')}
          </figcaption>
          <div className="flex items-center justify-center rounded-xl border bg-muted p-4 dark:bg-background">
            <div className="w-full max-w-60">
              <Card size="sm">
                <CardHeader align="center">
                  <Logo alt={name} className="mx-auto h-8" src={logoUrl} />
                  <CardTitle>{t('login.heading')}</CardTitle>
                  <CardDescription>{t('login.subtitle', { appName: name })}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
