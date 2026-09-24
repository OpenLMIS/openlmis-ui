import { Link } from '@tanstack/react-router';
import { HouseIcon, LockIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Workspace, WorkspaceContent } from '@/components/workspace';

/** Where a page's content would be, for a user whose roles do not reach it; `h1` when it is the whole page. */
export function NoAccess({ heading: Heading = 'h2' }: { heading?: 'h1' | 'h2' }) {
  const { t } = useTranslation();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>
          <Heading>{t('no-access.title')}</Heading>
        </EmptyTitle>
        <EmptyDescription>{t('no-access.description')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/home" />} variant="outline">
          <HouseIcon data-icon="inline-start" />
          {t('not-found.back-home')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/** A whole page the signed-in user's roles do not reach, in place of the page. */
export function NoAccessPage() {
  return (
    <Workspace>
      <WorkspaceContent>
        <NoAccess heading="h1" />
      </WorkspaceContent>
    </Workspace>
  );
}
