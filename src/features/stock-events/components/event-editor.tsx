import { useStore } from '@tanstack/react-form';
import {
  useQuery,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { Loader2Icon, ShieldAlertIcon } from 'lucide-react';
import {
  type ComponentProps,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataTableEmpty, DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { DraftStatus } from '@/components/draft-status';
import { formatDateValue, toDateValue } from '@/components/form/date-value';
import { InvalidSubmitDialog } from '@/components/invalid-submit-dialog';
import { LoadError } from '@/components/load-error';
import { SnapshotAlert, useSnapshotNotice } from '@/components/offline-alert';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { QueryBoundary } from '@/components/query-boundary';
import { ScanStatus } from '@/components/scan-status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
} from '@/features/reference-data/api/queries';
import { productLabel } from '@/features/reference-data/lib/products';
import type { TradeItem } from '@/features/reference-data/lib/types';
import {
  deviceNewLotsOptions,
  eventStockCardsOptions,
  eventValidReasonsOptions,
  fetchHomeStockTradeItem,
  fetchReceiveTradeItem,
  homeStockScope,
  type ReceiveDevice,
  receiveApprovedProductsOptions,
  receiveCatalogOptions,
  receiveDevice,
} from '@/features/stock-events/api/queries';
import { ClearLinesDialog } from '@/features/stock-events/components/clear-lines-dialog';
import { DeviceEventRecovery } from '@/features/stock-events/components/device-event-recovery';
import { EditLotDialog } from '@/features/stock-events/components/edit-lot-dialog';
import { EventArchivedCopies } from '@/features/stock-events/components/event-archived-copies';
import {
  EventLineTable,
  EventLineTableSkeleton,
  eventFitColumns,
  eventHideableColumns,
} from '@/features/stock-events/components/event-line-table';
import {
  EventLineToolbarActions,
  EventLineToolbarControls,
  EventLineToolbarStatus,
} from '@/features/stock-events/components/event-line-toolbar';
import {
  ProductLotPicker,
  ProductLotPickerSkeleton,
} from '@/features/stock-events/components/product-lot-picker';
import { SignatureDialog } from '@/features/stock-events/components/signature-dialog';
import { SubmitConfirmDialog } from '@/features/stock-events/components/submit-confirm-dialog';
import { useDeviceDrafts } from '@/features/stock-events/hooks/use-device-drafts';
import { useDeviceSubmission } from '@/features/stock-events/hooks/use-device-submission';
import { useEventForm } from '@/features/stock-events/hooks/use-event-form';
import { applyScanCount } from '@/features/stock-events/lib/apply-scan';
import {
  changeEventLot,
  type EventLine,
  type EventLineCandidate,
  eventLinesSchema,
  eventPayload,
  eventReasonRequired,
  isNewLot,
  newEventLine,
} from '@/features/stock-events/lib/event-form';
import {
  COUNTERPARTY,
  type ConfiguredEventKind,
  type CounterpartySide,
  counterpartyOptions,
  EVENT_KINDS,
  type EventKindConfig,
  homeStockDataset,
  receiveCatalogDataset,
} from '@/features/stock-events/lib/event-kinds';
import {
  type KitUnpackReasonIds,
  refreshKitContents,
  unpackReasons,
} from '@/features/stock-events/lib/kit-unpack';
import { filterEventLines, pageOf } from '@/features/stock-events/lib/line-filter';
import { eventProductOptions, productHasLots } from '@/features/stock-events/lib/products';
import { refusalMessage } from '@/features/stock-events/lib/refusal-message';
import {
  type ApprovedScanProduct,
  approvedScanProduct,
  catalogScanProduct,
} from '@/features/stock-events/lib/scan-products';
import type { StockEventDelivery } from '@/features/stock-events/lib/stock-event-delivery';
import { createStockEventContext } from '@/features/stock-events/lib/stock-event-local';
import type { StockEventDisplay } from '@/features/stock-events/lib/stock-event-queue';
import {
  copyRefusedEvent,
  type StockEventSyncError,
} from '@/features/stock-events/lib/stock-event-sync';
import type { EventStockCard, NewLot } from '@/features/stock-events/lib/types';
import { useBarcodeScan } from '@/hooks/use-barcode-scan';
import { columnChoicesSchema, useCardLayout } from '@/hooks/use-card-view';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { useFitColumnVisibility } from '@/hooks/use-fit-column-visibility';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { useStoredState } from '@/hooks/use-stored-state';
import { useFlag } from '@/lib/feature-flags';
import type { Gs1Result } from '@/lib/gs1/parse-gs1';
import { isOfflineError, isRefused } from '@/lib/http';
import { formatIsolatedList } from '@/lib/isolate-values';
import type { DeviceSnapshot } from '@/lib/local-data';
import { useOnline } from '@/lib/online';
import { revealField } from '@/lib/reveal-field';
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
  deviceDisplay: StockEventDisplay;
  onSubmitted: (eventId: string, synced?: boolean) => void | Promise<void>;
};
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
  deviceDisplay,
}: Props) {
  const { t, i18n } = useTranslation();
  const config: EventKindConfig = EVENT_KINDS[kind];
  const online = useOnline();
  const queryClient = useQueryClient();
  const today = toDateValue(new Date());
  const { products } = config;
  const fromCards = products.from === 'stock-cards';
  const filterCards = useCallback(
    (cards: readonly EventStockCard[]) =>
      products.from === 'stock-cards' ? products.cardFilter(cards, today) : [],
    [products, today],
  );
  const bundleScope = homeStockDataset(config)
    ? homeStockScope({ facilityId, programId }, facilityTypeId)
    : undefined;
  const receiveScope = receiveDevice({ facilityId, programId }, facilityTypeId, online);
  const device = bundleScope && receiveCatalogDataset(config) ? receiveScope : undefined;
  const stockOptions = eventStockCardsOptions({ facilityId, programId }, bundleScope);
  const validOptions = eventValidReasonsOptions(
    { program: programId, facilityType: facilityTypeId },
    bundleScope,
  );
  const needsKitContents = config.contents.type === 'kit';
  const reasonOptions = needsKitContents ? reasonsOptions() : validOptions;
  const reasonsQuery = useQuery({
    ...validOptions,
    enabled: canViewStock && !needsKitContents && config.reasons !== null,
  });
  const reasons = useMemo(
    () => (reasonsQuery.data && config.reasons ? config.reasons(reasonsQuery.data) : EMPTY_LOOKUP),
    [reasonsQuery.data, config],
  );
  const kitReasonsQuery = useQuery({
    ...reasonsOptions(),
    enabled: canViewStock && needsKitContents,
  });
  const kitReasons = unpackReasons(kitReasonsQuery.data, kitUnpackReasonIds ?? {});
  const side = config.counterparty;
  const needsCounterparty = side !== 'none';
  const assignmentOptions = counterpartyOptions(
    needsCounterparty ? side : 'destination',
    { programId, facilityId },
    bundleScope,
  );
  const counterpartyQuery = useQuery({
    ...assignmentOptions,
    enabled: canViewStock && needsCounterparty,
  });
  const assignments = counterpartyQuery.data ?? EMPTY_LOOKUP;
  const lookupsReady =
    (config.reasons === null || reasonsQuery.data !== undefined) &&
    (!needsKitContents || kitReasons.ok) &&
    (!needsCounterparty || (counterpartyQuery.data !== undefined && assignments.length > 0));
  const cardsQuery = useQuery({
    ...stockOptions,
    enabled: canViewStock && (fromCards || !!bundleScope),
  });
  const snapshotOnline = useSnapshotNotice(
    !!cardsQuery.data?.device,
    cardsQuery.isFetching,
    Math.max(cardsQuery.dataUpdatedAt, cardsQuery.errorUpdatedAt),
  );
  const approvedQuery = useQuery({
    ...receiveApprovedProductsOptions(queryClient, { facilityId, programId }, '', 0, receiveScope),
    enabled: canViewStock && !!device,
  });
  const offeredCards = useMemo(
    () => filterCards(cardsQuery.data?.cards ?? []),
    [cardsQuery.data, filterCards],
  );
  const reasonRequired = eventReasonRequired(kind, reasons, defaultReasonId);
  const quantityUnit = useQuantityUnit();
  const scanning = useFlag('GS1_SCANNING') && config.scanning;
  const navigate = useNavigate();
  const [refusal, setRefusal] = useState<StockEventSyncError | null>(null);
  const [reviewRefusal, setReviewRefusal] = useState(false);
  const correction = useSessionMutation({
    mutationFn: async () =>
      refusal ? copyRefusedEvent(createStockEventContext(refusal.event), refusal) : undefined,
    retry: false,
  });
  const correctRefusal = async () => {
    try {
      const copy = await correction.mutateAsync();
      if (!correction.isCurrent()) return;
      if (!copy) {
        toast.warning(t('offline-events.changed-title'), {
          description: t('offline-events.changed-description'),
        });
        return;
      }
      setFailure(null);
      setRefusal(null);
      posting.current = false;
      draft.reload();
    } catch {
      if (correction.isCurrent())
        toast.error(t('offline-events.action-failed'), {
          description: t('offline-events.action-failed-description'),
        });
    }
  };
  const [submitted, setSubmitted] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<EventLine | null>(null);
  const [editLotOpen, setEditLotOpen] = useState(false);
  const editLot = useCallback((line: EventLine) => {
    setEditingLot(line);
    setEditLotOpen(true);
  }, []);
  const [failure, setFailure] = useState<{
    title: ParseKeys;
    description: string;
  } | null>(null);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const alertTarget = useRef<{ name: string; page: number } | null>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const correctionButton = useRef<HTMLButtonElement>(null);
  const [focusField, setFocusField] = useState<{ name: string; page: number } | null>(null);
  const confirming = useRef(false);
  confirming.current = confirmationOpen;
  const lastAdded = useRef<ReturnType<typeof newEventLine> | undefined>(undefined);
  const leaving = useRef(false);
  const posting = useRef(false);
  const region = useRef<HTMLDivElement>(null);
  const { measure, width, cards } = useCardLayout<HTMLDivElement>();
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
    if (issue.message === 'stock-events.draft-stock-invalid')
      setFailure({
        title: config.copy.invalidTitle,
        description: t('stock-events.draft-stock-invalid'),
      });
    setValidationOpen(true);
  };
  const lines = useStore(form.store, (state) => state.values.lines);
  const submission = useDeviceSubmission({
    kind,
    facilityId,
    programId,
    canViewStock,
    form,
    cards: cardsQuery.data?.cards,
    today,
    stockOptions,
    deviceDisplay,
    reasons,
    assignments,
  });
  const { draft, mutation } = submission;
  const drafts = useDeviceDrafts({
    config,
    draft,
    form,
    canViewStock,
    ready: lookupsReady,
    cardsLoaded: cardsQuery.data !== undefined,
    pending: refreshing || mutation.isPending,
    submitted,
    leaving,
    online,
    isCurrent: mutation.isCurrent,
    onCleared: () => setUnknownOutcome(false),
  });
  const { pending, ready } = drafts;
  const locked = pending || submitted || !!refusal;
  const hasLots =
    !fromCards ||
    cardsQuery.data === undefined ||
    offeredCards.some((card) => !!card.lot) ||
    lines.some((line) => !!line.lot);
  const hasVVM =
    offeredCards.some((card) => card.orderable.extraData?.useVVM === 'true') ||
    (!!device &&
      !!approvedQuery.data?.content.some(
        ({ orderable }) => orderable.extraData?.useVVM === 'true',
      )) ||
    lines.some((line) => line.useVVM);
  const hideableColumns = eventHideableColumns(kind);
  const fitColumns = useMemo(
    () =>
      eventFitColumns(kind).filter(
        ({ id }) =>
          (id !== 'total' || quantityUnit.unit === 'PACKS') && (id !== 'expiry' || hasLots),
      ),
    [kind, quantityUnit.unit, hasLots],
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
    cards ? undefined : width,
    fitContent,
    measured && !cards,
    lines.length > 0 && filtered.length === 0,
  );
  const clearFilter = () => onSearchChange({ keyword: undefined, page: undefined }, true);
  useEffect(() => {
    if (!focusField || search.keyword || (search.page ?? 1) !== focusField.page) return;
    const target = document.getElementById(focusField.name);
    if (target && region.current?.contains(target)) {
      revealField(target, cards);
      setFocusField(null);
    }
  }, [focusField, search.keyword, search.page, cards]);
  const add = (candidate: EventLineCandidate, hasLotsOfProduct: boolean) => {
    if (!ready || submitted || refusal || pending) return;
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
  const validateAndSubmit = async () => {
    await form.validate('submit');
    if (mutation.isCurrent()) await form.handleSubmit();
  };
  const submit = async () => {
    if (!mutation.isCurrent()) return;
    const saved = await submission.flush();
    if (!mutation.isCurrent()) return;
    if (!saved) {
      setFailure({
        title: 'stock-events.draft-save-error-title',
        description: t('stock-events.draft-failed'),
      });
      return;
    }
    if (config.contents.type !== 'kit') {
      void validateAndSubmit();
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
      const refreshed = refreshKitContents(currentLines, fresh);
      form.setFieldValue('lines', refreshed.lines);
      if (refreshed.changed.length) {
        setFailure({
          title: config.contents.copy.contentsChangedTitle,
          description: t(config.contents.copy.contentsChangedDescription, {
            kits: formatIsolatedList(
              refreshed.changed.map((kit) => kit.fullProductName || kit.productCode),
              i18n.resolvedLanguage ?? i18n.language,
            ),
          }),
        });
        queryClient.invalidateQueries({
          queryKey: stockOptions.queryKey,
          exact: true,
        });
        return;
      }
      await validateAndSubmit();
    } catch (error) {
      if (!mutation.isCurrent()) return;
      setFailure({
        title: config.copy.submitErrorTitle,
        description: isOfflineError(error)
          ? t(config.contents.copy.refreshOffline)
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
    const hadUnknownOutcome = unknownOutcome;
    setFailure(null);
    setUnknownOutcome(false);
    let eventId: string;
    let synced = false;
    let delivery: StockEventDelivery | undefined;
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
      const result = await mutation.mutateAsync(payload);
      eventId = result.eventId;
      synced = result.synced;
      delivery = result.delivery;
    } catch (error) {
      if (!mutation.isCurrent()) return;
      const failure = submission.failure(error, hadUnknownOutcome);
      setFailure(failure.alert);
      setUnknownOutcome(failure.unknown);
      setConfirmationOpen(false);
      posting.current = false;
      setRefreshing(false);
      return;
    }
    if (!mutation.isCurrent()) return;
    if (delivery?.kind === 'refused') {
      setRefusal(delivery.error);
      setFailure({
        title: config.copy.submitErrorTitle,
        description: refusalMessage(delivery.error, t),
      });
      setConfirmationOpen(false);
      posting.current = false;
      setRefreshing(false);
      return;
    }
    flushSync(() => setSubmitted(true));
    setConfirmationOpen(false);
    leaving.current = true;
    setRefreshing(false);
    submission.notify(payload, synced, delivery);
    if (!drafts.leaveIfAsked()) await submission.complete(eventId, synced, onSubmitted);
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
    if (!ready || submitted || refusal || pending) return;
    if (!parsed.ok) return scanMessage(parsed.error);
    const stale = () => signal.aborted || confirming.current || !mutation.isCurrent();
    if (stale()) return;
    let tradeItem: TradeItem | null;
    let offline = false;
    try {
      const lookup = device
        ? fetchReceiveTradeItem(queryClient, device, parsed.gtin)
        : bundleScope
          ? fetchHomeStockTradeItem(queryClient, bundleScope, parsed.gtin)
          : undefined;
      if (lookup) {
        const result = await lookup;
        if (stale()) return;
        if (result.offline && !result.tradeItem)
          return scanMessage(device ? 'productNotInProgram' : 'productNotOnScreen', {
            gtin: parsed.gtin,
          });
        tradeItem = result.tradeItem;
        offline = result.offline;
      } else {
        tradeItem = await queryClient.fetchQuery(tradeItemByGtinOptions(parsed.gtin));
      }
    } catch {
      return stale() ? undefined : scanMessage('gtinLookupFailed');
    }
    if (stale()) return;
    if (!tradeItem) return scanMessage('gtinNotRegistered', { gtin: parsed.gtin });
    let scanProducts: readonly ScanProduct<EventStockCard>[];
    let hasLotsOf: (orderableId: string) => boolean;
    if (products.from === 'stock-cards') {
      const cards = queryClient.getQueryData(stockOptions.queryKey);
      if (!cards) return { key: 'scan.not-resolved' };
      const offered = filterCards(cards.cards);
      scanProducts = eventProductOptions(offered);
      hasLotsOf = (orderableId) => productHasLots(offered, orderableId);
    } else {
      let found: ApprovedScanProduct;
      try {
        found =
          offline && device
            ? await catalogScanProduct(queryClient, device, tradeItem.id)
            : await approvedScanProduct(
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
    let deviceLots: NewLot[] = [];
    if (config.newLots === 'manual-and-scan') {
      try {
        deviceLots = await queryClient.fetchQuery(deviceNewLotsOptions());
      } catch {
        return stale() ? undefined : scanMessage('gtinLookupFailed');
      }
      if (stale()) return;
    }
    const resolution = resolveScan({
      scan: parsed,
      deviceLots,
      tradeItemId: tradeItem.id,
      products: scanProducts,
      lines: form.state.values.lines,
      policy:
        config.newLots === 'manual-and-scan'
          ? { allowsNewLot: true, today }
          : { allowsNewLot: false },
    });
    if (resolution.type === 'refuse')
      return scanMessage(
        resolution.reason,
        resolution.reason === 'lotCodeQueued'
          ? {
              expiry: resolution.params.expiry
                ? formatDateValue(resolution.params.expiry, i18n.language)
                : '',
            }
          : resolution.params,
      );
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
      !refusal &&
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
    <EventLineTableSkeleton
      cards={cards}
      kind={kind}
      unit={quantityUnit.unit}
      columnVisibility={visibility}
    />
  );
  return (
    <>
      <Workspace width={config.width}>
        {children}
        <WorkspaceContent>
          <div className="flex min-w-0 flex-col gap-4" ref={measureRegion}>
            {cardsQuery.data?.device && snapshotOnline !== undefined && (
              <Suspense fallback={null}>
                {device ? (
                  <CatalogSnapshotAlert
                    snapshot={cardsQuery.data.device}
                    device={device}
                    online={snapshotOnline}
                  />
                ) : (
                  <SnapshotAlert
                    snapshot={cardsQuery.data.device}
                    message="stock-events.offline-snapshot"
                    online={snapshotOnline}
                  />
                )}
              </Suspense>
            )}
            {refusal && (
              <Alert variant="destructive" role="note">
                <AlertTitle>{t(config.copy.submitErrorTitle)}</AlertTitle>
                <AlertDescription>
                  {refusalMessage(refusal, t)}
                  <Button
                    ref={correctionButton}
                    variant="outline"
                    onClick={() => setReviewRefusal(true)}
                  >
                    {t('offline-events.copy')}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <form
              className="flex min-w-0 flex-col gap-4"
              id={config.formId}
              noValidate
              onSubmit={async (event) => {
                event.preventDefault();
                if (lines.length && ready && !submitted && !refusal && !pending) void submit();
              }}
            >
              {canViewStock && (
                <QueryBoundary
                  resetKey={`${facilityId}/${programId}`}
                  pendingFallback={
                    <ProductLotPickerSkeleton
                      kind={kind}
                      programId={programId}
                      canManageLots={canManageLots}
                    />
                  }
                  errorComponent={StockCardsError}
                >
                  <ProductLotPicker
                    bundleScope={bundleScope}
                    kind={kind}
                    facilityId={facilityId}
                    programId={programId}
                    disabled={locked || !ready}
                    {...(fromCards || !device
                      ? { cardFilter: filterCards }
                      : {
                          from: 'approved-products' as const,
                          canManageLots,
                          lines,
                          device,
                          cards,
                        })}
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
              {config.contents.type === 'kit' &&
                kitReasonsQuery.data !== undefined &&
                !kitReasons.ok && (
                  <ErrorAlert
                    title={t(config.contents.copy.notSetUpTitle)}
                    description={t(config.contents.copy.notSetUpDescription, {
                      setting: kitReasons.setting,
                    })}
                  />
                )}
              <DataTableToolbar>
                <fieldset className="w-full @2xl/main:me-auto @2xl/main:w-72" disabled={pending}>
                  <DataTableSearch
                    size="lg"
                    value={keyword}
                    resetKey={`${search.page ?? 1}/${search.size ?? 10}`}
                    placeholder={t('stock-events.keywords')}
                    onValueChange={(value) =>
                      onSearchChange({ keyword: value.trim() || undefined, page: undefined }, true)
                    }
                  />
                </fieldset>
                <EventLineToolbarActions>
                  {drafts.enabled && (
                    <EventLineToolbarStatus>
                      {(lines.length > 0 || draft.status !== 'saved') && (
                        <DraftStatus
                          labels={{
                            saved: t('stock-events.draft-saved'),
                            saving: t('stock-events.draft-saving'),
                            loading: t('stock-events.draft-loading'),
                            failed: t('stock-events.draft-failed'),
                            retry: t('stock-events.draft-retry'),
                            conflict: t('stock-events.draft-conflict'),
                            conflictTitle: t('stock-events.draft-conflict-title'),
                            conflictDescription: t('stock-events.draft-conflict-description'),
                            copy: t('stock-events.draft-copy'),
                            load: t('stock-events.draft-load'),
                          }}
                          {...draft}
                          onRetry={draft.retry}
                          onResolve={draft.resolve}
                        />
                      )}
                      <EventArchivedCopies
                        kind={kind}
                        facilityId={facilityId}
                        programId={programId}
                        disabled={locked}
                        onRestore={draft.restore}
                      />
                    </EventLineToolbarStatus>
                  )}
                  <EventLineToolbarControls>
                    {quantityUnit.canSwitch && (
                      <div className="min-w-0 flex-1 @2xl/main:flex-none">
                        <QuantityUnitToggle
                          unit={quantityUnit.unit}
                          onUnitChange={quantityUnit.setUnit}
                          disabled={locked}
                        />
                      </div>
                    )}
                    <div
                      className={quantityUnit.canSwitch ? 'shrink-0' : 'flex-1 @2xl/main:flex-none'}
                    >
                      <DataTableViewOptions
                        size="lg"
                        {...columns}
                        layout={cards ? 'cards' : 'table'}
                        columns={hideableColumns
                          .filter(
                            (column) =>
                              (!cards || column.id !== 'productCode') &&
                              (column.id !== 'total' || quantityUnit.unit === 'PACKS') &&
                              (column.id !== 'expiry' || hasLots),
                          )
                          .map((column) => ({ id: column.id, label: t(column.labelKey) }))}
                      />
                    </div>
                  </EventLineToolbarControls>
                </EventLineToolbarActions>
              </DataTableToolbar>
              {!canViewStock ? (
                <DataTableEmpty
                  icon={<ShieldAlertIcon />}
                  title={t('stock-events.no-stock-view-title')}
                  description={t('stock-events.no-stock-view-description')}
                />
              ) : fromCards && cardsQuery.isError && cardsQuery.data === undefined ? (
                <EventLineTableSkeleton
                  cards={cards}
                  kind={kind}
                  unit={quantityUnit.unit}
                  columnVisibility={visibility}
                  busy={false}
                />
              ) : (
                <QueryBoundary
                  resetKey={`${programId}/${facilityTypeId}`}
                  errorComponent={ReasonsError}
                  pendingFallback={tablePending}
                >
                  <ReasonsReady options={reasonOptions}>
                    <StockCardsReady needed={fromCards} options={stockOptions}>
                      <CounterpartyReady
                        pendingFallback={tablePending}
                        side={needsCounterparty ? side : null}
                        facilityId={facilityId}
                        programId={programId}
                        options={assignmentOptions}
                      >
                        <EventLineTable
                          cards={cards}
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
                          disabled={locked}
                          onEditLot={editLot}
                          onRemove={remove}
                          search={search}
                          onSearchChange={onSearchChange}
                          columnVisibility={visibility}
                          onClearFilter={clearFilter}
                        />
                      </CounterpartyReady>
                    </StockCardsReady>
                  </ReasonsReady>
                </QueryBoundary>
              )}
            </form>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width={config.width}>
        <Button
          disabled={!filtered.length || locked}
          onClick={() => setClearOpen(true)}
          size="lg"
          variant="outline"
        >
          {t('stock-events.clear')}
        </Button>
        <Button
          disabled={!lines.length || locked || !ready}
          ref={submitButton}
          form={config.formId}
          size="lg"
          type="submit"
        >
          {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t(drafts.submitLabel)}
        </Button>
      </WorkspaceFooter>
      <InvalidSubmitDialog
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
        size={refusal ? 'lg' : 'default'}
        finalFocus={alertTarget.current ? false : refusal ? correctionButton : submitButton}
        title={t(failure?.title ?? config.copy.invalidTitle)}
        description={
          <>
            {failure?.description ?? t(config.copy.invalidDescription)}
            {refusal && <span className="block pt-2">{t('offline-events.copy-warning')}</span>}
          </>
        }
        closeLabel={t('dialog.close')}
        pending={pending}
      >
        <div className={refusal ? '@container w-full' : 'contents'}>
          <div
            className={refusal ? 'flex flex-col gap-2 @sm:flex-row @sm:justify-end' : 'contents'}
          >
            {refusal && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    void navigate({ to: '/offline-events', search: { tab: 'errors' } })
                  }
                >
                  {t('offline-events.review')}
                </Button>
                <Button disabled={correction.isPending} onClick={() => void correctRefusal()}>
                  {t('offline-events.copy')}
                </Button>
              </>
            )}
            <AlertDialogCancel disabled={pending}>{t('dialog.close')}</AlertDialogCancel>
          </div>
        </div>
      </InvalidSubmitDialog>
      {refusal && reviewRefusal && (
        <QueryBoundary
          resetKey={refusal.localEventId}
          pendingFallback={null}
          errorComponent={({ error, reset }) => (
            <LoadError
              error={error}
              reset={reset}
              title={t('offline-events.error-title')}
              description={t('offline-events.error-description')}
            />
          )}
        >
          <RefusalRecovery
            event={{ ...refusal.event, status: 'refused', error: refusal }}
            canView={canViewStock}
            canSend
            onClose={() => setReviewRefusal(false)}
            onCopied={() => {
              setReviewRefusal(false);
              setRefusal(null);
              posting.current = false;
              draft.reload();
            }}
          />
        </QueryBoundary>
      )}
      {device && editingLot && isNewLot(editingLot.lot) && (
        <EditLotDialog
          device={device}
          open={editLotOpen}
          onOpenChange={setEditLotOpen}
          lot={editingLot.lot}
          lineKey={editingLot.key}
          product={productLabel(editingLot.orderable)}
          lines={lines}
          today={today}
          onSave={(next) =>
            form.setFieldValue('lines', (current) => changeEventLot(current, editingLot.key, next))
          }
        />
      )}
      <ClearLinesDialog
        kind={kind}
        open={clearOpen}
        onOpenChange={setClearOpen}
        restoreFocus={() => region.current?.querySelector<HTMLInputElement>('[role="combobox"]')}
        count={filtered.length}
        onClear={() => {
          const keys = new Set(filtered.map((line) => line.key));
          void drafts.clear(keys);
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
          finalFocus={submitButton}
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
      <DiscardChangesDialog {...drafts.dialog} />
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
  options,
  children,
}: {
  options: ReturnType<typeof reasonsOptions> | ReturnType<typeof eventValidReasonsOptions>;
  children: ReactNode;
}) {
  useSuspenseQueries({ queries: [options] });
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
  options,
  children,
}: {
  pendingFallback: ReactNode;
  side: CounterpartySide | null;
  facilityId: string;
  programId: string;
  options: ReturnType<typeof counterpartyOptions>;
  children: ReactNode;
}) {
  if (!side) return children;
  return (
    <QueryBoundary
      resetKey={`${programId}/${facilityId}`}
      pendingFallback={pendingFallback}
      errorComponent={COUNTERPARTY_ERRORS[side]}
    >
      <CounterpartyLookup side={side} options={options}>
        {children}
      </CounterpartyLookup>
    </QueryBoundary>
  );
}

function CounterpartyLookup({
  side,
  options,
  children,
}: {
  side: CounterpartySide;
  options: ReturnType<typeof counterpartyOptions>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(options);
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
  options,
  children,
}: {
  needed: boolean;
  options: ReturnType<typeof eventStockCardsOptions>;
  children: ReactNode;
}) {
  if (!needed) return children;
  return <StockCardsLookup options={options}>{children}</StockCardsLookup>;
}

function StockCardsLookup({
  options,
  children,
}: {
  options: ReturnType<typeof eventStockCardsOptions>;
  children: ReactNode;
}) {
  useSuspenseQuery(options);
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

function RefusalRecovery(props: ComponentProps<typeof DeviceEventRecovery>) {
  const timeZone = useDeploymentTimeZone();
  return <DeviceEventRecovery {...props} timeZone={timeZone} />;
}

function CatalogSnapshotAlert({
  snapshot,
  device,
  online,
}: {
  snapshot: DeviceSnapshot;
  device: ReceiveDevice;
  online: boolean;
}) {
  const { data: catalog } = useQuery(receiveCatalogOptions(device));
  return (
    <SnapshotAlert
      snapshot={{
        ...snapshot,
        fetchedAt: Math.min(snapshot.fetchedAt, catalog?.fetchedAt ?? snapshot.fetchedAt),
      }}
      message="stock-events.offline-snapshot"
      online={online}
    />
  );
}
