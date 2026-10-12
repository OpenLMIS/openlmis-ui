import { useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { Loader2Icon, ShieldAlertIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataTableEmpty, DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useElementWidth } from '@/components/data-table/responsive-columns';
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
import { Workspace, WorkspaceContent, WorkspaceFooter } from '@/components/workspace';
import {
  orderablesByIdsOptions,
  reasonsOptions,
  tradeItemByGtinOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import type { TradeItem } from '@/features/reference-data/lib/types';
import { submitStockEvent } from '@/features/stock-events/api/api';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import { ClearLinesDialog } from '@/features/stock-events/components/clear-lines-dialog';
import {
  EventLineTable,
  EventLineTableSkeleton,
  eventHideableColumns,
} from '@/features/stock-events/components/event-line-table';
import {
  ProductLotPicker,
  ProductLotPickerSkeleton,
} from '@/features/stock-events/components/product-lot-picker';
import { SignatureDialog } from '@/features/stock-events/components/signature-dialog';
import { SubmitConfirmDialog } from '@/features/stock-events/components/submit-confirm-dialog';
import { useEventForm } from '@/features/stock-events/hooks/use-event-form';
import { applyScanCount } from '@/features/stock-events/lib/apply-scan';
import {
  type EventLineCandidate,
  eventLinesSchema,
  eventPayload,
  eventReasonRequired,
  newEventLine,
} from '@/features/stock-events/lib/event-form';
import {
  COUNTERPARTY,
  type ConfiguredEventKind,
  type CounterpartySide,
  counterpartyOptions,
  EVENT_KINDS,
  type EventKindConfig,
} from '@/features/stock-events/lib/event-kinds';
import {
  type KitUnpackReasonIds,
  kitContentsChanged,
  unpackReasons,
  withFreshContents,
} from '@/features/stock-events/lib/kit-unpack';
import { filterEventLines, pageOf } from '@/features/stock-events/lib/line-filter';
import { eventProductOptions, productHasLots } from '@/features/stock-events/lib/products';
import {
  type ApprovedScanProduct,
  approvedScanProduct,
} from '@/features/stock-events/lib/scan-products';
import type { EventStockCard } from '@/features/stock-events/lib/types';
import { useBarcodeScan } from '@/hooks/use-barcode-scan';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useFitColumnVisibility } from '@/hooks/use-fit-column-visibility';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { useStoredState } from '@/hooks/use-stored-state';
import { useFlag } from '@/lib/feature-flags';
import type { Gs1Result } from '@/lib/gs1/parse-gs1';
import { isOfflineError, isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import {
  acknowledgeScanExpiry,
  isScanExpiryAcknowledged,
} from '@/lib/scan-expiry-acknowledgements';
import { type ScanMessage, scanMessage } from '@/lib/scan-messages';
import { resolveScan, type ScanProduct } from '@/lib/stock-scan';
import type { SearchChange } from '@/lib/table-search';

export type EventSearch = {
  page?: number | undefined;
  size?: number | undefined;
  keyword?: string | undefined;
};
type Props = {
  kind: ConfiguredEventKind;
  defaultReasonId?: string;
  kitUnpackReasonIds?: KitUnpackReasonIds;
  children: ReactNode;
  facilityId: string;
  facilityTypeId: string;
  programId: string;
  username: string;
  canViewStock: boolean;
  canManageLots?: boolean;
  search: EventSearch;
  onSearchChange: SearchChange<EventSearch>;
  onSubmitted: (eventId: string) => void | Promise<void>;
};
const columnChoicesSchema = z.record(z.string(), z.boolean());
const EMPTY_LOOKUP: never[] = [];

export function EventEditor({
  kind,
  defaultReasonId,
  kitUnpackReasonIds,
  children,
  facilityId,
  facilityTypeId,
  programId,
  username,
  canViewStock,
  canManageLots = false,
  search,
  onSearchChange,
  onSubmitted,
}: Props) {
  const { t, i18n } = useTranslation();
  const config: EventKindConfig = EVENT_KINDS[kind];
  const queryClient = useQueryClient();
  const today = toDateValue(new Date());
  const { products } = config;
  const fromCards = products.from === 'stock-cards';
  const filterCards = useCallback(
    (cards: readonly EventStockCard[]) =>
      products.from === 'stock-cards' ? products.cardFilter(cards, today) : [],
    [products, today],
  );
  const reasonsQuery = useQuery({
    ...validReasonsOptions({ program: programId, facilityType: facilityTypeId }),
    enabled: canViewStock && config.reasons !== null,
  });
  const reasons = useMemo(
    () => (reasonsQuery.data && config.reasons ? config.reasons(reasonsQuery.data) : EMPTY_LOOKUP),
    [reasonsQuery.data, config],
  );
  const needsKitContents = config.contents === 'kit';
  const kitReasonsQuery = useQuery({
    ...reasonsOptions(),
    enabled: canViewStock && needsKitContents,
  });
  const kitReasons = unpackReasons(kitReasonsQuery.data, kitUnpackReasonIds ?? {});
  const side = config.counterparty;
  const needsCounterparty = side !== 'none';
  const counterpartyQuery = useQuery({
    ...counterpartyOptions(needsCounterparty ? side : 'destination', { programId, facilityId }),
    enabled: canViewStock && needsCounterparty,
  });
  const assignments = counterpartyQuery.data ?? EMPTY_LOOKUP;
  const ready =
    (config.reasons === null || reasonsQuery.data !== undefined) &&
    (!needsKitContents || (kitReasonsQuery.data !== undefined && kitReasons.ok)) &&
    (!needsCounterparty || (counterpartyQuery.data !== undefined && assignments.length > 0));
  const cardsQuery = useQuery({
    ...eventStockCardsOptions({ facilityId, programId }),
    enabled: canViewStock && fromCards,
  });
  const offeredCards = useMemo(
    () => filterCards(cardsQuery.data ?? []),
    [cardsQuery.data, filterCards],
  );
  const reasonRequired = eventReasonRequired(kind, reasons, defaultReasonId);
  const quantityUnit = useQuantityUnit();
  const scanning = useFlag('GS1_SCANNING') && config.scanning;
  const [submitted, setSubmitted] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [contentsChangedOpen, setContentsChangedOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [failure, setFailure] = useState<{ unknown: boolean; description: string } | null>(null);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const alertTarget = useRef<{ name: string; page: number } | null>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const [focusField, setFocusField] = useState<{ name: string; page: number } | null>(null);
  const signing = useRef(false);
  signing.current = confirmationOpen;
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
  const lineOptions = { kind, reasons, defaultReasonId, today, assignments };
  const schema = eventLinesSchema(lineOptions);
  const form = useEventForm({
    ...lineOptions,
    onValid: () => {
      if (mutation.isCurrent() && form.state.values.lines.length) setConfirmationOpen(true);
    },
    onInvalid: () => {
      if (mutation.isCurrent()) showInvalid();
    },
  });
  const showInvalid = () => {
    const issue = schema.safeParse(form.state.values).error?.issues[0];
    if (!issue) return;
    const index = Number(issue.path[1]);
    const field = String(issue.path[2]);
    const page = pageOf(index, search.size ?? 10);
    alertTarget.current = { name: `lines[${index}].${field}`, page };
    onSearchChange(
      {
        keyword: undefined,
        page: page === 1 ? undefined : page,
      },
      true,
    );
    setValidationOpen(true);
  };
  const lines = useStore(form.store, (state) => state.values.lines);
  const hasLots =
    !fromCards || offeredCards.some((card) => !!card.lot) || lines.some((line) => !!line.lot);
  const hasVVM =
    offeredCards.some((card) => card.orderable.extraData?.useVVM === 'true') ||
    lines.some((line) => line.useVVM);
  const hideableColumns = eventHideableColumns(kind);
  const fitColumns = useMemo(
    () =>
      hideableColumns.filter(
        ({ id }) =>
          (id !== 'total' || quantityUnit.unit === 'PACKS') && (id !== 'expiry' || hasLots),
      ),
    [hideableColumns, quantityUnit.unit, hasLots],
  );
  const fitLineKeys = lines.map((line) => line.key).join(',');
  const hasCounterpartyComments = lines.some((line) =>
    assignments.some((item) => item.id === line.counterparty && item.isFreeTextAllowed),
  );
  const fitContent = useMemo(
    () => ({
      fitLineKeys,
      language: i18n.language,
      unit: quantityUnit.unit,
      hasLots,
      hasVVM,
      hasCounterpartyComments,
      ready,
    }),
    [
      fitLineKeys,
      i18n.language,
      quantityUnit.unit,
      hasLots,
      hasVVM,
      hasCounterpartyComments,
      ready,
    ],
  );
  const latestAdded = lines.find((line) => line.key === lastAdded.current?.key);
  if (latestAdded) lastAdded.current = latestAdded;
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
        assignments,
      ).map((line) => line.key),
    );
    setFilter({ keyword, lineKeys, language, matches });
  }
  const filtered = useMemo(() => lines.filter((line) => matches.has(line.key)), [lines, matches]);
  const measured = config.columnFit === 'measured';
  const columns = useFitColumnVisibility(
    measured ? fitColumns : hideableColumns,
    [choices, setChoices],
    region,
    width,
    fitContent,
    measured,
    lines.length > 0 && filtered.length === 0,
  );
  const mutation = useSessionMutation({
    mutationFn: (body: Parameters<typeof submitStockEvent>[0]) => submitStockEvent(body),
    retry: false,
  });
  const pending = refreshing || mutation.isPending;
  const guard = useDiscardGuard(lines.length > 0 && !submitted, {
    allowLeave: () => leaving.current,
    pending,
  });
  const clearFilter = () => onSearchChange({ keyword: undefined, page: undefined }, true);
  useEffect(() => {
    if (!focusField || search.keyword || (search.page ?? 1) !== focusField.page) return;
    const target = document.getElementById(focusField.name);
    if (target && region.current?.contains(target)) {
      target.focus();
      setFocusField(null);
    }
  }, [focusField, search.keyword, search.page]);
  const add = (candidate: EventLineCandidate, hasLotsOfProduct: boolean) => {
    if (!ready || submitted || pending) return;
    const next = newEventLine(candidate, lastAdded.current, today, {
      ...lineOptions,
      productHasLots: hasLotsOfProduct,
    });
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
  const submit = async () => {
    if (!mutation.isCurrent()) return;
    if (!needsKitContents) {
      void form.handleSubmit();
      return;
    }
    setRefreshing(true);
    try {
      const currentLines = form.state.values.lines;
      const kitIds = [...new Set(currentLines.map((line) => line.orderable.id))];
      const fresh = await queryClient.fetchQuery({
        ...orderablesByIdsOptions(kitIds),
        staleTime: 0,
      });
      if (!mutation.isCurrent()) return;
      form.setFieldValue('lines', withFreshContents(currentLines, fresh));
      if (kitContentsChanged(currentLines, fresh).length) {
        setContentsChangedOpen(true);
        return;
      }
      await form.handleSubmit();
      if (!mutation.isCurrent()) return;
    } catch (error) {
      if (!mutation.isCurrent()) return;
      setFailure({
        unknown: false,
        description: isOfflineError(error)
          ? t('stock-unpack.refresh-offline')
          : (serverMessage(error) ?? t(config.copy.submitErrorDescription)),
      });
    } finally {
      setRefreshing(false);
    }
  };
  const confirmSubmit = async (signature?: string) => {
    if (posting.current || !mutation.isCurrent() || (needsKitContents && !kitReasons.ok)) return;
    if (!schema.safeParse(form.state.values).success) {
      setConfirmationOpen(false);
      await form.validate('submit');
      if (!mutation.isCurrent()) return;
      showInvalid();
      return;
    }
    posting.current = true;
    setFailure(null);
    setUnknownOutcome(false);
    let eventId: string;
    const payload = eventPayload({
      kind,
      assignments,
      facilityId,
      programId,
      signature,
      kitReasons: needsKitContents && kitReasons.ok ? kitReasons : undefined,
      lines: form.state.values.lines,
    });
    try {
      eventId = await mutation.mutateAsync(payload);
    } catch (error) {
      if (!mutation.isCurrent()) return;
      const unknown = isAxiosError(error) && !error.response;
      const description = unknown
        ? t('stock-events.unknown-outcome-description')
        : (serverMessage(error) ?? t(config.copy.submitErrorDescription));
      setFailure({ unknown, description });
      setUnknownOutcome(unknown);
      setConfirmationOpen(false);
      posting.current = false;
      return;
    }
    if (!mutation.isCurrent()) return;
    setConfirmationOpen(false);
    leaving.current = true;
    flushSync(() => setSubmitted(true));
    toast.success(t(config.copy.submittedTitle), {
      description: t(config.copy.submittedDescription),
    });
    for (const queryKey of [
      queryKeys.stockEvents.all,
      queryKeys.stockCardSummaries.all,
      queryKeys.stockCards.all,
      ...(payload.lineItems.some((item) => item.lot) ? [queryKeys.lots.all] : []),
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
    const stale = () => signal.aborted || signing.current || !mutation.isCurrent();
    if (stale()) return;
    let tradeItem: TradeItem | null;
    try {
      tradeItem = await queryClient.fetchQuery(tradeItemByGtinOptions(parsed.gtin));
    } catch {
      return stale() ? undefined : scanMessage('gtinLookupFailed');
    }
    if (stale()) return;
    if (!tradeItem) return scanMessage('gtinNotRegistered', { gtin: parsed.gtin });
    let scanProducts: readonly ScanProduct<EventStockCard>[];
    let hasLotsOf: (orderableId: string) => boolean;
    if (products.from === 'stock-cards') {
      const cards = queryClient.getQueryData(
        eventStockCardsOptions({ facilityId, programId }).queryKey,
      );
      if (!cards) return { key: 'scan.not-resolved' };
      const offered = filterCards(cards);
      scanProducts = eventProductOptions(offered);
      hasLotsOf = (orderableId) => productHasLots(offered, orderableId);
    } else {
      let found: ApprovedScanProduct;
      try {
        found = await approvedScanProduct(
          queryClient,
          { facilityId, programId },
          tradeItem.id,
          stale,
        );
      } catch {
        return stale() ? undefined : scanMessage('gtinLookupFailed');
      }
      if (found.type === 'stale' || stale()) return;
      if (found.type === 'refuse') return scanMessage(found.reason, { gtin: parsed.gtin });
      scanProducts = [found.product];
      hasLotsOf = () => found.productHasLots;
    }
    const resolution = resolveScan({
      scan: parsed,
      tradeItemId: tradeItem.id,
      products: scanProducts,
      lines: form.state.values.lines,
      policy:
        config.newLots === 'manual-and-scan'
          ? { allowsNewLot: true, today }
          : { allowsNewLot: false },
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
        if (stale()) return;
        if (!accepted) return { key: 'scan.not-resolved' };
        acknowledgeScanExpiry(lot);
      }
      action = resolution.next;
    }
    if (stale()) return;
    const next = applyScanCount(form.state.values.lines, action, {
      ...lineOptions,
      previousLine: lastAdded.current,
      productHasLots: action.type === 'add' && hasLotsOf(action.card.orderable.id),
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
    enabled:
      scanning &&
      canViewStock &&
      ready &&
      !submitted &&
      !pending &&
      !confirmationOpen &&
      !validationOpen &&
      !failure,
    onScan,
  });
  const visibility = {
    ...columns.visibility,
    total: quantityUnit.unit === 'PACKS' && columns.visibility.total !== false,
    lotCode: hasLots && columns.visibility.lotCode !== false,
    expiry: hasLots && columns.visibility.expiry !== false,
    vvm: hasVVM,
  };
  const tablePending = (
    <EventLineTableSkeleton kind={kind} unit={quantityUnit.unit} columnVisibility={visibility} />
  );
  return (
    <>
      <Workspace width={config.width}>
        {children}
        <WorkspaceContent>
          <div className="flex min-w-0 flex-col gap-4" ref={measureRegion}>
            <form
              className="flex min-w-0 flex-col gap-4"
              id={config.formId}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (lines.length && ready && !submitted && !pending) void submit();
              }}
            >
              {canViewStock && (
                <QueryBoundary
                  resetKey={`${facilityId}/${programId}`}
                  pendingFallback={<ProductLotPickerSkeleton kind={kind} scanning={scanning} />}
                  errorComponent={StockCardsError}
                >
                  <ProductLotPicker
                    kind={kind}
                    facilityId={facilityId}
                    programId={programId}
                    disabled={pending || submitted || !ready}
                    {...(fromCards
                      ? { cardFilter: filterCards }
                      : { from: 'approved-products' as const, canManageLots, lines })}
                    onAdd={add}
                  >
                    {scanning && <ScanStatus {...scanStatus} />}
                  </ProductLotPicker>
                </QueryBoundary>
              )}
              {unknownOutcome && (
                <ErrorAlert
                  title={t('stock-events.unknown-outcome-title')}
                  description={t('stock-events.unknown-outcome-description')}
                />
              )}
              {needsKitContents && kitReasonsQuery.data !== undefined && !kitReasons.ok && (
                <ErrorAlert
                  title={t('stock-unpack.not-set-up-title')}
                  description={t('stock-unpack.not-set-up-description', {
                    setting: kitReasons.setting,
                  })}
                />
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
              ) : fromCards && cardsQuery.isError && cardsQuery.data === undefined ? (
                <EventLineTableSkeleton
                  kind={kind}
                  unit={quantityUnit.unit}
                  columnVisibility={visibility}
                  busy={false}
                />
              ) : (
                <OptionalReasonsReady
                  needed={config.reasons !== null || needsKitContents}
                  allReasons={needsKitContents}
                  programId={programId}
                  facilityTypeId={facilityTypeId}
                  pendingFallback={tablePending}
                >
                  <StockCardsReady needed={fromCards} facilityId={facilityId} programId={programId}>
                    <CounterpartyReady
                      pendingFallback={tablePending}
                      side={needsCounterparty ? side : null}
                      facilityId={facilityId}
                      programId={programId}
                    >
                      <EventLineTable
                        kind={kind}
                        fitContent={fitContent}
                        containerWidth={width}
                        reasonRequired={reasonRequired}
                        form={form}
                        lines={filtered}
                        reasons={reasons}
                        assignments={assignments}
                        unit={quantityUnit.unit}
                        today={today}
                        disabled={pending || submitted}
                        onRemove={remove}
                        search={search}
                        onSearchChange={onSearchChange}
                        columnVisibility={visibility}
                        onClearFilter={clearFilter}
                      />
                    </CounterpartyReady>
                  </StockCardsReady>
                </OptionalReasonsReady>
              )}
            </form>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width={config.width}>
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
          ref={submitButton}
          form={config.formId}
          size="lg"
          type="submit"
        >
          {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('stock-events.submit')}
        </Button>
      </WorkspaceFooter>
      <AlertDialog
        open={validationOpen || !!failure}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setValidationOpen(false);
            setFailure(null);
          }
        }}
        onOpenChangeComplete={(open) => {
          if (open || !alertTarget.current) return;
          setFocusField(alertTarget.current);
          alertTarget.current = null;
        }}
      >
        <AlertDialogContent finalFocus={alertTarget.current ? false : submitButton}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                failure
                  ? failure.unknown
                    ? 'stock-events.unknown-outcome-title'
                    : config.copy.submitErrorTitle
                  : config.copy.invalidTitle,
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {failure?.description ?? t(config.copy.invalidDescription)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('dialog.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={contentsChangedOpen}
        onOpenChange={(open) => {
          if (!pending) setContentsChangedOpen(open);
        }}
      >
        <AlertDialogContent finalFocus={submitButton}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stock-unpack.contents-changed-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('stock-unpack.contents-changed-description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ClearLinesDialog
        kind={kind}
        open={clearOpen}
        onOpenChange={setClearOpen}
        restoreFocus={() => region.current?.querySelector<HTMLInputElement>('[role="combobox"]')}
        count={filtered.length}
        onClear={() => {
          const keys = new Set(filtered.map((line) => line.key));
          form.setFieldValue('lines', (current) => current.filter((line) => !keys.has(line.key)));
        }}
      />
      {config.confirmation.type === 'signature' ? (
        <SignatureDialog
          open={confirmationOpen}
          onOpenChange={setConfirmationOpen}
          username={username}
          pending={pending}
          onConfirm={confirmSubmit}
        />
      ) : (
        <SubmitConfirmDialog
          open={confirmationOpen}
          onOpenChange={setConfirmationOpen}
          username={username}
          count={lines.length}
          title={config.confirmation.title}
          description={config.confirmation.description}
          pending={pending}
          onConfirm={() => confirmSubmit()}
        />
      )}
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

function OptionalReasonsReady({
  needed,
  allReasons,
  pendingFallback,
  programId,
  facilityTypeId,
  children,
}: {
  needed: boolean;
  allReasons: boolean;
  pendingFallback: ReactNode;
  programId: string;
  facilityTypeId: string;
  children: ReactNode;
}) {
  if (!needed)
    return (
      <QueryBoundary
        resetKey={`${programId}/${facilityTypeId}`}
        pendingFallback={pendingFallback}
        errorComponent={StockCardsError}
      >
        {children}
      </QueryBoundary>
    );
  return (
    <QueryBoundary
      resetKey={`${programId}/${facilityTypeId}`}
      pendingFallback={pendingFallback}
      errorComponent={ReasonsError}
    >
      {allReasons ? (
        <KitReasonsReady>{children}</KitReasonsReady>
      ) : (
        <ReasonsReady programId={programId} facilityTypeId={facilityTypeId}>
          {children}
        </ReasonsReady>
      )}
    </QueryBoundary>
  );
}

function KitReasonsReady({ children }: { children: ReactNode }) {
  useSuspenseQuery(reasonsOptions());
  return children;
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

type ErrorProps = { error: unknown; reset: () => void };

function lookupError(title: ParseKeys, description: ParseKeys) {
  return function LookupErrorFallback(props: ErrorProps) {
    return <LookupError {...props} title={title} description={description} />;
  };
}

const ReasonsError = lookupError(
  'stock-events.reasons-error-title',
  'stock-events.reasons-error-description',
);

const COUNTERPARTY_ERRORS = {
  destination: lookupError(
    COUNTERPARTY.destination.lookupErrorTitle,
    COUNTERPARTY.destination.lookupErrorDescription,
  ),
  source: lookupError(
    COUNTERPARTY.source.lookupErrorTitle,
    COUNTERPARTY.source.lookupErrorDescription,
  ),
} satisfies Record<CounterpartySide, (props: ErrorProps) => ReactNode>;

function CounterpartyReady({
  pendingFallback,
  side,
  facilityId,
  programId,
  children,
}: {
  pendingFallback: ReactNode;
  side: CounterpartySide | null;
  facilityId: string;
  programId: string;
  children: ReactNode;
}) {
  if (!side) return children;
  return (
    <QueryBoundary
      resetKey={`${programId}/${facilityId}`}
      pendingFallback={pendingFallback}
      errorComponent={COUNTERPARTY_ERRORS[side]}
    >
      <CounterpartyLookup side={side} facilityId={facilityId} programId={programId}>
        {children}
      </CounterpartyLookup>
    </QueryBoundary>
  );
}

function CounterpartyLookup({
  side,
  facilityId,
  programId,
  children,
}: {
  side: CounterpartySide;
  facilityId: string;
  programId: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(counterpartyOptions(side, { facilityId, programId }));
  if (!data.length)
    return (
      <DataTableEmpty
        icon={<ShieldAlertIcon />}
        title={t(COUNTERPARTY[side].noLookupTitle)}
        description={t(COUNTERPARTY[side].noLookupDescription)}
      />
    );
  return children;
}

function StockCardsReady({
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
    <StockCardsLookup facilityId={facilityId} programId={programId}>
      {children}
    </StockCardsLookup>
  );
}

function StockCardsLookup({
  facilityId,
  programId,
  children,
}: {
  facilityId: string;
  programId: string;
  children: ReactNode;
}) {
  useSuspenseQuery(eventStockCardsOptions({ facilityId, programId }));
  return children;
}

function LookupError({
  error,
  reset,
  title,
  description,
}: ErrorProps & { title: ParseKeys; description: ParseKeys }) {
  const { t } = useTranslation();
  if (isRefused(error)) return <p>{t('no-access.description')}</p>;
  return <LoadError error={error} reset={reset} title={t(title)} description={t(description)} />;
}
