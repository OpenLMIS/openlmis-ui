import { SparklesIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function LatestChange() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="group/latest-change relative border bg-muted p-3 dark:bg-background">
      <span className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/latest-change:opacity-100">
        <Button
          aria-label={t('latest-change.dismiss')}
          className="size-5"
          onClick={() => setIsOpen(false)}
          size="icon-xs"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </span>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center bg-primary/10">
          <SparklesIcon className="size-3.5 text-primary" />
        </div>
        <div className="flex flex-col gap-0.5 pr-4">
          <p className="font-medium text-xs">{t('latest-change.title')}</p>
          <p className="text-2xs text-muted-foreground leading-relaxed">
            {t('latest-change.description')}
          </p>
        </div>
      </div>
      {/* TODO: Point to the real changelog route/URL when available. */}
      <Button
        className="mt-3 w-full"
        size="sm"
        render={<a href="#changelog">{t('latest-change.read-more')}</a>}
        nativeButton={false}
      />
    </div>
  );
}
