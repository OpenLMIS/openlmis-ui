import type { RowData } from '@tanstack/react-table';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';
import { type ReactNode, useId } from 'react';
import type { DataTableInstance } from '@/components/data-table/data-table';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const PAGE_SIZE_ITEMS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: size,
  label: String(size),
}));

export function DataTablePagination<TData extends RowData>({
  table,
}: {
  table: DataTableInstance<TData>;
}) {
  const labels = useDataTableLabels();
  const pageSizeId = useId();
  const { pageIndex, pageSize } = table.state.pagination;
  const total = table.getRowCount();
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);
  const canPrevious = table.getCanPreviousPage();
  const canNext = table.getCanNextPage();

  const controls = [
    { label: labels.firstPage, icon: ChevronsLeftIcon, enabled: canPrevious, go: table.firstPage },
    {
      label: labels.previousPage,
      icon: ChevronLeftIcon,
      enabled: canPrevious,
      go: table.previousPage,
    },
    { label: labels.nextPage, icon: ChevronRightIcon, enabled: canNext, go: table.nextPage },
    { label: labels.lastPage, icon: ChevronsRightIcon, enabled: canNext, go: table.lastPage },
  ];

  return (
    <PaginationLayout
      controls={
        <div className="flex items-center gap-1">
          {controls.map(({ label, icon: Icon, enabled, go }) => (
            <Button
              aria-label={label}
              disabled={!enabled}
              key={label}
              onClick={() => go()}
              size="icon-sm"
              variant="outline"
            >
              <Icon className="rtl:rotate-180" />
            </Button>
          ))}
        </div>
      }
      pageSize={
        <div className="flex items-center gap-2">
          {/* Screen readers still get the label on phones, where there is no room to show it. */}
          <label className="sr-only text-muted-foreground sm:not-sr-only" htmlFor={pageSizeId}>
            {labels.rowsPerPage}
          </label>
          <Select
            items={PAGE_SIZE_ITEMS}
            onValueChange={(value) => {
              if (value !== null) table.setPageSize(value);
            }}
            value={pageSize}
          >
            <SelectTrigger id={pageSizeId} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {PAGE_SIZE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      range={
        <p aria-live="polite" className="whitespace-nowrap text-muted-foreground tabular-nums">
          {labels.range(from, to, total)}
        </p>
      }
    />
  );
}

/** Placeholder with the pagination's own layout, so the footer keeps its height while loading. */
export function DataTablePaginationSkeleton() {
  return (
    <PaginationLayout
      controls={<SkeletonBlock className="h-7 w-32" />}
      pageSize={<SkeletonBlock className="h-7 w-16 sm:w-36" />}
      range={<SkeletonBlock className="h-5 w-20" />}
    />
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={className}>
      <Skeleton fill />
    </div>
  );
}

type PaginationLayoutProps = {
  pageSize: ReactNode;
  range: ReactNode;
  controls: ReactNode;
};

function PaginationLayout({ pageSize, range, controls }: PaginationLayoutProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      {pageSize}
      {/* On phones the range sits above the buttons, since the two do not fit side by side. */}
      <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
        {range}
        {controls}
      </div>
    </div>
  );
}
