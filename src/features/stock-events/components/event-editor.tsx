import { useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Loader2Icon, ShieldAlertIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataTableEmpty, DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { formatDateValue, toDateValue } from '@/components/form/date-value';
import { LoadError } from '@/components/load-error';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { QueryBoundary } from '@/components/query-boundary';
import { ScanStatus } from '@/components/scan-status';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Workspace, WorkspaceContent, WorkspaceFooter } from '@/components/workspace';
import {
  tradeItemByGtinOptions,
  validDestinationsOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import type { TradeItem } from '@/features/reference-data/lib/types';
import { submitStockEvent } from '@/features/stock-events/api/api';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import { ClearLinesDialog } from '@/features/stock-events/components/clear-lines-dialog';
import {
  EventLineTable,
  eventHideableColumns,
} from '@/features/stock-events/components/event-line-table';
import {
  ProductLotPicker,
  ProductLotPickerSkeleton,
} from '@/features/stock-events/components/product-lot-picker';
import { SignatureDialog } from '@/features/stock-events/components/signature-dialog';
import { useEventForm } from '@/features/stock-events/hooks/use-event-form';
import { applyScanCount } from '@/features/stock-events/lib/apply-scan';
import {
  eventLinesSchema,
  eventPayload,
  eventReasonRequired,
  newEventLine,
} from '@/features/stock-events/lib/event-form';
import { type ConfiguredEventKind, EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { filterEventLines, pageOf } from '@/features/stock-events/lib/line-filter';
import { eventProductOptions } from '@/features/stock-events/lib/products';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import { useBarcodeScan } from '@/hooks/use-barcode-scan';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { useStoredState } from '@/hooks/use-stored-state';
import { useFlag } from '@/lib/feature-flags';
import type { Gs1Result } from '@/lib/gs1/parse-gs1';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import {
  acknowledgeScanExpiry,
  isScanExpiryAcknowledged,
} from '@/lib/scan-expiry-acknowledgements';
import { type ScanMessage, scanMessage } from '@/lib/scan-messages';
import { resolveScan } from '@/lib/stock-scan';
import type { SearchChange } from '@/lib/table-search';

export type EventSearch = {
  page?: number | undefined;
  size?: number | undefined;
  keyword?: string | undefined;
};
type Props = {
  kind: ConfiguredEventKind;
  defaultReasonId?: string;
  children: ReactNode;
  facilityId: string;
  facilityTypeId: string;
  programId: string;
  username: string;
  canViewStock: boolean;
  search: EventSearch;
  onSearchChange: SearchChange<EventSearch>;
  onSubmitted: (eventId: string) => void | Promise<void>;
};
const columnChoicesSchema = z.record(z.string(), z.boolean());
const EMPTY_LOOKUP: never[] = [];

export function EventEditor({
  kind,
  defaultReasonId,
  children,
  facilityId,
  facilityTypeId,
  programId,
  username,
  canViewStock,
  search,
  onSearchChange,
  onSubmitted,
}: Props) {
  const { t, i18n } = useTranslation();
  const config = EVENT_KINDS[kind];
  const queryClient = useQueryClient();
  const today = toDateValue(new Date());
  const filterCards = useCallback(
    (cards: readonly EventStockCard[]) => config.cardFilter(cards, today),
    [config, today],
  );
  const reasonsQuery = useQuery({
    ...validReasonsOptions({ program: programId, facilityType: facilityTypeId }),
    enabled: canViewStock,
  });
  const reasons = useMemo(
    () => (reasonsQuery.data ? config.reasons(reasonsQuery.data) : EMPTY_LOOKUP),
    [reasonsQuery.data, config],
  );
  const needsDestinations = config.counterparty === 'destination';
  const destinationsQuery = useQuery({
    ...validDestinationsOptions({ programId, facilityId }),
    enabled: canViewStock && needsDestinations,
  });
  const destinations = destinationsQuery.data ?? EMPTY_LOOKUP;
  const ready =
    reasonsQuery.data !== undefined &&
    (!needsDestinations || (destinationsQuery.data !== undefined && destinations.length > 0));
  const cardsQuery = useQuery({
    ...eventStockCardsOptions({ facilityId, programId }),
    enabled: canViewStock,
  });
  const offeredCards = useMemo(
    () => filterCards(cardsQuery.data ?? []),
    [cardsQuery.data, filterCards],
  );
  const hasLots = offeredCards.some((card) => !!card.lot);
  const hasVVM = offeredCards.some((card) => card.orderable.extraData?.useVVM === 'true');
  const reasonRequired = eventReasonRequired(kind, reasons, defaultReasonId);
  const quantityUnit = useQuantityUnit();
  const scanning = useFlag('GS1_SCANNING');
  const [submitted, setSubmitted] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [failure, setFailure] = useState<{ unknown: boolean; description: string } | null>(null);
  const [focusField, setFocusField] = useState<{ name: string; page: number } | null>(null);
  const signing = useRef(false);
  signing.current = signatureOpen;
  const lastAdded = useRef<ReturnType<typeof newEventLine> | undefined>(undefined);
  const leaving = useRef(false);
  const posting = useRef(false);
  const region = useRef<HTMLDivElement>(null);
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const measureRegion = useCallback(
    (element: HTMLDivElement | null) => {
      region.current = element;
      measure(element);
    },
    [measure],
  );
  const [choices, setChoices] = useStoredState(config.columnChoicesKey, columnChoicesSchema, {});
  const hideableColumns = eventHideableColumns(kind, { hasLots, unit: quantityUnit.unit });
  const columns = useColumnVisibility(hideableColumns, [choices, setChoices], width);
  const lineOptions = { kind, reasons, defaultReasonId, today, assignments: destinations };
  const schema = eventLinesSchema(lineOptions);
  const form = useEventForm({
    ...lineOptions,
    onValid: () => {
      if (form.state.values.lines.length) setSignatureOpen(true);
    },
    onInvalid: () => showInvalid(),
  });
  const showInvalid = () => {
    const issue = schema.safeParse(form.state.values).error?.issues[0];
    if (!issue) return;
    const index = Number(issue.path[1]);
    const field = String(issue.path[2]);
    const page = pageOf(index, search.size ?? 10);
    setFocusField({ name: `lines[${index}].${field}`, page });
    onSearchChange(
      {
        keyword: undefined,
        page: page === 1 ? undefined : page,
      },
      true,
    );
    toast.error(t(config.copy.invalidTitle), {
      description: t(config.copy.invalidDescription),
    });
  };
  const lines = useStore(form.store, (state) => state.values.lines);
  const latestAdded = lines.find((line) => line.key === lastAdded.current?.key);
  if (latestAdded) lastAdded.current = latestAdded;
  const guard = useDiscardGuard(lines.length > 0 && !submitted, {
    allowLeave: () => leaving.current,
  });
  const keyword = search.keyword ?? '';
  const lineKeys = JSON.stringify(lines.map((line) => line.key));
  const language = i18n.language;
  const [filter, setFilter] = useState({
    keyword: '',
    lineKeys: '',
    language: '',
    matches: new Set<string>(),
  });
  let matches = filter.matches;
  if (keyword !== filter.keyword || lineKeys !== filter.lineKeys || language !== filter.language) {
    matches = new Set(
      filterEventLines(
        lines,
        keyword,
        reasons,
        (value) => formatDateValue(value, i18n.language),
        t('stock-events.no-lot-defined'),
        destinations,
      ).map((line) => line.key),
    );
    setFilter({ keyword, lineKeys, language, matches });
  }
  const filtered = useMemo(() => lines.filter((line) => matches.has(line.key)), [lines, matches]);
  const mutation = useSessionMutation({
    mutationFn: (body: Parameters<typeof submitStockEvent>[0]) => submitStockEvent(body),
    retry: false,
  });
  const pending = mutation.isPending;
  const clearFilter = () => onSearchChange({ keyword: undefined, page: undefined }, true);
  useEffect(() => {
    if (!focusField || search.keyword || (search.page ?? 1) !== focusField.page) return;
    const target = document.getElementById(focusField.name);
    if (target && region.current?.contains(target)) {
      target.focus();
      setFocusField(null);
    }
  }, [focusField, search.keyword, search.page]);
  const add = (card: EventStockCard) => {
    if (!ready || submitted || pending) return;
    const next = newEventLine(card, lastAdded.current, today, lineOptions);
    lastAdded.current = next;
    form.setFieldValue('lines', (current) => [next, ...current]);
    clearFilter();
  };
  const remove = useCallback(
    (key: string) => {
      const actions = Array.from(
        region.current?.querySelectorAll<HTMLButtonElement>('[data-line-actions]') ?? [],
      );
      const index = actions.findIndex((button) => button.dataset.lineActions === key);
      flushSync(() =>
        form.setFieldValue('lines', (current) => current.filter((line) => line.key !== key)),
      );
      requestAnimationFrame(() => {
        const next = region.current?.querySelectorAll<HTMLButtonElement>('[data-line-actions]');
        (
          next?.[Math.min(index, next.length - 1)] ??
          region.current?.querySelector<HTMLButtonElement>('[data-add-product]')
        )?.focus();
      });
    },
    [form],
  );
  const confirmSubmit = async (signature: string) => {
    if (posting.current) return;
    if (!schema.safeParse(form.state.values).success) {
      setSignatureOpen(false);
      await form.validate('submit');
      if (!mutation.isCurrent()) return;
      showInvalid();
      return;
    }
    posting.current = true;
    setFailure(null);
    let eventId: string;
    try {
      eventId = await mutation.mutateAsync(
        eventPayload({
          kind,
          assignments: destinations,
          facilityId,
          programId,
          signature,
          lines: form.state.values.lines,
        }),
      );
    } catch (error) {
      if (!mutation.isCurrent()) return;
      const unknown = isAxiosError(error) && !error.response;
      const description = unknown
        ? t('stock-events.unknown-outcome-description')
        : (serverMessage(error) ?? t(config.copy.submitErrorDescription));
      setFailure({ unknown, description });
      toast.error(
        t(unknown ? 'stock-events.unknown-outcome-title' : config.copy.submitErrorTitle),
        { description },
      );
      setSignatureOpen(false);
      posting.current = false;
      return;
    }
    if (!mutation.isCurrent()) return;
    setSignatureOpen(false);
    leaving.current = true;
    flushSync(() => setSubmitted(true));
    toast.success(t(config.copy.submittedTitle), {
      description: t(config.copy.submittedDescription),
    });
    for (const queryKey of [
      queryKeys.stockEvents.all,
      queryKeys.stockCardSummaries.all,
      queryKeys.stockCards.all,
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
    if (!guard.leaveIfAsked()) await onSubmitted(eventId);
  };
  const [expiryPrompt, setExpiryPrompt] = useState<{
    recorded: string;
    scanned: string;
    complete: (accepted: boolean) => void;
  } | null>(null);
  const onScan = async (
    parsed: Gs1Result,
    signal: AbortSignal,
  ): Promise<ScanMessage | undefined> => {
    if (!ready || submitted || pending) return;
    if (!parsed.ok) return scanMessage(parsed.error);
    if (signal.aborted || signing.current || !mutation.isCurrent()) return;
    let tradeItem: TradeItem | null;
    try {
      tradeItem = await queryClient.fetchQuery(tradeItemByGtinOptions(parsed.gtin));
    } catch {
      return signal.aborted || signing.current || !mutation.isCurrent()
        ? undefined
        : scanMessage('gtinLookupFailed');
    }
    if (signal.aborted || signing.current || !mutation.isCurrent()) return;
    if (!tradeItem) return scanMessage('gtinNotRegistered', { gtin: parsed.gtin });
    const cards = queryClient.getQueryData(
      eventStockCardsOptions({ facilityId, programId }).queryKey,
    );
    if (!cards) return { key: 'scan.not-resolved' };
    const resolution = resolveScan({
      scan: parsed,
      tradeItemId: tradeItem.id,
      products: eventProductOptions(filterCards(cards)),
      lines: form.state.values.lines,
      policy: { allowsNewLot: false },
    });
    if (resolution.type === 'refuse') return scanMessage(resolution.reason, resolution.params);
    let action = resolution;
    if (resolution.type === 'confirm-expiry') {
      const next = resolution.next;
      const lot =
        next.type === 'add'
          ? next.card.lot
          : form.state.values.lines.find((line) => line.key === next.lineKey)?.lot;
      if (lot && !isScanExpiryAcknowledged(lot)) {
        const accepted = await new Promise<boolean>((resolve) => {
          const abort = () => {
            setExpiryPrompt(null);
            resolve(false);
          };
          signal.addEventListener('abort', abort, { once: true });
          setExpiryPrompt({
            recorded: resolution.recorded,
            scanned: resolution.scanned,
            complete: (value) => {
              signal.removeEventListener('abort', abort);
              setExpiryPrompt(null);
              resolve(value);
            },
          });
        });
        if (signal.aborted || signing.current || !mutation.isCurrent()) return;
        if (!accepted) return { key: 'scan.not-resolved' };
        acknowledgeScanExpiry(lot);
      }
      action = resolution.next;
    }
    if (signal.aborted || signing.current || !mutation.isCurrent()) return;
    const next = applyScanCount(form.state.values.lines, action, {
      ...lineOptions,
      previousLine: lastAdded.current,
    });
    const countedKey = action.type === 'count' ? action.lineKey : next[0].key;
    if (action.type === 'add') lastAdded.current = next[0];
    form.setFieldValue('lines', next);
    const visible = next.filter((line) => matches.has(line.key));
    const hidden = !visible.some((line) => line.key === countedKey);
    const index = (hidden ? next : visible).findIndex((line) => line.key === countedKey);
    const page = pageOf(index, search.size ?? 10);
    onSearchChange(
      {
        ...(hidden ? { keyword: undefined } : {}),
        page: page === 1 ? undefined : page,
      },
      true,
    );
  };
  const scanStatus = useBarcodeScan({
    enabled: scanning && canViewStock && ready && !submitted && !pending && !signatureOpen,
    onScan,
  });
  const visibility = {
    ...columns.visibility,
    total: quantityUnit.unit === 'PACKS' && columns.visibility.total !== false,
    lotCode: hasLots && columns.visibility.lotCode !== false,
    expiry: hasLots && columns.visibility.expiry !== false,
    vvm: hasVVM,
  };
  return (
    <>
      <Workspace>
        {children}
        <WorkspaceContent>
          <div className="flex min-w-0 flex-col gap-4" ref={measureRegion}>
            <form
              className="flex min-w-0 flex-col gap-4"
              id={config.formId}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (lines.length && ready && !submitted && !pending) void form.handleSubmit();
              }}
            >
              {canViewStock && (
                <QueryBoundary
                  resetKey={`${facilityId}/${programId}`}
                  pendingFallback={<ProductLotPickerSkeleton />}
                  errorComponent={StockCardsError}
                >
                  <ProductLotPicker
                    facilityId={facilityId}
                    programId={programId}
                    disabled={pending || submitted || !ready}
                    cardFilter={filterCards}
                    onAdd={add}
                  >
                    {scanning && <ScanStatus {...scanStatus} />}
                  </ProductLotPicker>
                </QueryBoundary>
              )}
              <DataTableToolbar>
                <fieldset className="w-full @xl/main:w-72" disabled={pending}>
                  <DataTableSearch
                    value={keyword}
                    resetKey={`${search.page ?? 1}/${search.size ?? 10}`}
                    placeholder={t('stock-events.keywords')}
                    onValueChange={(value) =>
                      onSearchChange({ keyword: value.trim() || undefined, page: undefined }, true)
                    }
                  />
                </fieldset>
                <div className="flex w-full flex-wrap items-center justify-end gap-2 @xl/main:ms-auto @xl/main:w-auto">
                  {quantityUnit.canSwitch && (
                    <QuantityUnitToggle
                      unit={quantityUnit.unit}
                      onUnitChange={quantityUnit.setUnit}
                      disabled={pending || submitted}
                    />
                  )}
                  <div className="shrink-0">
                    <DataTableViewOptions
                      {...columns}
                      columns={hideableColumns
                        .filter(
                          (column) =>
                            (column.id !== 'total' || quantityUnit.unit === 'PACKS') &&
                            (column.id !== 'expiry' || hasLots),
                        )
                        .map((column) => ({ id: column.id, label: t(column.labelKey) }))}
                    />
                  </div>
                </div>
              </DataTableToolbar>
              {!canViewStock ? (
                <DataTableEmpty
                  icon={<ShieldAlertIcon />}
                  title={t('stock-events.no-stock-view-title')}
                  description={t('stock-events.no-stock-view-description')}
                />
              ) : (
                <QueryBoundary
                  resetKey={`${programId}/${facilityTypeId}`}
                  pendingFallback={<LookupSkeleton />}
                  errorComponent={ReasonsError}
                >
                  <ReasonsReady programId={programId} facilityTypeId={facilityTypeId}>
                    <DestinationsReady
                      needed={needsDestinations}
                      facilityId={facilityId}
                      programId={programId}
                    >
                      <EventLineTable
                        kind={kind}
                        reasonRequired={reasonRequired}
                        form={form}
                        lines={filtered}
                        reasons={reasons}
                        destinations={destinations}
                        unit={quantityUnit.unit}
                        today={today}
                        disabled={pending || submitted}
                        onRemove={remove}
                        search={search}
                        onSearchChange={onSearchChange}
                        columnVisibility={visibility}
                        onClearFilter={clearFilter}
                      />
                    </DestinationsReady>
                  </ReasonsReady>
                </QueryBoundary>
              )}
              {failure && (
                <ErrorAlert
                  title={t(
                    failure.unknown
                      ? 'stock-events.unknown-outcome-title'
                      : config.copy.submitErrorTitle,
                  )}
                  description={failure.description}
                />
              )}
            </form>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter>
        <Button
          disabled={!filtered.length || pending || submitted}
          onClick={() => setClearOpen(true)}
          size="lg"
          variant="outline"
        >
          {t('stock-events.clear')}
        </Button>
        <Button
          disabled={!lines.length || pending || submitted || !ready}
          form={config.formId}
          size="lg"
          type="submit"
        >
          {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('stock-events.submit')}
        </Button>
      </WorkspaceFooter>
      <ClearLinesDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        restoreFocus={() => region.current?.querySelector<HTMLInputElement>('[role="combobox"]')}
        count={filtered.length}
        onClear={() => {
          const keys = new Set(filtered.map((line) => line.key));
          form.setFieldValue('lines', (current) => current.filter((line) => !keys.has(line.key)));
        }}
      />
      <SignatureDialog
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        username={username}
        pending={pending}
        onConfirm={confirmSubmit}
      />
      <DiscardChangesDialog {...guard.dialog} description={t('stock-events.discard-description')} />
      <AlertDialog
        open={!!expiryPrompt}
        onOpenChange={(open) => {
          if (!open) expiryPrompt?.complete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stock-events.expiry-mismatch-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {expiryPrompt &&
                t('scan.confirm-expiry-mismatch', {
                  scannedDate: formatDateValue(expiryPrompt.scanned, i18n.language),
                  recordedDate: formatDateValue(expiryPrompt.recorded, i18n.language),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('stock-events.cancel')}</AlertDialogCancel>
            <Button onClick={() => expiryPrompt?.complete(true)}>
              {t('stock-events.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StockCardsError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation();
  if (isRefused(error)) return <p>{t('stock-events.no-stock-view-description')}</p>;
  return (
    <LoadError
      error={error}
      reset={reset}
      title={t('stock-events.cards-error-title')}
      description={t('stock-events.cards-error-description')}
    />
  );
}

function ReasonsReady({
  programId,
  facilityTypeId,
  children,
}: {
  programId: string;
  facilityTypeId: string;
  children: ReactNode;
}) {
  useSuspenseQuery(validReasonsOptions({ program: programId, facilityType: facilityTypeId }));
  return children;
}

function ReasonsError(props: { error: unknown; reset: () => void }) {
  return <LookupError {...props} lookup="reasons" />;
}

function DestinationsReady({
  needed,
  facilityId,
  programId,
  children,
}: {
  needed: boolean;
  facilityId: string;
  programId: string;
  children: ReactNode;
}) {
  if (!needed) return children;
  return (
    <QueryBoundary
      resetKey={`${programId}/${facilityId}`}
      pendingFallback={<LookupSkeleton />}
      errorComponent={DestinationsError}
    >
      <DestinationLookup facilityId={facilityId} programId={programId}>
        {children}
      </DestinationLookup>
    </QueryBoundary>
  );
}

function DestinationLookup({
  facilityId,
  programId,
  children,
}: {
  facilityId: string;
  programId: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(validDestinationsOptions({ facilityId, programId }));
  if (!data.length)
    return (
      <DataTableEmpty
        icon={<ShieldAlertIcon />}
        title={t('stock-events.no-destinations-title')}
        description={t('stock-events.no-destinations-description')}
      />
    );
  return children;
}

function DestinationsError(props: { error: unknown; reset: () => void }) {
  return <LookupError {...props} lookup="destinations" />;
}

function LookupSkeleton() {
  return (
    <div className="h-40">
      <Skeleton fill />
    </div>
  );
}

function LookupError({
  error,
  reset,
  lookup,
}: {
  error: unknown;
  reset: () => void;
  lookup: 'reasons' | 'destinations';
}) {
  const { t } = useTranslation();
  if (isRefused(error)) return <p>{t('no-access.description')}</p>;
  return (
    <LoadError
      error={error}
      reset={reset}
      title={t(`stock-events.${lookup}-error-title`)}
      description={t(`stock-events.${lookup}-error-description`)}
    />
  );
}
