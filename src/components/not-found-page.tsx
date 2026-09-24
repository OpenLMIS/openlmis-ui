import { Link, useLocation, useRouter } from '@tanstack/react-router';
import { ArrowLeftIcon, FileQuestionIcon, HouseIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useLoginData } from '@/features/auth/store/login-data';

/** A signed-in user keeps the sidebar, so the way on is one click away; anyone else sees it alone. */
export function NotFoundPage() {
  const signedIn = useLoginData((state) => Boolean(state.accessToken));

  if (!signedIn) {
    return (
      <Empty height="screen">
        <NotFoundContent />
      </Empty>
    );
  }
  return (
    <AppShell>
      <Empty>
        <NotFoundContent />
      </Empty>
    </AppShell>
  );
}

function NotFoundContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { pathname } = useLocation();
  // The browser's history, so a typed or bookmarked address can go back too; a new tab cannot.
  const canGoBack = window.history.length > 1;

  return (
    <>
      <EmptyHeader>
        <EmptyMedia size="lg" variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-label">
          {t('not-found.eyebrow')}
        </p>
        <EmptyTitle size="lg">{t('not-found.title')}</EmptyTitle>
        <EmptyDescription size="lg">{t('not-found.description')}</EmptyDescription>
        <code className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
          {pathname}
        </code>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          {canGoBack && (
            <Button onClick={() => router.history.back()} size="lg" variant="outline">
              <ArrowLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
              {t('not-found.go-back')}
            </Button>
          )}
          <Button nativeButton={false} render={<Link to="/home" />} size="lg">
            <HouseIcon data-icon="inline-start" />
            {t('not-found.back-home')}
          </Button>
        </div>
      </EmptyContent>
    </>
  );
}
