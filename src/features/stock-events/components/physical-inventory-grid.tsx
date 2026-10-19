import { useStore } from '@tanstack/react-form';
import type { ColumnVisibilityState } from '@tanstack/react-table';
import { ArchiveXIcon, CircleAlertIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import {
  Fragment,
  memo,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardRows,
  SkeletonBar,
} from '@/components/card-list';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import { DataTablePaginationSkeleton } from '@/components/data-table/data-table-pagination';
import { useFieldContext } from '@/components/form/form-context';
import { HiddenFromView } from '@/components/form/form-fields';
import type { QuantityValue } from '@/components/form/quantity-value';
import { updateQuantityValue } from '@/components/form/quantity-value';
import { SettingsItem, SettingsRowFrame } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, InputSizer } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { productName } from '@/features/reference-data/lib/product-name';
import { ProductName } from '@/features/stock-events/components/product-name';
import type { PhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  inventoryLineError,
  unaccounted,
} from '@/features/stock-events/lib/physical-inventory-form';
import { inventoryFormats } from '@/features/stock-events/lib/physical-inventory-format';
import {
  inventoryExpiry,
  inventoryLotCode,
} from '@/features/stock-events/lib/physical-inventory-lines';
import { canDeactivateInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import type {
  InventoryCategoryBand,
  InventoryLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { productLabel } from '@/features/stock-events/lib/products';
import { vvmItems } from '@/features/stock-events/lib/vvm-items';
import { EMPTY_VALUE, orEmpty, tableValue } from '@/lib/empty-value';
import type { QuantityUnit } from '@/lib/quantity';
import { cn } from '@/lib/utils';
import { toLatinDigits, toOptionalWholeNumber } from '@/lib/whole-number';

const COLUMNS = [
  ['productCode', 'stock-events.product-code'],
  ['product', 'stock-events.product'],
  ['packSize', 'stock-events.pack-size'],
  ['lot', 'stock-events.lot-code'],
  ['expiry', 'stock-events.expiry-date'],
  ['stock', 'stock-events.stock-on-hand'],
  ['count', 'physical-inventory.current-stock'],
  ['vvm', 'stock-events.vvm-status'],
  ['reasons', 'physical-inventory.reasons'],
  ['unaccounted', 'physical-inventory.unaccounted'],
  ['actions', 'stock-events.actions'],
] as const;
const CARD_COLUMNS = new Set([
  'packSize',
  'expiry',
  'stock',
  'count',
  'vvm',
  'reasons',
  'unaccounted',
]);
const CARD_CONTROLS = new Set(['count', 'vvm', 'reasons']);

type ColumnId = (typeof COLUMNS)[number][0];
const HIDEABLE_COLUMN_IDS: readonly ColumnId[] = ['productCode', 'packSize', 'expiry', 'stock'];
export const INVENTORY_HIDEABLE_COLUMNS = COLUMNS.filter(([id]) =>
  HIDEABLE_COLUMN_IDS.includes(id),
).map(([id, labelKey]) => ({ id, labelKey }));
export const INVENTORY_COLUMN_MIN_WIDTHS = {
  productCode: { rem: 6.75, width: 'w-27', content: 'min-w-24' },
  product: { rem: 18.25, width: 'w-73', content: 'min-w-70' },
  packSize: { rem: 4.75, width: 'w-19', content: 'min-w-16' },
  lot: { rem: 7.25, width: 'w-29', content: 'min-w-26' },
  expiry: { rem: 7.25, width: 'w-29', content: 'min-w-26' },
  stock: { rem: 7.25, width: 'w-29', content: 'min-w-26' },
  count: { rem: 7.25, width: 'w-29', content: 'min-w-26' },
  vvm: { rem: 6.75, width: 'w-27', content: 'min-w-24' },
  reasons: { rem: 8.75, width: 'w-35', content: 'min-w-32' },
  unaccounted: { rem: 10.75, width: 'w-43', content: 'min-w-40' },
  actions: { rem: 4.75, width: 'w-19', content: 'min-w-16' },
} satisfies Record<ColumnId, { rem: number; width: string; content: string }>;

const CELL_SLACK = 4;
const UNACCOUNTED_ERROR = 'physical-inventory.unaccounted-error';
const errorsShown = (line: InventoryLine, editor: InventoryGridEditor) =>
  editor.validationAttempted ||
  Boolean(line.quantity.doses.trim() && !editor.unchecked.has(line.key));
const unaccountedInvalid = (line: InventoryLine, editor: InventoryGridEditor) =>
  errorsShown(line, editor) && inventoryLineError(line) === UNACCOUNTED_ERROR;

type InventoryColumnLayout = { showVvm: boolean; showActions: boolean; unit?: QuantityUnit };
const columnMinWidth = (id: ColumnId, unit: QuantityUnit = 'DOSES') =>
  id === 'count' && unit === 'PACKS'
    ? { rem: 9.25, width: 'w-37', content: 'min-w-34' }
    : INVENTORY_COLUMN_MIN_WIDTHS[id];

export function inventoryHideableColumns(
  { showVvm, showActions, unit }: InventoryColumnLayout,
  choices: ColumnVisibilityState = {},
) {
  let required =
    2 +
    COLUMNS.reduce((sum, [id]) => {
      if ((id === 'vvm' && !showVvm) || (id === 'actions' && !showActions)) return sum;
      if (choices[id] === false && INVENTORY_HIDEABLE_COLUMNS.some((column) => column.id === id))
        return sum;
      return sum + columnMinWidth(id, unit).rem * 16 + CELL_SLACK;
    }, 0);
  return INVENTORY_HIDEABLE_COLUMNS.map((column) => {
    const hideBelow = required;
    if (choices[column.id] == null)
      required -= columnMinWidth(column.id, unit).rem * 16 + CELL_SLACK;
    return { ...column, hideBelow };
  });
}

function InventoryColumnContent({
  id,
  unit,
  children,
}: {
  id: ColumnId;
  unit?: QuantityUnit;
  children: ReactNode;
}) {
  return (
    <div className={cn(columnMinWidth(id, unit).content, 'whitespace-nowrap')}>{children}</div>
  );
}

const visibleColumns = (
  visibility: ColumnVisibilityState,
  showVvm: boolean,
  showActions: boolean,
) =>
  COLUMNS.filter(
    ([id]) =>
      (!INVENTORY_HIDEABLE_COLUMNS.some((column) => column.id === id) ||
        visibility[id] !== false) &&
      (id !== 'vvm' || showVvm) &&
      (id !== 'actions' || showActions),
  );

type InventoryGridEditor = {
  form: PhysicalInventoryForm;
  unit: QuantityUnit;
  online: boolean;
  validationAttempted: boolean;
  unchecked: ReadonlySet<string>;
  onCounted: (key: string) => void;
  pending: boolean;
  onReasons: (line: InventoryLine) => void;
  onEditLot: (line: InventoryLine) => void;
  onRemove: (line: InventoryLine) => void;
  onDeactivate: (line: InventoryLine) => void;
};
type Props = {
  editor: InventoryGridEditor;
  bands: readonly InventoryCategoryBand[];
  visibility: ColumnVisibilityState;
  showVvm: boolean;
  showActions: boolean;
  footer?: ReactNode;
  cards?: boolean;
  listRef?: Ref<HTMLUListElement>;
};
export function PhysicalInventoryGrid({
  bands,
  visibility,
  showVvm,
  showActions,
  editor,
  footer,
  cards = false,
  listRef,
}: Props) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => visibleColumns(visibility, showVvm, showActions),
    [visibility, showVvm, showActions],
  );
  if (cards)
    return (
      <CardList listRef={listRef} footer={footer}>
        {bands.map((band) => (
          <Fragment key={band.category}>
            <li>
              <h2 className="px-4 text-muted-foreground text-sm">
                <bdi>{band.category}</bdi>
              </h2>
            </li>
            {band.groups.map((group) => (
              <CardListItem key={group.orderable.id}>
                <CardBand>
                  <bdi className="min-w-0 wrap-anywhere">
                    {productLabel(group.orderable)} ({group.orderable.productCode})
                  </bdi>
                </CardBand>
                {group.lines.map((line) => (
                  <InventoryRow
                    key={line.key}
                    lineKey={line.key}
                    editor={editor}
                    columns={columns}
                    hideProduct
                    cards
                  />
                ))}
                {group.lines.length > 1 && (
                  <InventorySummaryRow
                    editor={editor}
                    lines={group.lines}
                    columns={columns}
                    cards
                  />
                )}
              </CardListItem>
            ))}
          </Fragment>
        ))}
      </CardList>
    );
  return (
    <DataTableCard>
      <Table
        density="compact"
        layout="auto"
        tabIndex={-1}
        aria-label={t('physical-inventory.editor-crumb')}
      >
        <InventoryHead columns={columns} unit={editor.unit} />
        <TableBody>
          {bands.map((band) => (
            <Fragment key={band.category}>
              <TableRow surface="primary">
                <TableCell colSpan={columns.length}>
                  <div className="ps-6">
                    <bdi>{band.category}</bdi>
                  </div>
                </TableCell>
              </TableRow>
              {band.groups.map((group) => (
                <Fragment key={group.orderable.id}>
                  {group.lines.length > 1 ? (
                    <InventorySummaryRow editor={editor} lines={group.lines} columns={columns} />
                  ) : null}
                  {group.lines.map((line) => (
                    <InventoryRow
                      key={line.key}
                      lineKey={line.key}
                      editor={editor}
                      columns={columns}
                      hideProduct={group.lines.length > 1}
                    />
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      {footer}
    </DataTableCard>
  );
}

function InventoryHead({
  columns,
  unit,
}: {
  columns: readonly (typeof COLUMNS)[number][];
  unit: QuantityUnit;
}) {
  const { t } = useTranslation();
  return (
    <>
      <colgroup>
        {columns.map(([id]) => (
          <col key={id} className={columnMinWidth(id, unit).width} />
        ))}
      </colgroup>
      <TableHeader surface="muted">
        <TableRow>
          {columns.map(([id, key]) => (
            <TableHead key={id} data-inventory-column={id}>
              <InventoryColumnContent id={id} unit={unit}>
                <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
                {id === 'count' && (
                  <div
                    aria-hidden
                    className="invisible flex h-0 w-max items-center gap-1 overflow-hidden font-normal"
                    dir="ltr"
                  >
                    <InputSizer
                      placeholder={t(
                        unit === 'PACKS' ? 'quantity-unit.packs' : 'quantity-unit.doses',
                      )}
                    />
                    {unit === 'PACKS' && (
                      <>
                        <span>( +</span>
                        <InputSizer placeholder={t('quantity-unit.doses')} />
                        <span>)</span>
                      </>
                    )}
                  </div>
                )}
                {id === 'vvm' && (
                  <div
                    aria-hidden
                    className="invisible grid h-0 w-max overflow-hidden font-normal text-sm"
                  >
                    {vvmItems(t).map((item) => (
                      <span key={item.value} className="col-start-1 row-start-1 px-6">
                        {item.label}
                      </span>
                    ))}
                  </div>
                )}
              </InventoryColumnContent>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
    </>
  );
}

const InventorySummaryRow = memo(function InventorySummaryRow({
  editor,
  lines,
  columns,
  cards = false,
}: {
  editor: InventoryGridEditor;
  cards?: boolean;
  lines: readonly InventoryLine[];
  columns: readonly (typeof COLUMNS)[number][];
}) {
  const { t } = useTranslation();
  const summary = useStore(
    editor.form.store,
    (state) => lines.map((line) => state.values.lines[line.key]).filter(Boolean),
    (previous, next) =>
      previous.length === next.length && previous.every((line, index) => line === next[index]),
  );
  if (!summary.length) return null;
  if (cards)
    return (
      <>
        <CardBand>{t('physical-inventory.total')}</CardBand>
        <div className="bg-muted/50">
          <CardRows>
            {columns
              .filter(([id]) => id === 'packSize' || id === 'stock' || id === 'count')
              .map(([id, key]) => (
                <SettingsItem key={id} label={t(key)}>
                  <InventoryCell
                    cards
                    id={id}
                    editor={editor}
                    line={summary[0]}
                    summary={summary}
                  />
                </SettingsItem>
              ))}
          </CardRows>
        </div>
      </>
    );
  return (
    <TableRow surface="muted">
      {columns.map(([id]) => (
        <TableCell key={id}>
          <InventoryColumnContent id={id} unit={editor.unit}>
            <InventoryCell id={id} editor={editor} line={summary[0]} summary={summary} />
          </InventoryColumnContent>
        </TableCell>
      ))}
    </TableRow>
  );
});

const InventoryRow = memo(
  function InventoryRow({
    lineKey,
    editor,
    columns,
    hideProduct,
    cards = false,
  }: {
    lineKey: string;
    editor: InventoryGridEditor;
    columns: readonly (typeof COLUMNS)[number][];
    hideProduct: boolean;
    cards?: boolean;
  }) {
    const [countFocused, setCountFocused] = useState(false);
    const line = useStore(editor.form.store, (state) => state.values.lines[lineKey]);
    const { t } = useTranslation();
    if (!line) return null;
    const focusEvents = {
      onFocusCapture: (event: React.FocusEvent<HTMLElement>) =>
        setCountFocused(Boolean(event.target.closest('[data-inventory-key]'))),
      onBlurCapture: (event: React.FocusEvent<HTMLElement>) => {
        if (
          !(event.relatedTarget instanceof Element) ||
          !event.currentTarget.contains(event.relatedTarget) ||
          !event.relatedTarget.closest('[data-inventory-key]')
        )
          setCountFocused(false);
      },
    };
    if (cards)
      return (
        <div {...focusEvents} className="divide-y">
          <CardBand>
            <div className="min-w-0 wrap-anywhere">
              <InventoryCell id="lot" editor={editor} line={line} cards />
            </div>
            {columns.some(([id]) => id === 'actions') && (
              <InventoryCell id="actions" editor={editor} line={line} cards />
            )}
          </CardBand>
          <CardRows>
            {columns
              .filter(([id]) => CARD_COLUMNS.has(id))
              .map(([id, key]) => {
                const cell = (
                  <InventoryCell
                    id={id}
                    editor={editor}
                    line={line}
                    countFocused={countFocused}
                    cards
                  />
                );
                if (
                  CARD_CONTROLS.has(id) &&
                  (id !== 'vvm' || line.orderable.extraData?.useVVM === 'true')
                )
                  return (
                    <CardControlRow key={id} label={t(key)}>
                      {cell}
                    </CardControlRow>
                  );
                return (
                  <SettingsItem key={id} label={t(key)}>
                    <span
                      className={cn(
                        id === 'unaccounted' && 'font-bold',
                        id === 'unaccounted' &&
                          unaccountedInvalid(line, editor) &&
                          'text-destructive',
                      )}
                    >
                      {cell}
                    </span>
                  </SettingsItem>
                );
              })}
          </CardRows>
        </div>
      );
    return (
      <TableRow {...focusEvents}>
        {columns.map(([id]) => (
          <TableCell
            key={id}
            tone={id === 'unaccounted' && unaccountedInvalid(line, editor) ? 'danger' : 'default'}
          >
            <InventoryColumnContent id={id} unit={editor.unit}>
              <InventoryCell
                id={id}
                editor={editor}
                line={line}
                hideProduct={hideProduct}
                countFocused={countFocused}
              />
            </InventoryColumnContent>
          </TableCell>
        ))}
      </TableRow>
    );
  },
  (previous, next) =>
    previous.lineKey === next.lineKey &&
    previous.editor === next.editor &&
    previous.hideProduct === next.hideProduct &&
    previous.cards === next.cards &&
    previous.columns.map(([id]) => id).join() === next.columns.map(([id]) => id).join(),
);

function InventoryCell({
  id,
  line,
  summary,
  hideProduct,
  countFocused = false,
  cards = false,
  editor,
}: {
  editor: InventoryGridEditor;
  id: ColumnId;
  line: InventoryLine;
  summary?: readonly InventoryLine[];
  hideProduct?: boolean;
  countFocused?: boolean;
  cards?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [unaccountedOpen, setUnaccountedOpen] = useState(false);
  const [unaccountedDismissed, setUnaccountedDismissed] = useState(false);
  useEffect(() => {
    if (!countFocused) setUnaccountedDismissed(false);
  }, [countFocused]);
  const valueOrEmpty = cards ? orEmpty : tableValue;
  const formats = inventoryFormats(i18n.language);
  const format = formats.number;
  const errorId = useId();
  const error =
    id === 'count' && !summary && errorsShown(line, editor) ? inventoryLineError(line) : null;
  const unaccountedErrorId = `inventory-unaccounted-${line.key}`;
  const row = `${productName(line.orderable)} ${inventoryLotCode(line) ?? t('stock-events.no-lot-defined')}`;
  const label = (field: string) => t('stock-events.field-of', { field, row });
  const number = (value: number | null | undefined) => (
    <span className="tabular-nums">
      <bdi>{valueOrEmpty(value == null ? null : format(value))}</bdi>
    </span>
  );
  const total = (get: (item: InventoryLine) => number | null) => {
    const values = (summary ?? [line]).map(get);
    return values.every((value) => value === null)
      ? null
      : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  };
  switch (id) {
    case 'productCode':
      return hideProduct ? null : <bdi>{line.orderable.productCode}</bdi>;
    case 'product': {
      const name = productLabel(line.orderable);
      return hideProduct ? null : <ProductName label={name} width="inventory" />;
    }
    case 'packSize':
      return number(line.orderable.netContent);
    case 'lot':
      if (!summary && line.newLot && cards)
        return (
          <Button
            variant="link"
            wrap="normal"
            aria-label={label(t('physical-inventory.edit-lot'))}
            onClick={() => editor.onEditLot(line)}
            type="button"
          >
            <bdi className="wrap-anywhere">{line.newLot.lotCode}</bdi>
          </Button>
        );
      if (!summary && line.newLot)
        return (
          <Button
            variant="link"
            type="button"
            aria-label={label(t('physical-inventory.edit-lot'))}
            onClick={() => editor.onEditLot(line)}
          >
            <bdi className="whitespace-nowrap">{line.newLot.lotCode}</bdi>
          </Button>
        );
      return summary ? null : (
        <span className={cards ? 'min-w-0 wrap-anywhere whitespace-normal' : 'whitespace-nowrap'}>
          <bdi>{inventoryLotCode(line) ?? t('stock-events.no-lot-defined')}</bdi>
        </span>
      );
    case 'expiry':
      return summary ? null : (
        <bdi>
          {valueOrEmpty(inventoryExpiry(line) ? formats.date(inventoryExpiry(line) ?? '') : null)}
        </bdi>
      );
    case 'stock':
      return (
        <bdi dir="ltr">
          {valueOrEmpty(
            formats.quantity(
              total((item) => item.stockOnHand),
              line.orderable.netContent,
              editor.unit,
            ),
          )}
        </bdi>
      );
    case 'count':
      if (!summary)
        return (
          <InventoryCount
            editor={editor}
            line={line}
            label={label(t('physical-inventory.current-stock'))}
            error={error === UNACCOUNTED_ERROR ? null : error || null}
            errorId={error === UNACCOUNTED_ERROR ? unaccountedErrorId : errorId}
            describedBy={error === UNACCOUNTED_ERROR ? unaccountedErrorId : undefined}
          />
        );
      return (
        <bdi dir="ltr">
          {valueOrEmpty(
            formats.quantity(
              total((item) => toOptionalWholeNumber(item.quantity.doses)),
              line.orderable.netContent,
              editor.unit,
            ),
          )}
        </bdi>
      );
    case 'unaccounted': {
      if (summary) return null;
      const value = (
        <bdi dir="ltr">
          {valueOrEmpty(
            formats.quantity(unaccounted(line), line.orderable.netContent, editor.unit),
          )}
        </bdi>
      );
      if (!unaccountedInvalid(line, editor)) return <div>{value}</div>;
      return (
        <Tooltip
          open={(countFocused && !unaccountedDismissed) || unaccountedOpen}
          onOpenChange={(open, details) => {
            setUnaccountedOpen(open);
            if (details.reason === 'escape-key') setUnaccountedDismissed(true);
          }}
          triggerId={`${unaccountedErrorId}-trigger`}
        >
          <TooltipTrigger
            id={`${unaccountedErrorId}-trigger`}
            render={<div className="flex items-center justify-between gap-2" />}
          >
            {value}
            <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
          </TooltipTrigger>
          <TooltipContent role="tooltip">
            {t('physical-inventory.unaccounted-error')}
          </TooltipContent>
          <HiddenFromView>
            <p id={unaccountedErrorId}>{t('physical-inventory.unaccounted-error')}</p>
          </HiddenFromView>
        </Tooltip>
      );
    }
    case 'reasons':
      if (!summary)
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={`${
              line.stockAdjustments.length === 0
                ? t('physical-inventory.add-reasons')
                : line.stockAdjustments.length === 1
                  ? (line.stockAdjustments[0].reason.name ?? line.stockAdjustments[0].reason.id)
                  : t('physical-inventory.reason-count', { count: line.stockAdjustments.length })
            } ${label(t('physical-inventory.reasons'))}`}
            disabled={editor.pending || !line.quantity.doses.trim()}
            onClick={() => editor.onReasons(line)}
          >
            {line.stockAdjustments.length === 0 ? (
              <PlusIcon data-icon="inline-start" />
            ) : (
              <PencilIcon data-icon="inline-start" />
            )}
            <span
              className={cards ? 'min-w-0 wrap-anywhere whitespace-normal' : 'whitespace-nowrap'}
            >
              {line.stockAdjustments.length === 0
                ? t('physical-inventory.add-reasons')
                : line.stockAdjustments.length === 1
                  ? (line.stockAdjustments[0].reason.name ?? line.stockAdjustments[0].reason.id)
                  : t('physical-inventory.reason-count', { count: line.stockAdjustments.length })}
            </span>
          </Button>
        );
      return null;
    case 'actions':
      if (summary || (!line.justAdded && !canDeactivateInventoryLine(line, true))) return null;
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant={line.justAdded ? 'destructive-ghost' : 'ghost'}
                size="icon-sm"
                aria-label={label(
                  t(
                    line.justAdded
                      ? 'physical-inventory.delete-row'
                      : 'physical-inventory.deactivate',
                  ),
                )}
                disabled={editor.pending || (!line.justAdded && !editor.online)}
                focusableWhenDisabled={!line.justAdded && !editor.online}
                onClick={() => (line.justAdded ? editor.onRemove(line) : editor.onDeactivate(line))}
              />
            }
          >
            {line.justAdded ? <Trash2Icon /> : <ArchiveXIcon />}
          </TooltipTrigger>
          <TooltipContent>
            {t(line.justAdded ? 'physical-inventory.delete-row' : 'physical-inventory.deactivate')}
          </TooltipContent>
        </Tooltip>
      );
    case 'vvm':
      if (!summary && line.orderable.extraData?.useVVM === 'true')
        return (
          <div className="w-full">
            <editor.form.AppField name={`lines.${line.key}.vvmStatus`}>
              {(field) => (
                <field.SelectField
                  layout="inline"
                  label={label(t('stock-events.vvm-status'))}
                  disabled={editor.pending}
                  items={vvmItems(t)}
                />
              )}
            </editor.form.AppField>
          </div>
        );
      return cards ? EMPTY_VALUE : null;
  }
}

export function PhysicalInventoryGridSkeleton({
  visibility,
  showVvm = false,
  showActions = false,
  unit = 'DOSES',
  cards = false,
}: {
  visibility: ColumnVisibilityState;
  showVvm?: boolean;
  showActions?: boolean;
  unit?: QuantityUnit;
  cards?: boolean;
}) {
  const { t } = useTranslation();
  const columns = visibleColumns(visibility, showVvm, showActions);
  if (cards)
    return (
      <div aria-busy>
        <CardList footer={<DataTablePaginationSkeleton />}>
          <li>
            <div className="px-4">
              <SkeletonBar width="w-24" />
            </div>
          </li>
          {Array.from({ length: 5 }, (_, index) => `card-${index}`).map((key) => (
            <CardListItem key={key}>
              <CardBand>
                <SkeletonBar width="w-40" />
              </CardBand>
              <CardBand>
                <SkeletonBar width="w-24" />
                {showActions && (
                  <div className="size-7">
                    <Skeleton fill />
                  </div>
                )}
              </CardBand>
              <CardRows>
                {columns
                  .filter(([id]) => CARD_COLUMNS.has(id))
                  .map(([id, key]) =>
                    CARD_CONTROLS.has(id) ? (
                      <CardControlRow key={id} label={t(key)}>
                        <div className="h-7 w-full">
                          <Skeleton fill />
                        </div>
                      </CardControlRow>
                    ) : (
                      <SettingsRowFrame
                        key={id}
                        label={<span className="text-sm">{t(key)}</span>}
                        align="center"
                      >
                        <SkeletonBar width="w-20" />
                      </SettingsRowFrame>
                    ),
                  )}
              </CardRows>
            </CardListItem>
          ))}
        </CardList>
      </div>
    );
  return (
    <div aria-busy>
      <DataTableCard>
        <Table density="compact" layout="auto">
          <InventoryHead columns={columns} unit={unit} />
          <TableBody>
            {Array.from({ length: 10 }, (_, row) => `row-${row}`).map((row) => (
              <TableRow key={row}>
                {columns.map(([id]) => (
                  <TableCell key={id}>
                    <InventoryColumnContent id={id} unit={unit}>
                      <div className="flex h-9 items-center">
                        {id === 'count' ? (
                          <div className="h-7 w-full">
                            <Skeleton fill />
                          </div>
                        ) : id === 'reasons' ? (
                          <Button variant="secondary" size="sm" disabled>
                            <PlusIcon data-icon="inline-start" />
                            {t('physical-inventory.add-reasons')}
                          </Button>
                        ) : (
                          <div className="h-4 w-full">
                            <Skeleton fill />
                          </div>
                        )}
                      </div>
                    </InventoryColumnContent>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

function InventoryQuantityInputs({
  editor,
  line,
  label,
  error,
  errorId,
  describedBy,
}: {
  editor: InventoryGridEditor;
  line: InventoryLine;
  label: string;
  error: string | null;
  errorId: string;
  describedBy?: string;
}) {
  const field = useFieldContext<QuantityValue>();
  const { t } = useTranslation();
  const [errorOpen, setErrorOpen] = useState(false);
  const parts = editor.unit === 'DOSES' ? (['doses'] as const) : (['packs', 'remainder'] as const);
  return (
    <div data-inventory-key={line.key} className="w-full">
      <Field data-invalid={Boolean(error)} spacing="tight">
        <Tooltip
          disabled={!error}
          triggerId={`${errorId}-trigger`}
          open={Boolean(error) && errorOpen}
          onOpenChange={setErrorOpen}
        >
          <TooltipTrigger
            id={`${errorId}-trigger`}
            render={<div className="flex w-full min-w-0 items-center gap-1" dir="ltr" />}
            tabIndex={-1}
            onFocusCapture={() => setErrorOpen(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setErrorOpen(false);
            }}
          >
            {parts.map((part, index) => (
              <Fragment key={part}>
                {index === 1 && (
                  <span aria-hidden="true" className="shrink-0 whitespace-nowrap">
                    ( +
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <Input
                    controlSize="sm"
                    sizing="minimum"
                    aria-label={
                      parts.length === 1
                        ? label
                        : `${label} ${t(part === 'packs' ? 'quantity-unit.packs' : 'quantity-unit.doses')}`
                    }
                    inputMode="numeric"
                    dir="ltr"
                    placeholder={t(
                      part === 'packs' ? 'quantity-unit.packs' : 'quantity-unit.doses',
                    )}
                    value={field.state.value[part]}
                    disabled={editor.pending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : describedBy}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      editor.onCounted(line.key);
                      field.handleChange(
                        updateQuantityValue(
                          field.state.value,
                          part,
                          toLatinDigits(event.target.value).replace(/[^0-9]/g, ''),
                          line.orderable.netContent,
                        ),
                      );
                    }}
                  />
                </div>
                {index === 1 && (
                  <span aria-hidden="true" className="shrink-0">
                    )
                  </span>
                )}
              </Fragment>
            ))}
          </TooltipTrigger>
          <TooltipContent id={`${errorId}-tooltip`} role="tooltip">
            {error && t(error as 'stock-events.required')}
          </TooltipContent>
        </Tooltip>
        {error && (
          <HiddenFromView>
            <p id={errorId}>{t(error as 'stock-events.required')}</p>
          </HiddenFromView>
        )}
      </Field>
    </div>
  );
}

function InventoryCount(props: Parameters<typeof InventoryQuantityInputs>[0]) {
  const { editor, line } = props;
  return (
    <editor.form.AppField name={`lines.${line.key}.quantity`}>
      {() => <InventoryQuantityInputs {...props} />}
    </editor.form.AppField>
  );
}
