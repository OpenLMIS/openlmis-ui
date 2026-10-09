import { ClipboardListIcon, WarehouseIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableHeaderLabel,
} from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type StockProgramRow = {
  id: string;
  label: string;
  status?: ReactNode;
  actionLabel?: string;
  disabled?: boolean;
};

type StockProgramPickerProps = {
  rows: readonly StockProgramRow[];
  hasHomeFacility: boolean;
  actionLabel: string;
  statusLabel?: string;
} & (
  | { linkFor: (row: StockProgramRow) => ReactElement; onAction?: never }
  | { onAction: (row: StockProgramRow) => void; linkFor?: never }
);

function ProgramTable({ children, statusLabel }: { children: ReactNode; statusLabel?: string }) {
  const { t } = useTranslation();
  return (
    <DataTableCard>
      <Table density="comfortable" layout="fixed">
        <colgroup>
          <col className="w-2/5" />
          {statusLabel ? <col className="w-1/3" /> : null}
          <col />
        </colgroup>
        <TableHeader surface="muted">
          <TableRow>
            <TableHead>
              <DataTableHeaderLabel>{t('stock-programs.program')}</DataTableHeaderLabel>
            </TableHead>
            {statusLabel ? (
              <TableHead>
                <DataTableHeaderLabel>{statusLabel}</DataTableHeaderLabel>
              </TableHead>
            ) : null}
            <TableHead>
              <div className="text-end">
                <DataTableHeaderLabel>{t('stock-programs.action')}</DataTableHeaderLabel>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </DataTableCard>
  );
}

export function StockProgramPicker({
  rows,
  hasHomeFacility,
  actionLabel,
  linkFor,
  statusLabel,
  onAction,
}: StockProgramPickerProps) {
  const { t } = useTranslation();
  if (!hasHomeFacility || rows.length === 0) {
    return (
      <DataTableCard>
        <DataTableEmpty
          description={t(
            hasHomeFacility ? 'stock-programs.no-programs' : 'facility-program.no-home',
          )}
          icon={hasHomeFacility ? <ClipboardListIcon /> : <WarehouseIcon />}
          title={t(
            hasHomeFacility ? 'stock-programs.no-programs-title' : 'stock-programs.no-home-title',
          )}
        />
      </DataTableCard>
    );
  }
  return (
    <ProgramTable statusLabel={statusLabel}>
      {rows.map((row) => (
        <TableRow key={row.id}>
          <TableCell>
            <div className="whitespace-normal break-words font-medium">{row.label}</div>
          </TableCell>
          {statusLabel ? (
            <TableCell>
              <div className="whitespace-normal break-words">{row.status}</div>
            </TableCell>
          ) : null}
          <TableCell>
            <div className="flex justify-end">
              <Button
                nativeButton={Boolean(onAction)}
                render={onAction ? undefined : linkFor?.(row)}
                role={onAction ? undefined : 'link'}
                disabled={row.disabled}
                onClick={onAction ? () => onAction(row) : undefined}
                size="xl"
                width="shrink"
              >
                <span className="whitespace-normal break-words">
                  {row.actionLabel ?? actionLabel}
                </span>
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </ProgramTable>
  );
}

export function StockProgramPickerSkeleton({ statusLabel }: { statusLabel?: string } = {}) {
  return (
    <div aria-busy>
      <ProgramTable statusLabel={statusLabel}>
        {[0, 1].map((row) => (
          <TableRow key={row}>
            <TableCell>
              <div className="h-4 w-3/4">
                <Skeleton fill />
              </div>
            </TableCell>
            {statusLabel ? (
              <TableCell>
                <div className="h-4 w-20">
                  <Skeleton fill />
                </div>
              </TableCell>
            ) : null}
            <TableCell>
              <div className="ms-auto h-8 w-32 max-w-full">
                <Skeleton fill />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </ProgramTable>
    </div>
  );
}
