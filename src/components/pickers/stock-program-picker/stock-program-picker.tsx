import { ClipboardListIcon, WarehouseIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableHeaderLabel,
} from '@/components/data-table/data-table';
import {
  CardBand,
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
  SkeletonBar,
} from '@/components/display/card-list';
import { SettingsItem } from '@/components/form/settings-list';
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
import { useCardLayout } from '@/hooks/use-card-view';
import { orEmpty } from '@/lib/empty-value';

type StockProgramRow = {
  id: string;
  label: string;
  status?: ReactNode;
  actionLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  disabledDescription?: string;
};

type StockProgramPickerProps = {
  rows: readonly StockProgramRow[];
  hasHomeFacility: boolean;
  actionLabel?: string;
  actionsLabel?: string;
  statusLabel?: ReactNode;
} & (
  | { linkFor: (row: StockProgramRow) => ReactElement; onAction?: never }
  | { onAction: (row: StockProgramRow) => void; linkFor?: never }
);

const unavailableId = (row: StockProgramRow) => `program-unavailable-${row.id}`;

function UnavailableLabel({ row }: { row: StockProgramRow }) {
  return (
    <span
      className="font-medium text-muted-foreground text-xs"
      id={row.disabledDescription ? undefined : unavailableId(row)}
    >
      {row.disabledReason}
    </span>
  );
}

function UnavailableDescription({ row }: { row: StockProgramRow }) {
  return (
    <p
      className="text-pretty break-words whitespace-normal text-muted-foreground text-xs"
      id={unavailableId(row)}
    >
      {row.disabledDescription}
    </p>
  );
}

function ProgramTable({
  children,
  statusLabel,
  actionsLabel,
}: {
  children: ReactNode;
  statusLabel?: ReactNode;
  actionsLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <DataTableCard>
      <Table density="default" layout="fixed">
        <colgroup>
          <col className={statusLabel ? 'w-1/3 @xl/main:w-2/5' : 'w-2/5'} />
          {statusLabel ? <col className="w-3/10 @xl/main:w-1/3" /> : null}
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
                <DataTableHeaderLabel>
                  {actionsLabel ?? t('stock-programs.action')}
                </DataTableHeaderLabel>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </DataTableCard>
  );
}

export function StockProgramPicker(props: StockProgramPickerProps) {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div ref={measure}>
      <ProgramPickerContent {...props} cards={cards} />
    </div>
  );
}

function ProgramPickerContent({
  rows,
  hasHomeFacility,
  actionLabel,
  actionsLabel,
  linkFor,
  statusLabel,
  onAction,
  cards,
}: StockProgramPickerProps & { cards: boolean }) {
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
  const action = (row: StockProgramRow) => (
    <Button
      nativeButton={Boolean(onAction)}
      render={onAction ? undefined : linkFor?.(row)}
      role={onAction ? undefined : 'link'}
      disabled={row.disabled}
      focusableWhenDisabled={!!row.disabledReason}
      aria-describedby={row.disabledReason ? unavailableId(row) : undefined}
      onClick={onAction ? () => onAction(row) : undefined}
      size={cards ? 'sm' : 'xl'}
      width="shrink"
    >
      <span className="min-w-0 break-words whitespace-normal">
        {row.actionLabel ?? actionLabel}
      </span>
    </Button>
  );
  if (cards) {
    return (
      <CardList>
        {rows.map((row) => (
          <CardListItem key={row.id}>
            <CardBand>
              <span className="min-w-0 flex-1 wrap-anywhere">
                <bdi>{row.label}</bdi>
              </span>
              <div className="flex flex-col items-end gap-1">
                {action(row)}
                {row.disabledReason && <UnavailableLabel row={row} />}
              </div>
            </CardBand>
            {(row.disabledReason && row.disabledDescription) || statusLabel ? (
              <CardRows>
                {row.disabledReason && row.disabledDescription ? (
                  <div className="flex min-h-8 items-center">
                    <UnavailableDescription row={row} />
                  </div>
                ) : null}
                {statusLabel ? (
                  <SettingsItem label={statusLabel}>
                    <bdi>{orEmpty(row.status)}</bdi>
                  </SettingsItem>
                ) : null}
              </CardRows>
            ) : null}
          </CardListItem>
        ))}
      </CardList>
    );
  }
  return (
    <div>
      <ProgramTable statusLabel={statusLabel} actionsLabel={actionsLabel}>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="break-words whitespace-normal font-medium">{row.label}</div>
            </TableCell>
            {statusLabel ? (
              <TableCell>
                <div className="min-w-0 break-words whitespace-normal">{row.status}</div>
              </TableCell>
            ) : null}
            <TableCell>
              <div className="flex flex-col items-end gap-1">
                {action(row)}
                {row.disabledReason && (
                  <>
                    <UnavailableLabel row={row} />
                    {row.disabledDescription ? (
                      <div className="max-w-xs text-end">
                        <UnavailableDescription row={row} />
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </ProgramTable>
    </div>
  );
}

export function StockProgramPickerSkeleton({
  actionLabel,
  actionsLabel,
  statusLabel,
}: {
  actionLabel: string;
  actionsLabel?: string;
  statusLabel?: ReactNode;
}) {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const action = (
    <div className="relative min-w-0">
      <div className="invisible" aria-hidden="true">
        <Button size={cards ? 'sm' : 'xl'} width="shrink" disabled tabIndex={-1}>
          <span className="min-w-0 break-words whitespace-normal">{actionLabel}</span>
        </Button>
      </div>
      <div className="absolute inset-0">
        <Skeleton fill />
      </div>
    </div>
  );
  return (
    <div ref={measure} aria-busy>
      {cards ? (
        <CardListSkeleton
          count={2}
          rows={statusLabel ? 1 : 0}
          pagination={false}
          band={
            <>
              <SkeletonBar width="w-24" />
              {action}
            </>
          }
        />
      ) : (
        <ProgramTable statusLabel={statusLabel} actionsLabel={actionsLabel}>
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
                <div className="flex justify-end">{action}</div>
              </TableCell>
            </TableRow>
          ))}
        </ProgramTable>
      )}
    </div>
  );
}
