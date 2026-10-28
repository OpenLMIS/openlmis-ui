import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CardBand, CardControlRow, CardList, CardListItem, CardRows } from '@/components/card-list';
import { DataTableCard, DataTableFooter } from '@/components/data-table/data-table';
import { DataTablePaginationSkeleton } from '@/components/data-table/data-table-pagination';
import { SettingsRowFrame } from '@/components/form/settings-list';
import { QuantityHeaderSizer } from '@/components/quantity-header-sizer';
import {
  RecordSummary,
  RecordSummaryFieldSkeleton,
  RecordSummaryFields,
  RecordSummaryHeading,
} from '@/components/record-summary';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DraftComment } from '@/features/requisitions/components/requisition-comment-field';
import { RequisitionGridHeader } from '@/features/requisitions/components/requisition-grid-header';
import { RequisitionGridToolbar } from '@/features/requisitions/components/requisition-grid-toolbar';
import { RequisitionTotalsSkeleton } from '@/features/requisitions/components/requisition-totals';
import { SkipButtons } from '@/features/requisitions/components/skip-controls';
import { canRemoveLine } from '@/features/requisitions/lib/draft';
import {
  compileColumns,
  defaultRequisitionTab,
  type GridColumn,
  type RequisitionTab,
} from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { useCardView } from '@/hooks/use-card-view';
import type { QuantityUnit } from '@/lib/quantity';
import { toPaginationState } from '@/lib/table-search';
import { cn } from '@/lib/utils';

export type PendingEditing = {
  editable: boolean;
  editableColumns: readonly string[];
  skipLines: boolean;
  addFullSupplyProduct: boolean;
  addNonFullSupplyProduct: boolean;
  deviceAvailable: boolean;
};

function TextLine({ text, width }: { text: string; width: string }) {
  return (
    <div className={cn('relative max-w-full', text, width)}>
      <span aria-hidden className="invisible">
        .
      </span>
      <div className="absolute inset-x-0 inset-y-1">
        <Skeleton fill />
      </div>
    </div>
  );
}

function Block({ size }: { size: string }) {
  return (
    <div className={size}>
      <Skeleton fill />
    </div>
  );
}

export function RequisitionHeaderSkeleton({ record }: { record?: RequisitionRecord }) {
  const { t } = useTranslation();
  const fields = [
    'requisitions.requisition.facility',
    'requisitions.requisition.operated-by',
    'requisitions.requisition.district',
    'requisitions.requisition.region',
    'requisitions.requisition.period',
    ...(record?.datePhysicalStockCountCompleted
      ? (['requisitions.requisition.physical-count-date'] as const)
      : []),
    'requisitions.requisition.status',
  ] as const;
  return (
    <RecordSummary aria-busy>
      <RecordSummaryHeading>
        {record ? (
          t(
            record.emergency
              ? 'requisitions.requisition.emergency'
              : record.reportOnly
                ? 'requisitions.requisition.report-only'
                : 'requisitions.requisition.regular',
          )
        ) : (
          <TextLine text="text-sm" width="w-16" />
        )}
      </RecordSummaryHeading>
      <RecordSummaryFields>
        {fields.map((id) => (
          <RecordSummaryFieldSkeleton key={id} label={t(id)} />
        ))}
      </RecordSummaryFields>
    </RecordSummary>
  );
}

export function RequisitionCommentsSkeleton({
  record,
  canComment = false,
}: {
  record?: RequisitionRecord;
  canComment?: boolean;
}) {
  const { t } = useTranslation();
  const hasMessages = !!record?.statusHistory?.some((entry) => entry.statusMessageDto);
  const draft = canComment ? (record?.draftStatusMessage ?? '') : '';
  return (
    <div aria-busy className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="font-semibold text-sm">{t('requisitions.requisition.comments')}</div>
        <div className="min-w-8 flex-1">
          <Separator />
        </div>
        {hasMessages && (
          <Button variant="outline" size="lg" disabled>
            {t('requisitions.requisition.view-history')}
          </Button>
        )}
        {canComment && !draft && (
          <Button variant="outline" size="lg" disabled>
            <PlusIcon data-icon="inline-start" />
            {t('requisitions.edit.add-comment')}
          </Button>
        )}
      </div>
      {draft && <DraftComment text={draft} pending onEdit={noop} onRemove={noop} />}
      {hasMessages ? (
        <DataTableCard>
          <div className="divide-y">
            <CardBand>
              <Block size="h-5 w-24" />
              <Block size="h-4 w-44 max-w-full" />
            </CardBand>
            <div className="px-4 py-3">
              <TextLine text="text-sm leading-relaxed" width="w-56" />
            </div>
          </div>
        </DataTableCard>
      ) : (
        !draft && (
          <div className="rounded-xl border border-dashed px-4 py-3">
            <TextLine text="text-sm" width="w-32" />
          </div>
        )
      )}
    </div>
  );
}

export function RequisitionTabsPending({
  record,
  showNonFullSupply = true,
  tab,
  ...grid
}: {
  record?: RequisitionRecord;
  showNonFullSupply?: boolean;
  tab?: RequisitionTab;
} & Omit<Parameters<typeof RequisitionGridPending>[0], 'record' | 'tab'>) {
  const { t } = useTranslation();
  const patients = !!record?.template.patientsTabEnabled;
  const tabs: { value: RequisitionTab; label: string }[] = [
    ...(patients
      ? [{ value: 'patients' as const, label: t('requisitions.requisition.patients') }]
      : []),
    {
      value: 'fullSupply',
      label: t(
        patients ? 'requisitions.requisition.priority' : 'requisitions.requisition.full-supply',
      ),
    },
    ...(showNonFullSupply
      ? [
          {
            value: 'nonFullSupply' as const,
            label: t(
              patients
                ? 'requisitions.requisition.additional'
                : 'requisitions.requisition.non-full-supply',
            ),
          },
        ]
      : []),
  ];
  const active =
    tab && tabs.some(({ value }) => value === tab)
      ? tab
      : record
        ? defaultRequisitionTab(record.template)
        : 'fullSupply';
  return (
    <>
      <Tabs spacing="page" value={active}>
        <TabsList size="lg" wrap="column" aria-label={t('requisitions.requisition.tabs')}>
          {tabs.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} disabled>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={active}>
          <RequisitionGridPending record={record} tab={active} {...grid} />
        </TabsContent>
      </Tabs>
      <RequisitionTotalsSkeleton showNonFullSupply={showNonFullSupply} />
    </>
  );
}

const PENDING_COLUMNS = [
  'product',
  'quantity',
  'stock',
  'requested',
  'approved',
  'remarks',
] as const;
const PAGE_ROWS = toPaginationState({}).pageSize;

export function RequisitionGridPending({
  hideSkipped = false,
  canSwitch = false,
  record,
  tab,
  unit = 'DOSES',
  editing,
  supplyingStock = false,
}: {
  hideSkipped?: boolean;
  canSwitch?: boolean;
  record?: RequisitionRecord;
  tab?: RequisitionTab;
  unit?: QuantityUnit;
  editing?: PendingEditing;
  supplyingStock?: boolean;
}) {
  const { t } = useTranslation();
  const activeTab = tab ?? (record ? defaultRequisitionTab(record.template) : 'fullSupply');
  const columns: GridColumn[] = record
    ? compileColumns(record.template, {
        tab: activeTab,
        status: record.status,
        emergency: record.emergency,
        supplyingStock: supplyingStock && !record.supplyingFacilityAccessDenied,
      }).map((column) => ({
        ...column,
        label: column.kind === 'packSize' ? t('requisitions.requisition.pack-size') : column.label,
        definition: column.stockBasedNote
          ? [column.definition, t('requisitions.adjustments.stock-based-note')]
              .filter(Boolean)
              .join(' ')
          : column.definition,
      }))
    : PENDING_COLUMNS.map((name) => ({
        name,
        label: t(`requisitions.requisition.${name}`),
        sticky: false,
        definition: '',
        kind: 'text',
        convertsToPacks: false,
      }));
  const templateId =
    record?.template.id ??
    Object.keys(record?.template.columnsMap ?? {})
      .sort()
      .join(':');
  const view = useCardView<HTMLDivElement>(
    columns.filter((column) => !column.sticky).map((column) => ({ id: column.name })),
    `requisition-columns:${templateId}`,
  );
  const editable = !!editing?.editable;
  const fullSupply = activeTab === 'fullSupply';
  const removable = canRemoveLine(fullSupply, editable);
  const stockBased = !!record?.template.populateStockOnHandFromStockCards;
  const visible = columns.filter(
    (column) =>
      view.columnView.visibility[column.name] !== false &&
      !(view.cards && column.name === 'orderable.productCode'),
  );
  const isControl = (column: GridColumn) =>
    editable &&
    (editing.editableColumns.includes(column.name) ||
      column.kind === 'skip' ||
      (column.kind === 'adjustments' && !stockBased));
  const lineCount = record ? Math.min(PAGE_ROWS, record.requisitionLineItems.length) : PAGE_ROWS;
  const lines = Array.from({ length: lineCount }, (_, index) => index);
  const addProduct =
    editable && (fullSupply ? editing.addFullSupplyProduct : editing.addNonFullSupplyProduct);
  const cell = (column: GridColumn, cards: boolean) => {
    if (column.kind === 'skip')
      return cards && !editable ? (
        <Block size="h-5 w-12" />
      ) : (
        <div className="flex justify-center">
          <Block size="size-4" />
        </div>
      );
    if (column.kind === 'adjustments' && !stockBased)
      return (
        <div className="flex items-center justify-between gap-2">
          <Block size={cards ? 'size-7' : 'size-6'} />
          <Block size="h-4 w-6" />
        </div>
      );
    if (isControl(column)) return <Block size={cards ? 'h-8 w-full' : 'h-7 w-full min-w-16'} />;
    return <TextLine text="text-sm" width={cards ? 'w-16' : 'w-3/4'} />;
  };
  return (
    <div aria-busy ref={view.measure} className="flex min-w-0 flex-col gap-4">
      <RequisitionGridToolbar
        disabled
        columns={columns}
        view={view}
        search={{}}
        onSearchChange={noop}
        hideSkipped={hideSkipped}
        unit={unit}
        setUnit={noop}
        canSwitch={canSwitch}
        extra={
          editable && editing.skipLines && fullSupply && !record?.emergency ? (
            <SkipButtons disabled />
          ) : undefined
        }
        status={editable && editing.deviceAvailable ? <DraftStatusSkeleton /> : undefined}
        action={
          addProduct ? (
            <Button size="lg" disabled>
              <PlusIcon />
              {t('requisitions.edit.add-product')}
            </Button>
          ) : undefined
        }
      />
      {view.cards ? (
        <CardList footer={<DataTablePaginationSkeleton />}>
          {lineCount > 0 && (
            <li>
              <div className="px-1 pt-2">
                <TextLine text="text-base" width="w-32" />
              </div>
            </li>
          )}
          {lines.map((line) => (
            <CardListItem key={line}>
              <CardBand>
                <TextLine text="text-sm" width="w-40" />
                {removable && <Block size="size-8" />}
              </CardBand>
              <CardRows>
                {visible
                  .filter((column) => column.kind !== 'product')
                  .map((column) =>
                    isControl(column) ? (
                      <CardControlRow
                        key={column.name}
                        label={column.label}
                        width={column.convertsToPacks && unit === 'PACKS' ? 'wide' : 'half'}
                      >
                        {cell(column, true)}
                      </CardControlRow>
                    ) : (
                      <SettingsRowFrame
                        key={column.name}
                        label={<span className="text-sm">{column.label}</span>}
                      >
                        {cell(column, true)}
                      </SettingsRowFrame>
                    ),
                  )}
              </CardRows>
            </CardListItem>
          ))}
        </CardList>
      ) : (
        <DataTableCard>
          <Table density="compact" layout="auto">
            <TableHeader>
              <TableRow pinned surface="muted">
                {visible.map((column) => (
                  <TableHead key={column.name} width={column.kind === 'skip' ? 'fit' : undefined}>
                    <RequisitionGridHeader
                      label={column.label}
                      definition={column.definition}
                      align={column.kind === 'skip' ? 'center' : 'start'}
                    />
                    {editable &&
                      column.kind === 'quantity' &&
                      editing.editableColumns.includes(column.name) && (
                        <QuantityHeaderSizer unit={unit} />
                      )}
                  </TableHead>
                ))}
                {removable && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineCount > 0 && (
                <TableRow pinned surface="primary">
                  <TableCell colSpan={visible.length + (removable ? 1 : 0)}>
                    <div className="ps-6">
                      <TextLine text="text-sm" width="w-32" />
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {lines.map((line) => (
                <TableRow key={line} pinned>
                  {visible.map((column) => (
                    <TableCell key={column.name}>{cell(column, false)}</TableCell>
                  ))}
                  {removable && (
                    <TableCell>
                      <Block size="size-7" />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            {visible.some((column) => column.name === 'totalCost') && (
              <TableFooter>
                <TableRow pinned surface="muted">
                  {visible.map((column, index) => (
                    <TableCell key={column.name}>
                      {index === 0 ? (
                        t('requisitions.requisition.total')
                      ) : column.name === 'totalCost' ? (
                        <TextLine text="text-sm" width="w-16" />
                      ) : null}
                    </TableCell>
                  ))}
                  {removable && <TableCell />}
                </TableRow>
              </TableFooter>
            )}
          </Table>
          <DataTableFooter>
            <DataTablePaginationSkeleton />
          </DataTableFooter>
        </DataTableCard>
      )}
    </div>
  );
}

function DraftStatusSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <span className="relative inline-flex h-5 items-center px-2 font-medium text-xs" aria-hidden>
        <span className="invisible ps-4">{t('stock-events.draft-saved')}</span>
        <span className="absolute inset-0 overflow-hidden rounded-4xl">
          <Skeleton fill />
        </span>
      </span>
    </div>
  );
}

const noop = () => {};
