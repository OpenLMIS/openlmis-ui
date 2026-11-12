import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableEmpty, DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { supervisedZonesOptions } from '@/features/buq/api/queries';
import {
  NationalSearchForm,
  NationalSearchSkeleton,
} from '@/features/buq/components/national-search';
import {
  NATIONAL_HIDEABLE_COLUMNS,
  NationalResults,
  NationalResultsSkeleton,
} from '@/features/buq/components/national-table';
import { useBuqPeriods } from '@/features/buq/components/use-buq-periods';
import { groupOptions } from '@/features/buq/lib/national';
import type { NationalSearch } from '@/features/buq/lib/search';
import { geographicZonesOptions } from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { queryKeys } from '@/lib/key-factory';
import type { SearchChange } from '@/lib/table-search';

const VISIBILITY_KEY = 'buq.national.column-visibility';

type NationalApprovalProps = {
  programId: string;
  selectionSlot: HTMLElement | null;
  search: NationalSearch;
  onSearchChange: SearchChange<NationalSearch>;
};

function useNationalView() {
  return useCardView(NATIONAL_HIDEABLE_COLUMNS, VISIBILITY_KEY);
}

function NationalViewMenu({
  view,
  disabled = false,
}: {
  view: ReturnType<typeof useNationalView>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <DataTableToolbar align="end">
      <div className="flex-1 @2xl/main:flex-none">
        <DataTableViewOptions
          columns={NATIONAL_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          disabled={disabled}
          layout={view.layout}
          onReset={view.columnView.onReset}
          onVisibilityChange={view.columnView.onVisibilityChange}
          size="lg"
          visibility={view.columnView.visibility}
        />
      </div>
    </DataTableToolbar>
  );
}

function Notice({ title, description }: { title: string; description: string }) {
  return <DataTableEmpty description={description} icon={<SearchIcon />} title={title} />;
}

function NationalContent({
  programId,
  search,
  onSearchChange,
  selectionSlot,
}: NationalApprovalProps) {
  const { t } = useTranslation();
  const view = useNationalView();
  const queryClient = useQueryClient();
  const { data: tree } = useSuspenseQuery(supervisedZonesOptions(programId));
  const { data: zones } = useSuspenseQuery(geographicZonesOptions());
  const periods = useBuqPeriods();
  const groups = useMemo(() => groupOptions(tree, zones), [tree, zones]);
  const zone = groups.some(({ value }) => value === search.zone) ? search.zone : undefined;
  const period = periods.some(({ id }) => id === search.period) ? search.period : undefined;
  const start = useMemo(
    () => ({
      zone: zone ?? (search.zone ? null : (groups[0]?.value ?? null)),
      period: period ?? (search.period ? '' : (periods.at(-1)?.id ?? '')),
    }),
    [zone, period, search.zone, search.period, groups, periods],
  );
  const [draft, setDraft] = useState(start);
  const [draftFor, setDraftFor] = useState(start);
  if (draftFor !== start) {
    setDraftFor(start);
    setDraft(start);
  }
  if (!groups.length) {
    return (
      <Notice
        description={t('buq.national.no-groups-description')}
        title={t('buq.national.no-groups')}
      />
    );
  }
  const applied = zone && period ? { zone, period } : undefined;
  const matches = !!applied && draft.zone === applied.zone && draft.period === applied.period;
  return (
    <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={view.measure}>
      <NationalSearchForm
        groups={groups}
        onDraftChange={setDraft}
        onSearch={(next) => {
          if (next.zone === applied?.zone && next.period === applied.period) {
            void queryClient.invalidateQueries({ queryKey: [...queryKeys.buq.all, 'list'] });
          }
          onSearchChange({ ...next, page: undefined });
        }}
        periods={periods}
        start={start}
      />
      {applied && matches ? (
        <div className="flex flex-col gap-4">
          <NationalViewMenu view={view} />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('buq.national.list-error')}
                error={error}
                reset={reset}
                title={t('buq.list-error-title')}
              />
            )}
            pendingFallback={
              <NationalResultsSkeleton
                cards={view.cards}
                search={search}
                visibility={view.columnView.visibility}
              />
            }
            resetKey={`${applied.zone}-${applied.period}`}
          >
            <NationalResults
              selectionSlot={selectionSlot}
              cards={view.cards}
              onSearchChange={onSearchChange}
              query={{ programId, periodId: applied.period, zoneId: applied.zone }}
              search={search}
              visibility={view.columnView.visibility}
            />
          </QueryBoundary>
        </div>
      ) : (
        <Notice
          description={t('buq.national.choose-description')}
          title={t('buq.national.choose')}
        />
      )}
    </div>
  );
}

export function NationalApproval(props: NationalApprovalProps) {
  const { t } = useTranslation();
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <ListError
          description={t('buq.national.groups-error')}
          error={error}
          reset={reset}
          title={t('buq.national.groups-error-title')}
        />
      )}
      pendingFallback={<NationalApprovalSkeleton search={props.search} />}
      resetKey={props.programId}
    >
      <NationalContent {...props} />
    </QueryBoundary>
  );
}

export function NationalApprovalSkeleton({ search }: { search: NationalSearch }) {
  const view = useNationalView();
  return (
    <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6" ref={view.measure}>
      <NationalSearchSkeleton />
      {search.zone && search.period && (
        <div className="flex flex-col gap-4">
          <NationalViewMenu disabled view={view} />
          <NationalResultsSkeleton
            cards={view.cards}
            search={search}
            visibility={view.columnView.visibility}
          />
        </div>
      )}
    </div>
  );
}
