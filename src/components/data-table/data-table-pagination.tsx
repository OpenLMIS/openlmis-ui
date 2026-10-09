import type { RowData } from '@tanstack/react-table';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleAlertIcon,
} from 'lucide-react';
import { type ReactNode, useId } from 'react';
import type { DataTableInstance } from '@/components/data-table/data-table';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const PAGE_SIZE_ITEMS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: size,
  label: String(size),
}));

export function DataTablePagination<TData extends RowData>({
  table,
  disabled = false,
  isPageInvalid,
}: {
  table: DataTableInstance<TData>;
  disabled?: boolean;
  isPageInvalid?: (pageIndex: number) => boolean;
}) {
  const labels = useDataTableLabels();
  const pageSizeId = useId();
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const pages = Array.from({ length: 7 }, (_, offset) => pageIndex - 3 + offset).filter(
    (page) => page >= 0 && page < pageCount,
  );
  const pageSizeItems = DEFAULT_PAGE_SIZE_OPTIONS.includes(pageSize)
    ? PAGE_SIZE_ITEMS
    : [...PAGE_SIZE_ITEMS, { value: pageSize, label: String(pageSize) }].sort(
        (a, b) => a.value - b.value,
      );
  const total = table.getRowCount();
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);
  const canPrevious = !disabled && table.getCanPreviousPage();
  const canNext = !disabled && table.getCanNextPage();

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
          {controls.slice(0, 2).map(({ label, icon: Icon, enabled, go }) => (
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
          {pages.map((page) => (
            <div
              className={cn('tabular-nums', page !== pageIndex && 'hidden @md/table:block')}
              key={page}
            >
              <Button
                aria-current={page === pageIndex ? 'page' : undefined}
                aria-label={
                  isPageInvalid?.(page)
                    ? `${labels.page(page + 1)}: ${labels.invalidPage}`
                    : labels.page(page + 1)
                }
                disabled={disabled}
                onClick={() => {
                  if (page !== pageIndex) table.setPageIndex(page);
                }}
                size="sm"
                variant={page === pageIndex ? 'default' : 'outline'}
              >
                {page + 1}
                {isPageInvalid?.(page) && (
                  <span className="text-destructive">
                    <CircleAlertIcon aria-hidden data-icon="inline-end" />
                  </span>
                )}
              </Button>
            </div>
          ))}
          {controls.slice(2).map(({ label, icon: Icon, enabled, go }) => (
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
          <label
            className="sr-only text-muted-foreground @md/table:not-sr-only"
            htmlFor={pageSizeId}
          >
            {labels.rowsPerPage}
          </label>
          <Select
            disabled={disabled}
            items={pageSizeItems}
            onValueChange={(value) => {
              if (value !== null) table.setPageSize(value);
            }}
            value={pageSize}
          >
            <SelectTrigger id={pageSizeId} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {pageSizeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      }
      range={
        <p
          aria-live="polite"
          className="sr-only whitespace-nowrap text-muted-foreground tabular-nums @md/table:not-sr-only"
        >
          {labels.range(from, to, total)}
        </p>
      }
    />
  );
}

export function DataTablePaginationSkeleton() {
  return (
    <PaginationLayout
      controls={<SkeletonBlock className="h-7 w-40 @md/table:w-96" />}
      pageSize={<SkeletonBlock className="h-7 w-16 @md/table:w-36" />}
      range={
        <div className="hidden @md/table:block">
          <SkeletonBlock className="h-5 w-20" />
        </div>
      }
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
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {pageSize}
      <div className="ms-auto flex flex-wrap items-center justify-end gap-3">
        {range}
        {controls}
      </div>
    </div>
  );
}
