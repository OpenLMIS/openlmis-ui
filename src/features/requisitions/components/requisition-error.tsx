import { type ErrorComponentProps, Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ChevronLeftIcon, SearchXIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/error-fallback';
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
import { requisitionSearchSchema } from '@/features/requisitions/lib/search-facilities';
import { isNotFound } from '@/lib/http';

export function RequisitionError({
  search,
  width,
  ...props
}: ErrorComponentProps & { search: unknown; width?: ComponentProps<typeof Workspace>['width'] }) {
  const { t } = useTranslation();
  const notFound =
    isNotFound(props.error) || (isAxiosError(props.error) && props.error.response?.status === 400);
  const back = (
    <Button
      nativeButton={false}
      render={<Link search={requisitionSearchSchema.parse(search)} to="/requisitions/view" />}
      size={notFound ? 'sm' : 'lg'}
      variant={notFound ? 'outline' : 'default'}
    >
      <ChevronLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
      {t('requisitions.requisition.back')}
    </Button>
  );
  if (!notFound) {
    return (
      <ErrorFallback
        {...props}
        back={back}
        description={t('requisitions.requisition.error-description')}
        title={t('requisitions.requisition.error-title')}
      />
    );
  }
  return (
    <Workspace width={width}>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>
              <h1>{t('requisitions.requisition.not-found-title')}</h1>
            </EmptyTitle>
            <EmptyDescription>
              {t('requisitions.requisition.not-found-description')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back} </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
