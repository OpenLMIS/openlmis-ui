import type { ErrorComponentProps } from '@tanstack/react-router';
import { Link, useLocation } from '@tanstack/react-router';
import { ArrowLeftIcon, FilePenLineIcon, SearchXIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { LoadError } from '@/components/app-shell/load-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';

export function ForecastHeader({ description }: { description: string }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <FilePenLineIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('buq.forecast.title')}</WorkspaceTitle>
        <WorkspaceDescription>{description}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

type ForecastList = '/buq/create' | '/buq/approve';

export function useListSearch() {
  const current = useLocation({ select: (location) => location.state.buqListSearch });
  const [listSearch] = useState(current);
  return listSearch ?? {};
}

function BackToList({ list }: { list: ForecastList }) {
  const { t } = useTranslation();
  const listSearch = useListSearch();
  return (
    <Button
      nativeButton={false}
      render={<Link search={listSearch} to={list} />}
      size="lg"
      variant="outline"
    >
      <ArrowLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
      {t('buq.forecast.back')}
    </Button>
  );
}

export function ForecastPending({ header }: { header: ReactNode }) {
  return (
    <Workspace width="wide">
      {header}
      <WorkspaceContent>
        <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6">
          <div className="h-6 w-24">
            <Skeleton fill />
          </div>
          <div className="grid gap-4 @3xl/main:grid-cols-2">
            <div className="h-28">
              <Skeleton fill />
            </div>
            <div className="h-28">
              <Skeleton fill />
            </div>
          </div>
          <div className="h-96">
            <Skeleton fill />
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

export function ForecastBoundary({
  id,
  header,
  children,
}: {
  id: string;
  header: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <Workspace width="wide">
          {header}
          <WorkspaceContent>
            <LoadError
              description={t('buq.forecast.load-error')}
              error={error}
              reset={reset}
              title={t('buq.forecast.load-error-title')}
            />
          </WorkspaceContent>
        </Workspace>
      )}
      pendingFallback={<ForecastPending header={header} />}
      resetKey={id}
    >
      {children}
    </QueryBoundary>
  );
}

export function ForecastNotFound({
  list,
  header,
  description,
}: {
  list: ForecastList;
  header: ReactNode;
  description: string;
}) {
  const { t } = useTranslation();
  return (
    <Workspace>
      {header}
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('buq.forecast.not-found-title')}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <BackToList list={list} />
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}

export function ForecastError({ list, ...props }: ErrorComponentProps & { list: ForecastList }) {
  const { t } = useTranslation();
  return (
    <ErrorFallback
      {...props}
      back={<BackToList list={list} />}
      description={t('buq.forecast.load-error')}
      title={t('buq.forecast.load-error-title')}
    />
  );
}
