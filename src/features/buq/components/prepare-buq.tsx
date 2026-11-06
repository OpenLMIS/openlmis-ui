import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CalendarIcon, ClipboardPlusIcon, Loader2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ListError } from '@/components/app-shell/list-error';
import { LoadError } from '@/components/app-shell/load-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { ErrorAlert, serverMessage } from '@/components/display/dialog-parts';
import {
  PickerAdd,
  PickerAddButton,
  PickerAddField,
  PickerAddIcon,
} from '@/components/pickers/picker-add';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { prepareBuq } from '@/features/buq/api/api';
import { buqPeriodsOptions, preparedBuqsOptions } from '@/features/buq/api/queries';
import { PreparedTable, PreparedTableSkeleton } from '@/features/buq/components/prepared-table';
import { BUQ_CODE } from '@/features/buq/lib/access';
import type { PrepareSearch } from '@/features/buq/lib/search';
import type { Buq, BuqPeriod, NamedItem } from '@/features/buq/lib/types';
import { processingSchedulesOptions } from '@/features/reference-data/api/queries';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';
import type { SearchChange } from '@/lib/table-search';

type PrepareBuqProps = { facility: NamedItem; program: NamedItem };

type ListSearchProps = { search: PrepareSearch; onSearchChange: SearchChange<PrepareSearch> };

const NO_PERIODS: BuqPeriod[] = [];
const NO_BUQS: Buq[] = [];
const noop = () => {};

export function PrepareBuq({
  facility,
  program,
  search,
  onSearchChange,
}: PrepareBuqProps & ListSearchProps) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <h2 className="font-semibold text-base">
        {t('buq.prepare.applied', { facility: facility.name, program: program.name })}
      </h2>
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <LoadError
            description={t('error.check-connection')}
            error={error}
            reset={reset}
            title={t('buq.prepare.periods-error')}
          />
        )}
        pendingFallback={<PeriodPicker disabled periods={NO_PERIODS} prepared={NO_BUQS} />}
        resetKey={facility.id}
      >
        <LoadedPeriodPicker facility={facility} program={program} />
      </QueryBoundary>
      <Separator />
      <h3 className="font-medium text-sm">{t('buq.prepare.report-list')}</h3>
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <ListError
            description={t('buq.prepare.list-error')}
            error={error}
            reset={reset}
            title={t('buq.prepare.list-error-title')}
          />
        )}
        pendingFallback={<PreparedTableSkeleton cards={cards} search={search} />}
        resetKey={facility.id}
      >
        <LoadedTable
          cards={cards}
          facility={facility}
          onSearchChange={onSearchChange}
          search={search}
        />
      </QueryBoundary>
    </div>
  );
}

function useBuqPeriods() {
  const { data: schedules } = useSuspenseQuery(processingSchedulesOptions());
  const schedule = schedules.find(({ code }) => code === BUQ_CODE);
  return useSuspenseQuery(buqPeriodsOptions(schedule?.id)).data;
}

function LoadedTable({
  facility,
  cards,
  ...list
}: ListSearchProps & { facility: NamedItem; cards: boolean }) {
  const periods = useBuqPeriods();
  const { data: buqs } = useSuspenseQuery(preparedBuqsOptions(facility.id));
  return (
    <PreparedTable {...list} buqs={buqs} cards={cards} facility={facility} periods={periods} />
  );
}

function LoadedPeriodPicker({ facility, program }: PrepareBuqProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const periods = useBuqPeriods();
  const list = useQuery(preparedBuqsOptions(facility.id));
  const prepare = useSessionMutation({
    mutationFn: prepareBuq,
    onSuccess: async (_, { processingPeriodId }) => {
      const period = periods.find(({ id }) => id === processingPeriodId);
      toast.success(t('buq.prepare.prepared-title'), {
        description: t('buq.prepare.prepared', { period: period?.name ?? '' }),
      });
      await queryClient.invalidateQueries({ queryKey: [...queryKeys.buq.all, 'list'] });
    },
  });
  return (
    <PeriodPicker
      disabled={prepare.isPending || list.isPending}
      error={
        prepare.isError
          ? (serverMessage(prepare.error) ?? t('buq.prepare.prepare-error'))
          : undefined
      }
      onChange={prepare.reset}
      onPrepare={(processingPeriodId, done) =>
        prepare.mutate(
          { facilityId: facility.id, programId: program.id, processingPeriodId },
          { onSuccess: done },
        )
      }
      pending={prepare.isPending}
      periods={periods}
      prepared={list.data ?? NO_BUQS}
    />
  );
}

type PeriodItem = { value: string; label: string; prepared: boolean };

function PeriodPicker({
  periods,
  prepared,
  disabled = false,
  pending = false,
  error,
  onChange = noop,
  onPrepare = noop,
}: {
  periods: readonly BuqPeriod[];
  prepared: readonly Buq[];
  disabled?: boolean;
  pending?: boolean;
  error?: string;
  onChange?: () => void;
  onPrepare?: (periodId: string, done: () => void) => void;
}) {
  const { t } = useTranslation();
  const field = useRef<HTMLDivElement>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const preparedIds = new Set(prepared.map(({ processingPeriodId }) => processingPeriodId));
  const items: PeriodItem[] = periods.map(({ id, name }) => ({
    value: id,
    label: name,
    prepared: preparedIds.has(id),
  }));
  const picked = items.find((item) => item.value === pickedId && !item.prepared) ?? null;
  const afterPrepare = () => {
    setPickedId(null);
    field.current?.querySelector('input')?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 @3xl/main:max-w-xl">
        <PickerAdd>
          <Combobox
            disabled={disabled}
            isItemEqualToValue={(item, value) => item.value === value.value}
            itemToStringLabel={(item) => item.label}
            items={items}
            onValueChange={(item) => {
              setPickedId(item?.value ?? null);
              onChange();
            }}
            value={picked}
          >
            <PickerAddField ref={field}>
              <ComboboxInput
                aria-label={t('buq.prepare.select-period')}
                placeholder={t('buq.prepare.select-period')}
                size="lg"
                width="full"
              >
                <PickerAddIcon>
                  <CalendarIcon />
                </PickerAddIcon>
              </ComboboxInput>
            </PickerAddField>
            <ComboboxContent anchor={field}>
              <ComboboxEmpty>{t('buq.prepare.no-periods')}</ComboboxEmpty>
              <ComboboxList>
                {(item: PeriodItem) => (
                  <ComboboxItem disabled={item.prepared} key={item.value} value={item}>
                    <bdi>{item.label}</bdi>
                    {item.prepared && (
                      <span className="text-muted-foreground">
                        {t('buq.prepare.already-prepared')}
                      </span>
                    )}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <PickerAddButton
            disabled={disabled || picked === null}
            focusableWhenDisabled={pending}
            icon={
              pending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <ClipboardPlusIcon data-icon="inline-start" />
              )
            }
            onClick={() => picked && onPrepare(picked.value, afterPrepare)}
          >
            {t('buq.prepare.prepare')}
          </PickerAddButton>
        </PickerAdd>
      </div>
      {error && <ErrorAlert description={error} title={t('buq.prepare.prepare-error-title')} />}
    </div>
  );
}

export function PrepareBuqSkeleton({ search }: { search: PrepareSearch }) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <div className="flex h-6 items-center">
        <div className="h-4 w-64 max-w-full">
          <Skeleton fill />
        </div>
      </div>
      <PeriodPicker disabled periods={NO_PERIODS} prepared={NO_BUQS} />
      <Separator />
      <h3 className="font-medium text-sm">{t('buq.prepare.report-list')}</h3>
      <PreparedTableSkeleton cards={cards} search={search} />
    </div>
  );
}
