import {
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ParseKeys, TFunction } from 'i18next';
import { PackageIcon, PlusIcon } from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorAlert, RetryButton } from '@/components/dialog-parts';
import { formatDateValue, toDateValue } from '@/components/form/date-value';
import { DatePicker, FieldLabelText } from '@/components/form/form-fields';
import { PickerAdd, PickerAddButton, PickerAddField, PickerAddIcon } from '@/components/picker-add';
import { ScanStatus } from '@/components/scan-status';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from '@/components/ui/combobox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import {
  deviceNewLotsOptions,
  eventStockCardsOptions,
  type ReceiveDevice,
  receiveApprovedProductsOptions,
  receiveFulfilsOptions,
  receiveLotsOptions,
  receiveOrderablesOptions,
  receiveStockOnHandOptions,
} from '@/features/stock-events/api/queries';
import type { EventLine, EventLineCandidate } from '@/features/stock-events/lib/event-form';
import { type ConfiguredEventKind, EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import type { HomeStockScope } from '@/features/stock-events/lib/home-stock-bundle';
import { type NewLotValues, newLotSchema } from '@/features/stock-events/lib/new-lot';
import {
  rememberedPickerLayout,
  rememberPickerLayout,
} from '@/features/stock-events/lib/picker-layout';
import {
  ADD_NEW_LOT,
  type ApprovedProductOption,
  approvedProductOptions,
  type EventCardFilter,
  type EventLotOption,
  eventLotOptions,
  eventProductOptions,
  type ReceiveLotOption,
  receiveLotOptions,
} from '@/features/stock-events/lib/products';
import type { EventStockCardsFilter } from '@/features/stock-events/lib/types';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useFlag } from '@/lib/feature-flags';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { conflictingDeviceLot } from '@/lib/lot-code';
import { productSearchStatus } from '@/lib/product-search-status';

type BaseProps = EventStockCardsFilter & {
  kind: ConfiguredEventKind;
  children?: ReactNode;
  disabled: boolean;
  bundleScope?: HomeStockScope;
  onAdd: (candidate: EventLineCandidate, productHasLots: boolean) => void;
};

type Props = BaseProps &
  (
    | { from?: 'stock-cards'; cardFilter: EventCardFilter }
    | {
        from: 'approved-products';
        device: ReceiveDevice;
        canManageLots: boolean;
        lines: readonly Pick<EventLine, 'key' | 'lot'>[];
      }
  );

export function ProductLotPicker(props: Props) {
  if (props.from === 'approved-products') return <ApprovedProductLotPicker {...props} />;
  return <StockCardLotPicker {...props} />;
}

function useLotLabel() {
  const { t, i18n } = useTranslation();
  return (item: EventLotOption | ReceiveLotOption) => (
    <span className="flex min-w-0 items-center gap-1">
      <bdi>{item.labelKey ? t(item.labelKey) : item.label}</bdi>
      {item.lot?.expirationDate && (
        <>
          <span>/</span>
          <bdi>{formatDateValue(item.lot.expirationDate, i18n.language)}</bdi>
        </>
      )}
    </span>
  );
}

function lotItemLabel(
  item: EventLotOption | ReceiveLotOption,
  t: TFunction,
  language: string,
): string {
  if (item.labelKey) return t(item.labelKey);
  return item.lot?.expirationDate
    ? `${item.label} / ${formatDateValue(item.lot.expirationDate, language)}`
    : item.label;
}

function StockCardLotPicker({
  kind,
  facilityId,
  programId,
  onAdd,
  disabled,
  children,
  cardFilter,
  bundleScope,
}: BaseProps & { cardFilter: EventCardFilter }) {
  const { t, i18n } = useTranslation();
  const lotLabel = useLotLabel();
  const copy = EVENT_KINDS[kind].copy;
  const id = useId();
  const {
    data: { cards },
  } = useSuspenseQuery(eventStockCardsOptions({ facilityId, programId }, bundleScope));
  const products = useMemo(() => eventProductOptions(cardFilter(cards)), [cards, cardFilter]);
  const [productId, setProductId] = useState<string | null>(null);
  const [lotId, setLotId] = useState<string | null>(null);
  const selectedProductId = products.length === 1 ? products[0].value : productId;
  const product = products.find((item) => item.value === selectedProductId);
  if (selectedProductId !== productId) {
    setProductId(selectedProductId);
    setLotId(null);
  }
  const lots = eventLotOptions(product?.cards ?? []);
  const lotItems = lots.map((item) => ({
    value: item.value,
    label: lotItemLabel(item, t, i18n.language),
  }));
  const selectedLotId = lots.length === 1 ? lots[0].value : lotId;
  if (lots.length === 1 && selectedLotId !== lotId) setLotId(selectedLotId);
  const pickedLot = lots.find((item) => item.value === selectedLotId);
  const pickedCard = pickedLot?.card;
  const joined = !products.some((item) => item.cards.some((card) => card.lot !== null));
  useEffect(() => {
    rememberPickerLayout(kind, programId, joined ? 'joined' : 'labelled');
  }, [kind, programId, joined]);
  const add = () =>
    pickedCard &&
    product &&
    onAdd(
      pickedCard,
      product.cards.some((card) => !!card.lot),
    );
  const field = useRef<HTMLDivElement>(null);
  const productCombobox = (input: ReactNode, anchor?: RefObject<HTMLDivElement | null>) => (
    <Combobox
      items={products}
      itemToStringLabel={(item) => item.label}
      value={product ?? null}
      onValueChange={(item) => {
        setProductId(item?.value ?? null);
        setLotId(null);
      }}
      disabled={disabled}
    >
      {input}
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>
          {t(products.length === 0 ? copy.noProducts : 'stock-events.no-matches-title')}
        </ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              <bdi>{item.label}</bdi>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
  if (joined) {
    return (
      <PickerPanel status={children}>
        <PickerAdd>
          {productCombobox(
            <PickerAddField ref={field}>
              <ComboboxInput
                size="lg"
                id={`${id}-product`}
                aria-required="true"
                aria-label={t(copy.product)}
                dir="auto"
                placeholder={t(copy.productPlaceholder)}
                width="full"
              >
                <PickerAddIcon>
                  <PackageIcon />
                </PickerAddIcon>
              </ComboboxInput>
            </PickerAddField>,
            field,
          )}
          <PickerAddButton data-add-product="" disabled={disabled || !pickedCard} onClick={add}>
            {t('stock-events.add')}
          </PickerAddButton>
        </PickerAdd>
      </PickerPanel>
    );
  }
  return (
    <PickerPanel status={children}>
      <div className="min-w-0 flex-1 @3xl/main:max-w-96">
        <Field spacing="tight">
          <FieldLabel htmlFor={`${id}-product`}>
            <FieldLabelText label={t(copy.product)} required />
          </FieldLabel>
          {productCombobox(
            <ComboboxInput
              size="lg"
              id={`${id}-product`}
              aria-required="true"
              aria-label={t(copy.product)}
              dir="auto"
              placeholder={t(copy.product)}
              width="full"
            />,
          )}
        </Field>
      </div>
      {product?.cards.some((card) => card.lot !== null) && (
        <div className="min-w-0 flex-1 @3xl/main:max-w-96">
          <Field spacing="tight">
            <FieldLabel htmlFor={`${id}-lot`}>
              <FieldLabelText label={t('stock-events.lot-code')} required />
            </FieldLabel>
            <Select
              items={lotItems}
              value={selectedLotId}
              disabled={disabled}
              onValueChange={setLotId}
            >
              <SelectTrigger
                size="lg"
                id={`${id}-lot`}
                aria-required="true"
                aria-label={t('stock-events.lot-code')}
                width="full"
              >
                <SelectValue placeholder={t('stock-events.lot-code')}>
                  {pickedLot ? lotLabel(pickedLot) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {lots.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {lotLabel(item)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
      <div className="@3xl/main:w-auto">
        <Button
          size="lg"
          width="full"
          data-add-product=""
          disabled={disabled || !pickedCard}
          onClick={add}
          type="button"
        >
          <PlusIcon data-icon="inline-start" />
          {t('stock-events.add')}
        </Button>
      </div>
    </PickerPanel>
  );
}

const PICK_STALE_TIME = 60_000;
const SEARCH_DELAY = 300;
const SHOW_MORE = 'show-more';

type ShowMoreItem = { value: typeof SHOW_MORE; label: string; showMore: true };
type ProductItem = ApprovedProductOption | ShowMoreItem;

const isShowMore = (item: ProductItem | null): item is ShowMoreItem => !!item && 'showMore' in item;

type NewLotField = keyof NewLotValues;

function ApprovedProductLotPicker({
  kind,
  facilityId,
  programId,
  onAdd,
  disabled,
  children,
  canManageLots,
  lines,
  device,
}: BaseProps & {
  device: ReceiveDevice;
  canManageLots: boolean;
  lines: readonly Pick<EventLine, 'key' | 'lot'>[];
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const deviceLots = useQuery(deviceNewLotsOptions()).data;
  const id = useId();
  const lotLabel = useLotLabel();
  const today = toDateValue(new Date());
  const filter = { facilityId, programId };
  const [typed, setTyped] = useState('');
  const query = useDebouncedValue(typed.trim(), SEARCH_DELAY);
  const [more, setMore] = useState({ query: '', pages: 1 });
  const pages = more.query === query ? more.pages : 1;
  const first = useQuery({
    ...receiveApprovedProductsOptions(queryClient, filter, query, 0, device),
    throwOnError: (error) => error instanceof LocalDataUnavailableError,
    placeholderData: keepPreviousData,
  });
  const next = useQueries({
    queries: Array.from({ length: pages - 1 }, (_, index) =>
      receiveApprovedProductsOptions(queryClient, filter, query, index + 1, device),
    ),
  });
  const fulfils = useQuery(receiveFulfilsOptions(queryClient, filter, device));
  const fulfillingIds = useMemo(
    () => [
      ...new Set(Object.values(fulfils.data ?? {}).flatMap((item) => item.canFulfillForMe ?? [])),
    ],
    [fulfils.data],
  );
  const fulfilling = useQuery({
    ...receiveOrderablesOptions(queryClient, fulfillingIds, device),
    enabled: fulfillingIds.length > 0,
  });
  const approved = [
    ...(first.data?.content ?? []),
    ...next.flatMap((page) => page.data?.content ?? []),
  ];
  const total = first.data?.totalElements ?? 0;
  const options = approvedProductOptions(approved, fulfils.data, fulfilling.data ?? [], query);
  const pageOf = new Map(
    [first, ...next].flatMap((page, index) =>
      (page.data?.content ?? []).map(({ orderable }) => [orderable.id, index] as const),
    ),
  );
  const pageProducts: ApprovedProductOption[][] = [first, ...next].map(() => []);
  for (const item of options) pageProducts[pageOf.get(item.approvedId) ?? -1]?.push(item);
  const pageStock = useQueries({
    queries: [first, ...next].map((page) => {
      const orderableIds = (page.data?.content ?? []).map(({ orderable }) => orderable.id);
      return {
        ...receiveStockOnHandOptions(
          queryClient,
          {
            facilityId,
            programId,
            orderableIds: orderableIds.toSorted(),
          },
          device,
        ),
        enabled: orderableIds.length > 0,
      };
    }),
  });
  const pageLots = useQueries({
    queries: pageProducts.map((items) => {
      const tradeItemIds = [
        ...new Set(items.flatMap((item) => item.orderable.identifiers?.tradeItem ?? [])),
      ].toSorted();
      return {
        ...receiveLotsOptions(queryClient, tradeItemIds, device),
        enabled: tradeItemIds.length > 0,
        placeholderData: keepPreviousData,
      };
    }),
  });
  const [product, setProduct] = useState<ApprovedProductOption | null>(null);
  const [lotValue, setLotValue] = useState<string | null>(null);
  const [draft, setDraft] = useState({ lotCode: '', expirationDate: '' });
  const [attempted, setAttempted] = useState(false);
  const [solePicked, setSolePicked] = useState(false);
  const sole =
    !query && !first.isPlaceholderData && total === 1 && approved.length === 1
      ? options.find((item) => item.value === approved[0].orderable.id)
      : undefined;
  if (sole && !solePicked) {
    setSolePicked(true);
    setProduct(sole);
  }
  const searching = typed.trim() !== query || first.isFetching;
  const loadingMore = next.some((page) => page.isPending || (page.isError && page.isFetching));
  const failedPage = next.find((page) => page.isError && !page.isFetching);
  const items: ProductItem[] = [
    ...(product && !options.some((item) => item.value === product.value) ? [product] : []),
    ...options,
    ...(first.data && !searching && approved.length < total
      ? [{ value: SHOW_MORE, label: t('stock-events.show-more'), showMore: true } as const]
      : []),
  ];
  const status =
    first.data && !searching
      ? productSearchStatus({ listed: approved.length, total, typed: query !== '' })
      : undefined;

  const tradeItemId = product?.orderable.identifiers?.tradeItem;
  const pageIndex = product ? pageOf.get(product.approvedId) : undefined;
  const pageStockQuery = pageIndex === undefined ? undefined : pageStock[pageIndex];
  const pageLotsQuery = pageIndex === undefined || !tradeItemId ? undefined : pageLots[pageIndex];
  const lotsQuery = useQuery({
    ...receiveLotsOptions(queryClient, tradeItemId ? [tradeItemId] : [], device),
    enabled: !!tradeItemId,
    staleTime: PICK_STALE_TIME,
    initialData: pageLotsQuery?.data?.filter((lot) => lot.tradeItemId === tradeItemId),
    initialDataUpdatedAt: pageLotsQuery?.dataUpdatedAt,
  });
  const stockQuery = useQuery({
    ...receiveStockOnHandOptions(
      queryClient,
      {
        facilityId,
        programId,
        orderableIds: product ? [product.approvedId] : [],
      },
      device,
    ),
    enabled: !!product,
    staleTime: PICK_STALE_TIME,
    initialData: pageStockQuery?.data,
    initialDataUpdatedAt: pageStockQuery?.dataUpdatedAt,
  });
  const lotsData = lotsQuery.data;
  const stock = stockQuery.data;
  const lotsFailed = !!tradeItemId && lotsQuery.isError && lotsData === undefined;
  const stockFailed = !!product && stockQuery.isError && stock === undefined;
  const loading = !!product && ((!!tradeItemId && lotsQuery.isPending) || stockQuery.isPending);
  const lots = (tradeItemId && lotsData) || [];
  const lotOptions =
    product && !loading && !lotsFailed && !stockFailed && stock
      ? receiveLotOptions(product, lots, stock, canManageLots)
      : [];
  const selectedLot = lotOptions.length === 1 ? lotOptions[0].value : lotValue;
  const pickedLot = lotOptions.find((item) => item.value === selectedLot);
  const addingNewLot = pickedLot?.value === ADD_NEW_LOT;
  const schema = tradeItemId
    ? newLotSchema({ tradeItemId, lots, lines, today, deviceLots })
    : undefined;
  const errors: Partial<Record<NewLotField, ParseKeys>> = {};
  if (addingNewLot && attempted && schema) {
    for (const issue of schema.safeParse(draft).error?.issues ?? []) {
      const field = issue.path[0] as NewLotField;
      errors[field] ??= issue.message as ParseKeys;
    }
  }
  const queuedLot = tradeItemId
    ? conflictingDeviceLot(deviceLots ?? [], tradeItemId, draft.lotCode, draft.expirationDate)
    : undefined;
  const lotError = (key: ParseKeys) =>
    key === 'stock-events.lot-code-queued'
      ? t(key, {
          expiry: queuedLot?.expirationDate
            ? formatDateValue(queuedLot.expirationDate, i18n.language)
            : t('stock-events.no-expiry'),
        })
      : t(key);
  const lotItems = lotOptions.map((item) => ({
    value: item.value,
    label: lotItemLabel(item, t, i18n.language),
  }));

  const pick = (item: ApprovedProductOption | null) => {
    setProduct(item);
    setLotValue(null);
    setAttempted(false);
    setDraft({ lotCode: '', expirationDate: '' });
  };
  const add = () => {
    if (disabled || !product || !pickedLot) return;
    const productHasLots = lots.length > 0;
    if (pickedLot.card) {
      onAdd(pickedLot.card, productHasLots);
      return;
    }
    setAttempted(true);
    const result = schema ? schema.safeParse(draft) : undefined;
    if (!tradeItemId || !result?.success) {
      const invalid = result?.error?.issues[0]?.path[0];
      document.getElementById(`${id}-${invalid === 'expirationDate' ? 'expiry' : 'code'}`)?.focus();
      return;
    }
    onAdd(
      {
        orderable: product.orderable,
        lot: {
          lotCode: result.data.lotCode,
          expirationDate: result.data.expirationDate || null,
          tradeItemId,
        },
        stockOnHand: 0,
      },
      productHasLots,
    );
  };
  const fulfilsFailed =
    (fulfils.isError && fulfils.data === undefined) ||
    (fulfilling.isError && fulfilling.data === undefined);
  const retryFulfils = () => {
    if (fulfils.isError) void fulfils.refetch();
    if (fulfilling.isError) void fulfilling.refetch();
  };
  const retry = () => {
    if (lotsFailed) void lotsQuery.refetch();
    if (stockFailed) void stockQuery.refetch();
  };

  if (first.data === undefined && first.isPending) return <ProductLotPickerSkeleton kind={kind} />;
  return (
    <PickerPanel
      status={children}
      alert={
        <>
          {first.isError && (
            <ErrorAlert
              title={t('stock-events.products-search-error-title')}
              description={t('stock-events.products-search-error-description')}
              action={<RetryButton onClick={() => void first.refetch()} />}
            />
          )}
          {fulfilsFailed && (
            <ErrorAlert
              title={t('stock-events.fulfils-error-title')}
              description={t('stock-events.fulfils-error-description')}
              action={<RetryButton onClick={retryFulfils} />}
            />
          )}
          {(lotsFailed || stockFailed) && (
            <ErrorAlert
              title={t(
                lotsFailed
                  ? 'stock-events.lots-error-title'
                  : 'stock-events.stock-on-hand-error-title',
              )}
              description={t(
                lotsFailed
                  ? 'stock-events.lots-error-description'
                  : 'stock-events.stock-on-hand-error-description',
              )}
              action={<RetryButton onClick={retry} />}
            />
          )}
        </>
      }
    >
      <div className="min-w-0 flex-1 @3xl/main:max-w-96">
        <Field spacing="tight">
          <FieldLabel htmlFor={`${id}-product`}>
            <FieldLabelText label={t(EVENT_KINDS[kind].copy.product)} required />
          </FieldLabel>
          <Combobox<ProductItem>
            items={items}
            filter={null}
            itemToStringLabel={(item) => item.label}
            isItemEqualToValue={(item, value) => item.value === value.value}
            value={product as ProductItem | null}
            onValueChange={(item, details) => {
              if (isShowMore(item)) {
                details.cancel();
                if (failedPage) void failedPage.refetch();
                else if (!loadingMore) setMore({ query, pages: pages + 1 });
                return;
              }
              pick(item);
            }}
            onInputValueChange={(text, details) =>
              setTyped(details.reason === 'input-change' ? text : '')
            }
            disabled={disabled}
          >
            <ComboboxInput
              size="lg"
              id={`${id}-product`}
              aria-required="true"
              aria-label={t(EVENT_KINDS[kind].copy.product)}
              dir="auto"
              placeholder={t(EVENT_KINDS[kind].copy.product)}
              width="full"
            />
            <ComboboxContent>
              <ComboboxStatus>
                {failedPage
                  ? t('stock-events.show-more-error')
                  : status && t(status.key, { shown: status.shown, count: status.count })}
              </ComboboxStatus>
              <ComboboxEmpty>
                {searching
                  ? t('lots.searching')
                  : first.isError
                    ? t('stock-events.products-search-error-title')
                    : t(
                        !typed.trim() && total === 0
                          ? EVENT_KINDS[kind].copy.noProducts
                          : 'stock-events.no-matches-title',
                      )}
              </ComboboxEmpty>
              <ComboboxList>
                {(item: ProductItem) => (
                  <ComboboxItem key={item.value} value={item}>
                    {isShowMore(item) ? (
                      <span className="text-muted-foreground">
                        {loadingMore
                          ? t('lots.searching')
                          : failedPage
                            ? t('error.try-again')
                            : item.label}
                      </span>
                    ) : (
                      <bdi>{item.label}</bdi>
                    )}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
      </div>
      {lotOptions.length > 1 && (
        <div className="min-w-0 flex-1 @3xl/main:max-w-96">
          <Field spacing="tight">
            <FieldLabel htmlFor={`${id}-lot`}>
              <FieldLabelText label={t('stock-events.lot-code')} required />
            </FieldLabel>
            <Select
              items={lotItems}
              value={selectedLot}
              disabled={disabled}
              onValueChange={setLotValue}
            >
              <SelectTrigger
                size="lg"
                id={`${id}-lot`}
                aria-required="true"
                aria-label={t('stock-events.lot-code')}
                width="full"
              >
                <SelectValue placeholder={t('stock-events.lot-code')}>
                  {pickedLot ? lotLabel(pickedLot) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {lotOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {lotLabel(item)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
      {addingNewLot && (
        <>
          <div className="min-w-0 flex-1 @3xl/main:max-w-96">
            <Field spacing="tight" data-invalid={!!errors.lotCode || undefined}>
              <FieldLabel htmlFor={`${id}-code`}>
                <FieldLabelText label={t('stock-events.new-lot-code')} required />
              </FieldLabel>
              <Input
                controlSize="lg"
                id={`${id}-code`}
                aria-required="true"
                aria-invalid={!!errors.lotCode || undefined}
                aria-describedby={errors.lotCode ? `${id}-code-error` : undefined}
                dir="ltr"
                disabled={disabled}
                value={draft.lotCode}
                onChange={(event) => setDraft({ ...draft, lotCode: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  add();
                }}
              />
              {errors.lotCode && (
                <FieldError id={`${id}-code-error`}>{lotError(errors.lotCode)}</FieldError>
              )}
            </Field>
          </div>
          <div className="min-w-0 flex-1 @3xl/main:max-w-96">
            <Field spacing="tight" data-invalid={!!errors.expirationDate || undefined}>
              <FieldLabel htmlFor={`${id}-expiry`} id={`${id}-expiry-label`}>
                <FieldLabelText label={t('stock-events.expiry-date')} />
              </FieldLabel>
              <DatePicker
                size="lg"
                id={`${id}-expiry`}
                clearLabel={t('stock-events.clear-expiry-date')}
                describedBy={errors.expirationDate ? `${id}-expiry-error` : undefined}
                disabled={disabled}
                earliest={today}
                invalid={!!errors.expirationDate || undefined}
                onValueChange={(expirationDate) => setDraft({ ...draft, expirationDate })}
                placeholder={t('stock-events.pick-date')}
                value={draft.expirationDate}
              />
              {errors.expirationDate && (
                <FieldError id={`${id}-expiry-error`}>{t(errors.expirationDate)}</FieldError>
              )}
            </Field>
          </div>
        </>
      )}
      <div className="@3xl/main:w-auto">
        <Button
          size="lg"
          width="full"
          data-add-product=""
          disabled={disabled || !pickedLot || loading}
          onClick={add}
          type="button"
        >
          {loading ? (
            <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          {t('stock-events.add')}
        </Button>
        <p role="status" aria-live="polite" className="sr-only">
          {loading ? t('stock-events.lots-loading') : ''}
        </p>
      </div>
    </PickerPanel>
  );
}

function PickerPanel({
  children,
  status,
  alert,
}: {
  children: ReactNode;
  status?: ReactNode;
  alert?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 @3xl/main:flex-row @3xl/main:items-end">
        {children}
        {status && <div className="@3xl/main:max-w-56 @3xl/main:pb-1.5">{status}</div>}
      </div>
      {alert}
      <Separator />
    </div>
  );
}

export function ProductLotPickerSkeleton({
  kind,
  programId,
}: {
  kind: ConfiguredEventKind;
  programId?: string;
}) {
  const { t } = useTranslation();
  const copy = EVENT_KINDS[kind].copy;
  const scanning = useFlag('GS1_SCANNING') && EVENT_KINDS[kind].scanning;
  const loading = (
    <p role="status" aria-live="polite" className="sr-only">
      {t('stock-events.products-loading')}
    </p>
  );
  if (rememberedPickerLayout(kind, programId) === 'joined') {
    return (
      <PickerPanel status={scanning ? <ScanStatus status="ready" /> : undefined}>
        {loading}
        <PickerAdd>
          <PickerAddField>
            <Combobox disabled>
              <ComboboxInput
                size="lg"
                disabled
                aria-label={t(copy.product)}
                aria-required="true"
                placeholder={t(copy.productPlaceholder)}
                width="full"
              >
                <PickerAddIcon>
                  <PackageIcon />
                </PickerAddIcon>
              </ComboboxInput>
            </Combobox>
          </PickerAddField>
          <PickerAddButton disabled>{t('stock-events.add')}</PickerAddButton>
        </PickerAdd>
      </PickerPanel>
    );
  }
  return (
    <PickerPanel status={scanning ? <ScanStatus status="ready" /> : undefined}>
      {loading}
      <div className="min-w-0 flex-1 @3xl/main:max-w-96">
        <Field spacing="tight">
          <FieldLabel>
            <FieldLabelText label={t(copy.product)} required />
          </FieldLabel>
          <Combobox disabled>
            <ComboboxInput
              size="lg"
              disabled
              aria-label={t(copy.product)}
              aria-required="true"
              placeholder={t(copy.product)}
              width="full"
            />
          </Combobox>
        </Field>
      </div>
      <div className="@3xl/main:w-auto">
        <Button size="lg" width="full" disabled type="button">
          <PlusIcon data-icon="inline-start" />
          {t('stock-events.add')}
        </Button>
      </div>
    </PickerPanel>
  );
}
