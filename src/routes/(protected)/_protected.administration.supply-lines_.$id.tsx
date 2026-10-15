import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
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
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { supplyLineOptions } from '@/features/supply-lines/api/queries';
import { SupplyLineView } from '@/features/supply-lines/components/supply-line-view';
import { supplyLinesSearchSchema } from '@/features/supply-lines/lib/search';
import { isNotFound } from '@/lib/http';

class SupplyLineNotFound extends Error {}

export const Route = createFileRoute('/(protected)/_protected/administration/supply-lines_/$id')({
  validateSearch: supplyLinesSearchSchema,
  staticData: {
    crumbKey: 'supply-lines.view.title',
    crumbParentSearch: (search) => supplyLinesSearchSchema.parse(search),
  },
  loader: async ({ context: { queryClient }, params }) => {
    await requireRight(queryClient, RIGHTS.supplyLinesManage);
    if (!z.guid().safeParse(params.id).success) throw new SupplyLineNotFound();
    return queryClient.ensureQueryData(supplyLineOptions(params.id));
  },
  pendingComponent: SupplyLinePending,
  errorComponent: SupplyLineError,
  component: SupplyLinePage,
});

function useListSearch() {
  const router = useRouter();
  const [listSearch] = useState(() =>
    supplyLinesSearchSchema.parse(
      router.latestLocation.state.supplyLinesListSearch ?? router.latestLocation.search,
    ),
  );
  return listSearch;
}

function SupplyLinePage() {
  const { id } = Route.useParams();
  const { data: line } = useSuspenseQuery(supplyLineOptions(id));
  const listSearch = useListSearch();
  return <SupplyLineView line={line} listSearch={listSearch} />;
}

function SupplyLinePending() {
  return <SupplyLineView listSearch={useListSearch()} />;
}

function SupplyLineError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const listSearch = useListSearch();
  const back = (
    <Button
      nativeButton={false}
      render={<Link to="/administration/supply-lines" search={listSearch} />}
      size="lg"
      variant="outline"
    >
      {t('supply-lines.view.back')}
    </Button>
  );
  if (!(props.error instanceof SupplyLineNotFound) && !isNotFound(props.error)) {
    return (
      <ErrorFallback
        {...props}
        back={back}
        title={t('supply-lines.view.error-title')}
        description={t('supply-lines.view.error-description')}
      />
    );
  }
  return (
    <Workspace width="narrow">
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>
              <h1>{t('supply-lines.view.not-found-title')}</h1>
            </EmptyTitle>
            <EmptyDescription>{t('supply-lines.view.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back}</EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
