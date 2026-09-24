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

/** A page the signed-in user's roles do not reach, in place of the page. */
export function NoAccessPage() {
  const { t } = useTranslation();

  return (
    <Workspace>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LockIcon />
            </EmptyMedia>
            <EmptyTitle>{t('no-access.title')}</EmptyTitle>
            <EmptyDescription>{t('no-access.description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link to="/home" />} variant="outline">
              <HouseIcon data-icon="inline-start" />
              {t('not-found.back-home')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
