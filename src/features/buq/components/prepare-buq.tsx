import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CalendarIcon, ClipboardPlusIcon, Loader2Icon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
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
import { prepareBuq } from '@/features/buq/api/api';
import {
  buqPeriodsOptions,
  openBuqsOptions,
  takenPeriodsOptions,
} from '@/features/buq/api/queries';
import { BuqHeading, BuqHeadingSkeleton } from '@/features/buq/components/buq-heading';
import { PreparedTable, PreparedTableSkeleton } from '@/features/buq/components/prepared-table';
import { useBuqPeriods } from '@/features/buq/components/use-buq-periods';
import { BUQ_CODE } from '@/features/buq/lib/access';
import type { BuqListProps, BuqListSearch } from '@/features/buq/lib/search';
import type { BuqPeriod, NamedItem, TakenPeriod } from '@/features/buq/lib/types';
import { processingSchedulesOptions } from '@/features/reference-data/api/queries';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

type PrepareBuqProps = { facility: NamedItem; program: NamedItem };

const NO_PERIODS: BuqPeriod[] = [];
const NO_TAKEN: TakenPeriod[] = [];
const noop = () => {};

export function PrepareBuq({
  facility,
  program,
  search,
  onSearchChange,
}: PrepareBuqProps & BuqListProps) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <BuqHeading facility={facility} program={program} />
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <LoadError
            description={t('error.check-connection')}
            error={error}
            reset={reset}
            title={t('buq.prepare.periods-error')}
          />
        )}
        pendingFallback={<PeriodPicker disabled periods={NO_PERIODS} taken={NO_TAKEN} />}
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
            title={t('buq.list-error-title')}
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

function usePeriodNames() {
  const schedules = useQuery(processingSchedulesOptions());
  const schedule = schedules.data?.find(({ code }) => code === BUQ_CODE);
  const periods = useQuery({ ...buqPeriodsOptions(schedule?.id), enabled: schedules.isSuccess });
  const settled = schedules.isError || periods.isError || periods.isSuccess;
  return settled ? (periods.data ?? NO_PERIODS) : undefined;
}

function LoadedTable({
  facility,
  cards,
  ...list
}: BuqListProps & { facility: NamedItem; cards: boolean }) {
  const periods = usePeriodNames();
  const { data: buqs } = useSuspenseQuery(openBuqsOptions(facility.id));
  if (!periods) return <PreparedTableSkeleton cards={cards} search={list.search} />;
  return (
    <PreparedTable {...list} buqs={buqs} cards={cards} facility={facility} periods={periods} />
  );
}

function LoadedPeriodPicker({ facility, program }: PrepareBuqProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const periods = useBuqPeriods();
  const taken = useQuery(takenPeriodsOptions(facility.id));
  const prepare = useSessionMutation({
    mutationFn: prepareBuq,
    onSuccess: (buq, { processingPeriodId }) => {
      const period = periods.find(({ id }) => id === processingPeriodId)?.name ?? '';
      toast.success(t('buq.prepare.prepared-title'), {
        description: buq.bottomUpQuantificationLineItems?.length
          ? t('buq.prepare.prepared', { period })
          : t('buq.prepare.prepared-empty', { period }),
      });
      queryClient.setQueryData(openBuqsOptions(facility.id).queryKey, (buqs) =>
        buqs ? [...buqs, buq] : buqs,
      );
      queryClient.setQueryData(takenPeriodsOptions(facility.id).queryKey, (rows) =>
        rows ? [...rows, buq] : rows,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...queryKeys.buq.all, 'list'] }),
  });
  return (
    <PeriodPicker
      disabled={prepare.isPending || !taken.isSuccess}
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
      taken={taken.data ?? NO_TAKEN}
    />
  );
}

type PeriodItem = { value: string; label: string; prepared: boolean };

function PeriodPicker({
  periods,
  taken,
  disabled = false,
  pending = false,
  error,
  onChange = noop,
  onPrepare = noop,
}: {
  periods: readonly BuqPeriod[];
  taken: readonly TakenPeriod[];
  disabled?: boolean;
  pending?: boolean;
  error?: string;
  onChange?: () => void;
  onPrepare?: (periodId: string, done: () => void) => void;
}) {
  const { t } = useTranslation();
  const field = useRef<HTMLDivElement>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const items = useMemo<PeriodItem[]>(() => {
    const preparedIds = new Set(taken.map(({ processingPeriodId }) => processingPeriodId));
    return periods.map(({ id, name }) => ({
      value: id,
      label: name,
      prepared: preparedIds.has(id),
    }));
  }, [periods, taken]);
  const picked = useMemo(
    () => items.find((item) => item.value === pickedId && !item.prepared) ?? null,
    [items, pickedId],
  );
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
                dir="auto"
                disabled={disabled}
                placeholder={t('buq.prepare.period-placeholder')}
                size="lg"
                width="full"
              >
                <PickerAddIcon>
                  <CalendarIcon />
                </PickerAddIcon>
              </ComboboxInput>
            </PickerAddField>
            <ComboboxContent anchor={field}>
              <ComboboxEmpty>
                {periods.length
                  ? t('buq.prepare.no-matching-periods')
                  : t('buq.prepare.no-periods')}
              </ComboboxEmpty>
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

export function PrepareBuqSkeleton({ search }: { search: BuqListSearch }) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <BuqHeadingSkeleton />
      <PeriodPicker disabled periods={NO_PERIODS} taken={NO_TAKEN} />
      <Separator />
      <h3 className="font-medium text-sm">{t('buq.prepare.report-list')}</h3>
      <PreparedTableSkeleton cards={cards} search={search} />
    </div>
  );
}
