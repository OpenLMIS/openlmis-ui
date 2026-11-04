import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import {
  type CSSProperties,
  Fragment,
  memo,
  type Ref,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { InputSizer } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBatch, useBatchVersion } from '@/features/requisitions/components/batch-context';
import {
  BatchCost,
  BatchInputCell,
  batchFieldId,
} from '@/features/requisitions/components/batch-quantity';
import { BatchRecordStatus } from '@/features/requisitions/components/batch-record-status';
import { RequisitionGridHeader } from '@/features/requisitions/components/requisition-grid-header';
import { batchApprovable, batchRowTotals, batchTotals } from '@/features/requisitions/lib/batch';
import type { BatchRequisition, BatchRow } from '@/features/requisitions/lib/batch-types';
import { formatCurrency } from '@/features/requisitions/lib/currency';
import { revealField } from '@/lib/reveal-field';

export type BatchGridHandle = { reveal: (id: string) => void };

const BatchGroup = memo(function BatchGroup({ record }: { record: BatchRequisition }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 whitespace-normal py-2">
      <RequisitionGridHeader
        label={t('requisitions.batch.group', {
          facility: record.facilityName,
          period: record.periodName,
        })}
      />
      <BatchRecordStatus record={record} />
    </div>
  );
});
const ProductTotals = memo(function ProductTotals({ row }: { row: BatchRow }) {
  const { drafts, currency } = useBatch();
  useBatchVersion(`product:${row.product.id}`);
  const { quantity, cost } = batchRowTotals(row, drafts.quantities());
  return (
    <>
      <TableCell sticky="end" stickyOffset="var(--batch-cost-width)">
        {quantity}
      </TableCell>
      <TableCell sticky="end">{formatCurrency(cost, currency)}</TableCell>
    </>
  );
});
const ProductRow = memo(function ProductRow({
  row,
  index,
  measure,
}: {
  row: BatchRow;
  index: number;
  measure: (element: HTMLTableRowElement | null) => void;
}) {
  const { records } = useBatch();
  return (
    <TableRow pinned ref={measure} data-index={index} aria-rowindex={index + 3}>
      <TableCell sticky rowHeader>
        {row.product.productCode}
      </TableCell>
      <TableCell sticky stickyOffset="var(--batch-code-width)" rowHeader>
        <div className="max-w-64 whitespace-normal">{row.product.fullProductName}</div>
      </TableCell>
      {records.map((record) => {
        const line = row.lines.get(record.id);
        return (
          <Fragment key={record.id}>
            <BatchInputCell record={record} line={line} />
            <TableCell>{line && <BatchCost recordId={record.id} line={line} />}</TableCell>
          </Fragment>
        );
      })}
      <ProductTotals row={row} />
    </TableRow>
  );
});
function BatchFooter() {
  const { t } = useTranslation();
  const { records, drafts, currency } = useBatch();
  useBatchVersion('totals');
  const totals = batchTotals(records, drafts.quantities());
  return (
    <TableFooter sticky>
      <TableRow pinned surface="muted">
        <TableCell sticky colSpan={2}>
          {t('requisitions.batch.total')}
        </TableCell>
        {records.map((record) => (
          <Fragment key={record.id}>
            <TableCell />
            <TableCell>{formatCurrency(totals.perRecord.get(record.id), currency)}</TableCell>
          </Fragment>
        ))}
        <TableCell sticky="end" stickyOffset="var(--batch-cost-width)" />
        <TableCell sticky="end">{formatCurrency(totals.cost, currency)}</TableCell>
      </TableRow>
    </TableFooter>
  );
}
export const BatchGrid = memo(function BatchGrid({ ref }: { ref?: Ref<BatchGridHandle> }) {
  const { t } = useTranslation();
  const { records, rows, drafts } = useBatch();
  const frame = useRef<HTMLDivElement>(null);
  const firstGroup = useRef<HTMLTableCellElement>(null);
  const name = useRef<HTMLTableCellElement>(null);
  const cost = useRef<HTMLTableCellElement>(null);
  const quantity = useRef<HTMLTableCellElement>(null);
  const code = useRef<HTMLTableCellElement>(null);
  const header = useRef<HTMLTableSectionElement>(null);
  const [headerHeight, setHeaderHeight] = useState(128);
  useLayoutEffect(() => {
    const element = code.current;
    if (!element || !records.length) return;
    const measure = () => {
      setHeaderHeight(header.current?.getBoundingClientRect().height ?? 128);
      const codeWidth = element.getBoundingClientRect().width;
      const nameWidth = name.current?.getBoundingClientRect().width ?? 0;
      const costWidth = cost.current?.getBoundingClientRect().width ?? 0;
      const quantityWidth = quantity.current?.getBoundingClientRect().width ?? 0;
      frame.current?.style.setProperty('--batch-code-width', `${codeWidth}px`);
      frame.current?.style.setProperty('--batch-name-width', `${nameWidth}px`);
      frame.current?.style.setProperty('--batch-cost-width', `${costWidth}px`);
      frame.current?.style.setProperty('--batch-quantity-width', `${quantityWidth}px`);
      const end =
        codeWidth +
          nameWidth +
          costWidth +
          quantityWidth +
          (firstGroup.current?.getBoundingClientRect().width ?? 0) <
        (frame.current?.getBoundingClientRect().width ?? 0);
      frame.current?.toggleAttribute('data-pin-end', end);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const target of [
      element,
      header.current,
      frame.current,
      firstGroup.current,
      name.current,
      cost.current,
      quantity.current,
    ])
      if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [records]);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getItemKey: (index) => rows[index].product.id,
    getScrollElement: () =>
      frame.current?.querySelector<HTMLDivElement>('[data-slot="table-container"]') ?? null,
    estimateSize: () => 49,
    overscan: 4,
    initialRect: { width: 1200, height: 512 },
    scrollMargin: headerHeight,
    scrollPaddingStart: headerHeight,
    scrollPaddingEnd: 48,
    rangeExtractor: (range) => {
      const indices = defaultRangeExtractor(range);
      if (focusedRow !== null && focusedRow < rows.length && !indices.includes(focusedRow))
        indices.push(focusedRow);
      return indices.sort((a, b) => a - b);
    },
  });
  const fields = useMemo(
    () =>
      rows.flatMap((row, index) =>
        records.flatMap((record) => {
          const line = row.lines.get(record.id);
          return batchApprovable(record) && line && !line.skipped
            ? [{ id: batchFieldId(record.id, line.id), index, recordId: record.id }]
            : [];
        }),
      ),
    [records, rows],
  );
  const reveal = (id: string) => {
    const field = fields.find((field) => field.id === id);
    if (!field) return;
    flushSync(() => setFocusedRow(field.index));
    virtualizer.scrollToIndex(field.index, { align: 'auto' });
    const element = document.getElementById(id);
    if (element) revealField(element, false);
  };
  useImperativeHandle(ref, () => ({ reveal }));
  const items = virtualizer.getVirtualItems();
  let previousEnd = headerHeight;
  return (
    <div
      ref={frame}
      className="batch-grid h-128 min-h-0 overflow-hidden rounded-xl border bg-card"
      onFocusCapture={(event) => {
        const field = fields.find((field) => field.id === event.target.id);
        if (field) setFocusedRow(field.index);
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Tab' || !(event.target instanceof HTMLInputElement)) return;
        const enabled = fields.filter(
          (field) => !drafts.outdated(field.recordId) && !drafts.unresolved(field.recordId),
        );
        const index = enabled.findIndex(
          (field) => field.id === (event.target as HTMLInputElement).id,
        );
        const next = enabled[index + (event.shiftKey ? -1 : 1)];
        if (index < 0 || !next) return;
        event.preventDefault();
        reveal(next.id);
      }}
    >
      <Table
        scroll="both"
        density="compact"
        aria-label={t('requisitions.batch.title')}
        aria-rowcount={rows.length + 3}
      >
        <TableHeader ref={header}>
          <TableRow pinned surface="muted">
            <TableHead colSpan={2} sticky>
              <RequisitionGridHeader label={t('requisitions.batch.product')} />
            </TableHead>
            {records.map((record, index) => (
              <TableHead ref={index === 0 ? firstGroup : undefined} colSpan={2} key={record.id}>
                <BatchGroup record={record} />
              </TableHead>
            ))}
            <TableHead colSpan={2} sticky="end">
              <RequisitionGridHeader label={t('requisitions.batch.total-all')} />
            </TableHead>
          </TableRow>
          <TableRow pinned surface="muted">
            <TableHead ref={code} sticky>
              <RequisitionGridHeader label={t('requisitions.batch.code')} />
            </TableHead>
            <TableHead ref={name} sticky stickyOffset="var(--batch-code-width)">
              <RequisitionGridHeader label={t('requisitions.batch.name')} />
            </TableHead>
            {records.map((record) => (
              <Fragment key={record.id}>
                <TableHead>
                  <RequisitionGridHeader label={t('requisitions.batch.approved-quantity')} />
                  <InputSizer placeholder="0" sizing="full-minimum" />
                </TableHead>
                <TableHead>
                  <RequisitionGridHeader label={t('requisitions.batch.cost')} />
                </TableHead>
              </Fragment>
            ))}
            <TableHead ref={quantity} sticky="end" stickyOffset="var(--batch-cost-width)">
              <RequisitionGridHeader label={t('requisitions.batch.quantity')} />
            </TableHead>
            <TableHead ref={cost} sticky="end">
              <RequisitionGridHeader label={t('requisitions.batch.cost')} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const gap = item.start - previousEnd;
            previousEnd = item.end;
            return (
              <Fragment key={item.key}>
                {gap > 0 && (
                  <tr aria-hidden="true" tabIndex={-1}>
                    <td
                      colSpan={records.length * 2 + 4}
                      className="batch-spacer"
                      style={{ '--batch-spacer-height': `${gap}px` } as CSSProperties}
                    />
                  </tr>
                )}
                <ProductRow
                  row={rows[item.index]}
                  index={item.index}
                  measure={virtualizer.measureElement}
                />
              </Fragment>
            );
          })}
          <tr aria-hidden="true" tabIndex={-1}>
            <td
              colSpan={records.length * 2 + 4}
              className="batch-spacer"
              style={
                {
                  '--batch-spacer-height': `${Math.max(0, virtualizer.getTotalSize() - previousEnd + headerHeight)}px`,
                } as CSSProperties
              }
            />
          </tr>
        </TableBody>
        <BatchFooter />
      </Table>
    </div>
  );
});
