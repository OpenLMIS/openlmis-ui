import { TriangleAlertIcon } from 'lucide-react';
import {
  createContext,
  Fragment,
  memo,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import { BatchCost, BatchInputCell } from '@/features/requisitions/components/batch-quantity';
import { RequisitionGridHeader } from '@/features/requisitions/components/requisition-grid-header';
import { batchCost, batchTotals, validateBatchQuantity } from '@/features/requisitions/lib/batch';
import type { BatchRequisition, BatchRow } from '@/features/requisitions/lib/batch-types';
import { formatCurrency } from '@/features/requisitions/lib/currency';
import { toWholeNumber } from '@/lib/whole-number';

const BatchPins = createContext({ end: false, costWidth: 0 });

const BatchGroup = memo(function BatchGroup({ record }: { record: BatchRequisition }) {
  const { t } = useTranslation();
  const { drafts, reasons } = useBatch();
  useBatchVersion(`record:${record.id}`);
  useBatchVersion('meta');
  const invalid = record.requisitionLineItems.some(
    (l) => !l.skipped && validateBatchQuantity(drafts.text(record.id, l)),
  );
  const reason = reasons.get(record.id);
  return (
    <div className="flex flex-col gap-1 whitespace-normal py-2">
      <RequisitionGridHeader
        label={t('requisitions.batch.group', {
          facility: record.facilityName,
          period: record.periodName,
        })}
      />
      {(invalid || reason) && (
        <span className="flex items-center gap-1 text-destructive text-xs">
          <TriangleAlertIcon className="size-4 shrink-0" />
          {reason || t('requisitions.batch.invalid-requisition')}
        </span>
      )}
    </div>
  );
});
const ProductTotals = memo(function ProductTotals({ row }: { row: BatchRow }) {
  const { drafts, currency } = useBatch();
  useBatchVersion(`product:${row.product.id}`);
  const pins = useContext(BatchPins);
  let quantity = 0;
  let cost = 0;
  for (const [id, line] of row.lines) {
    const text = drafts.text(id, line);
    const q = toWholeNumber(text);
    quantity += Number.isFinite(q) ? q : 0;
    cost += batchCost(line, text);
  }
  return (
    <>
      <TableCell sticky={pins.end && 'end'} stickyOffset={pins.costWidth}>
        {quantity}
      </TableCell>
      <TableCell sticky={pins.end && 'end'}>{formatCurrency(cost, currency)}</TableCell>
    </>
  );
});
const ProductRow = memo(function ProductRow({
  row,
  codeWidth,
}: {
  row: BatchRow;
  codeWidth: number;
}) {
  const { records } = useBatch();
  return (
    <TableRow pinned>
      <TableCell sticky>{row.product.productCode}</TableCell>
      <TableCell sticky stickyOffset={codeWidth}>
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
export function BatchFooter() {
  const { t } = useTranslation();
  const { records, drafts, currency } = useBatch();
  useBatchVersion('totals');
  const totals = batchTotals(records, drafts.quantities());
  const pins = useContext(BatchPins);
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
        <TableCell sticky={pins.end && 'end'} stickyOffset={pins.costWidth} />
        <TableCell sticky={pins.end && 'end'}>{formatCurrency(totals.cost, currency)}</TableCell>
      </TableRow>
    </TableFooter>
  );
}
export const BatchGrid = memo(function BatchGrid() {
  const { t } = useTranslation();
  const { records, rows } = useBatch();
  const frame = useRef<HTMLDivElement>(null);
  const firstGroup = useRef<HTMLTableCellElement>(null);
  const name = useRef<HTMLTableCellElement>(null);
  const cost = useRef<HTMLTableCellElement>(null);
  const quantity = useRef<HTMLTableCellElement>(null);
  const [pins, setPins] = useState({ end: false, costWidth: 0 });
  const code = useRef<HTMLTableCellElement>(null);
  const [codeWidth, setCodeWidth] = useState(0);
  useLayoutEffect(() => {
    const element = code.current;
    if (!element || !records.length) return;
    const measure = () => {
      const codeWidth = element.getBoundingClientRect().width;
      const nameWidth = name.current?.getBoundingClientRect().width ?? 0;
      const costWidth = cost.current?.getBoundingClientRect().width ?? 0;
      const quantityWidth = quantity.current?.getBoundingClientRect().width ?? 0;
      setCodeWidth(codeWidth);
      const end =
        codeWidth +
          nameWidth +
          costWidth +
          quantityWidth +
          (firstGroup.current?.getBoundingClientRect().width ?? 0) <
        (frame.current?.getBoundingClientRect().width ?? 0);
      setPins((previous) =>
        previous.end === end && previous.costWidth === costWidth ? previous : { end, costWidth },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const target of [
      element,
      frame.current,
      firstGroup.current,
      name.current,
      cost.current,
      quantity.current,
    ])
      if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [records]);
  return (
    <div ref={frame} className="h-128 min-h-0 overflow-hidden rounded-xl border bg-card">
      <BatchPins value={pins}>
        <Table scroll="both" density="compact">
          <TableHeader>
            <TableRow pinned surface="muted">
              <TableHead colSpan={2} sticky>
                <RequisitionGridHeader label={t('requisitions.batch.product')} />
              </TableHead>
              {records.map((record, index) => (
                <TableHead ref={index === 0 ? firstGroup : undefined} colSpan={2} key={record.id}>
                  <BatchGroup record={record} />
                </TableHead>
              ))}
              <TableHead colSpan={2} sticky={pins.end && 'end'}>
                <RequisitionGridHeader label={t('requisitions.batch.total-all')} />
              </TableHead>
            </TableRow>
            <TableRow pinned surface="muted">
              <TableHead ref={code} sticky>
                <RequisitionGridHeader label={t('requisitions.batch.code')} />
              </TableHead>
              <TableHead ref={name} sticky stickyOffset={codeWidth}>
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
              <TableHead ref={quantity} sticky={pins.end && 'end'} stickyOffset={pins.costWidth}>
                <RequisitionGridHeader label={t('requisitions.batch.quantity')} />
              </TableHead>
              <TableHead ref={cost} sticky={pins.end && 'end'}>
                <RequisitionGridHeader label={t('requisitions.batch.cost')} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ProductRow key={row.product.id} row={row} codeWidth={codeWidth} />
            ))}
          </TableBody>
          <BatchFooter />
        </Table>
      </BatchPins>
    </div>
  );
});
