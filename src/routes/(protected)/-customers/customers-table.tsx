import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronUpIcon,
  CopyIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { customersListOptions } from '@/features/customers/api/queries';
import {
  DEFAULT_DIR,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  PAGE_SIZES,
  type PageSize,
  PLAN_KEYS,
  PLAN_LABELS,
  type PlanKey,
  type SortDir,
  type SortKey,
  STATUS_KEYS,
  STATUS_LABELS,
  type StatusKey,
} from '@/features/customers/lib/schemas';
import type { Customer, CustomerPlan, CustomerStatus } from '@/features/customers/lib/types';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 250;

const route = getRouteApi('/(protected)/_protected/customers');

const STATUS_BADGE: Record<
  CustomerStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }
> = {
  Active: { variant: 'secondary', dot: 'bg-emerald-500' },
  Trial: { variant: 'secondary', dot: 'bg-sky-500' },
  'Past Due': { variant: 'secondary', dot: 'bg-amber-500' },
  Canceled: { variant: 'outline', dot: 'bg-muted-foreground' },
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function CustomersTable() {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const q = search.q ?? '';
  const statusKey = search.status;
  const planKey = search.plan;
  const sortKey: SortKey = search.sort ?? DEFAULT_SORT;
  const sortDir: SortDir = search.dir ?? DEFAULT_DIR;
  const pageSize: PageSize = search.size ?? DEFAULT_PAGE_SIZE;
  const pageIndex = search.page ?? 0;

  const statusLabel: CustomerStatus | undefined = statusKey ? STATUS_LABELS[statusKey] : undefined;
  const planLabel: CustomerPlan | undefined = planKey ? PLAN_LABELS[planKey] : undefined;

  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    const next = debouncedSearch.trim();
    if (next === q) return;
    navigate({
      search: (prev) => ({ ...prev, q: next || undefined, page: undefined }),
      replace: true,
    });
  }, [debouncedSearch, q, navigate]);

  const { data: customers } = useSuspenseQuery(customersListOptions);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return customers.filter((c) => {
      if (statusLabel && c.status !== statusLabel) return false;
      if (planLabel && c.plan !== planLabel) return false;
      if (needle) {
        const haystack = `${c.name} ${c.email} ${c.company}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [customers, q, statusLabel, planLabel]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = safePageIndex * pageSize;
  const pageRows = sorted.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    if (safePageIndex === pageIndex) return;
    navigate({
      search: (prev) => ({ ...prev, page: safePageIndex === 0 ? undefined : safePageIndex }),
      replace: true,
    });
  }, [safePageIndex, pageIndex, navigate]);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const someOnPageSelected = pageRows.some((r) => selected.has(r.id));

  function goToPage(page: number) {
    navigate({
      search: (prev) => ({ ...prev, page: page === 0 ? undefined : page }),
      replace: true,
    });
  }

  function toggleSort(key: SortKey) {
    let nextDir: SortDir;
    if (sortKey === key) {
      nextDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      nextDir = key === 'mrr' || key === 'joinedAt' ? 'desc' : 'asc';
    }
    navigate({
      search: (prev) => ({
        ...prev,
        sort: key === DEFAULT_SORT ? undefined : key,
        dir: nextDir === DEFAULT_DIR ? undefined : nextDir,
        page: undefined,
      }),
      replace: true,
    });
  }

  function togglePageSelection() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const r of pageRows) next.delete(r.id);
      } else {
        for (const r of pageRows) next.add(r.id);
      }
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card surface="background" padding="flush-bottom" className="@container/customers">
      <CardHeader>
        <CardTitle>Customers</CardTitle>
        <CardDescription>
          Manage subscriptions, monitor lifecycle stages, and act on at-risk accounts.
        </CardDescription>
        <CardAction>
          <Button aria-label="Add Customer">
            <PlusIcon data-icon="inline-start" />
            <span className="hidden @md/customers:inline">Add Customer</span>
          </Button>
        </CardAction>
      </CardHeader>

      <div className="flex flex-col gap-2 px-4 pb-3 @xl/customers:flex-row @xl/customers:flex-wrap @xl/customers:items-center">
        <ButtonGroup className="relative w-full @xl/customers:max-w-sm @xl/customers:flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, company..."
            hasLeadingIcon
          />
          {searchInput && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
            >
              <XIcon />
            </Button>
          )}
        </ButtonGroup>
        <ButtonGroup className="w-full @xl/customers:w-fit">
          <Select
            value={statusKey ?? 'all'}
            onValueChange={(v) => {
              if (!v) return;
              navigate({
                search: (prev) => ({
                  ...prev,
                  status: v === 'all' ? undefined : (v as StatusKey),
                  page: undefined,
                }),
                replace: true,
              });
            }}
          >
            <SelectTrigger
              className="flex-1 @xl/customers:flex-none"
              aria-label={`Filter by status: ${statusLabel ?? 'All'}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Status:</span>
                <span>{statusLabel ?? 'All'}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUS_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusKey && (
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                navigate({
                  search: (prev) => ({ ...prev, status: undefined, page: undefined }),
                  replace: true,
                })
              }
              aria-label="Clear status filter"
            >
              <XIcon />
            </Button>
          )}
        </ButtonGroup>
        <ButtonGroup className="w-full @xl/customers:w-fit">
          <Select
            value={planKey ?? 'all'}
            onValueChange={(v) => {
              if (!v) return;
              navigate({
                search: (prev) => ({
                  ...prev,
                  plan: v === 'all' ? undefined : (v as PlanKey),
                  page: undefined,
                }),
                replace: true,
              });
            }}
          >
            <SelectTrigger
              className="flex-1 @xl/customers:flex-none"
              aria-label={`Filter by plan: ${planLabel ?? 'All'}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Plan:</span>
                <span>{planLabel ?? 'All'}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {PLAN_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {PLAN_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {planKey && (
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                navigate({
                  search: (prev) => ({ ...prev, plan: undefined, page: undefined }),
                  replace: true,
                })
              }
              aria-label="Clear plan filter"
            >
              <XIcon />
            </Button>
          )}
        </ButtonGroup>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 @xl/customers:ml-auto">
            <Button className="flex-1 @xl/customers:flex-none">Export</Button>
            <Button variant="destructive" className="flex-1 @xl/customers:flex-none">
              <Trash2Icon data-icon="inline-start" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <CardContent padding="flush" className="flex flex-col">
        <Table>
          <TableHeader>
            <TableRow tone="header" interactive={false}>
              <TableHead gutter="start" className="w-16">
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={!allOnPageSelected && someOnPageSelected}
                  onCheckedChange={togglePageSelection}
                  aria-label="Select all rows on this page"
                />
              </TableHead>
              <SortableHead
                label="Customer"
                column="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                label="Company"
                column="company"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden @2xl/customers:table-cell"
              />
              <SortableHead
                label="Plan"
                column="plan"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden @md/customers:table-cell"
              />
              <SortableHead
                label="Status"
                column="status"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                label="MRR"
                column="mrr"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                align="right"
                className="hidden @xl/customers:table-cell"
              />
              <SortableHead
                label="Joined"
                column="joinedAt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                align="right"
                className="hidden @3xl/customers:table-cell"
              />
              <TableHead gutter="end" className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow interactive={false}>
                <TableCell colSpan={8} tone="muted" className="h-32 text-center">
                  No customers match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  selected={selected.has(customer.id)}
                  onToggle={() => toggleRow(customer.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="hidden text-muted-foreground @3xl/customers:inline">
              Rows per page
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                if (!v) return;
                const next = Number(v) as PageSize;
                navigate({
                  search: (prev) => ({
                    ...prev,
                    size: next === DEFAULT_PAGE_SIZE ? undefined : next,
                    page: undefined,
                  }),
                  replace: true,
                });
              }}
            >
              <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 hidden tabular-nums text-muted-foreground @3xl/customers:inline">
              {sorted.length === 0 ? (
                'No results'
              ) : (
                <>
                  Showing <span className="font-medium text-foreground">{pageStart + 1}</span>–
                  <span className="font-medium text-foreground">
                    {Math.min(pageStart + pageSize, sorted.length)}
                  </span>{' '}
                  of <span className="font-medium text-foreground">{sorted.length}</span>
                </>
              )}
            </span>
            <PaginationButton
              label="First page"
              icon={ChevronsLeftIcon}
              disabled={safePageIndex === 0}
              onClick={() => goToPage(0)}
            />
            <PaginationButton
              label="Previous page"
              icon={ChevronLeftIcon}
              disabled={safePageIndex === 0}
              onClick={() => goToPage(Math.max(0, safePageIndex - 1))}
            />
            <PaginationButton
              label="Next page"
              icon={ChevronRightIcon}
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => goToPage(Math.min(pageCount - 1, safePageIndex + 1))}
            />
            <PaginationButton
              label="Last page"
              icon={ChevronsRightIcon}
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => goToPage(pageCount - 1)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type SortableHeadProps = {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
};

function SortableHead({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
  className,
}: SortableHeadProps) {
  const active = sortKey === column;
  const SortIcon = active ? (sortDir === 'asc' ? ChevronUpIcon : ChevronDownIcon) : null;
  return (
    <TableHead className={className}>
      <div className={cn('flex items-center', align === 'right' && 'justify-end')}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSort(column)}
          className={align === 'right' ? '-mr-2' : '-ml-2'}
        >
          {label}
          {SortIcon && <SortIcon data-icon="inline-end" />}
        </Button>
      </div>
    </TableHead>
  );
}

function CustomerRow({
  customer,
  selected,
  onToggle,
}: {
  customer: Customer;
  selected: boolean;
  onToggle: () => void;
}) {
  const status = STATUS_BADGE[customer.status];
  return (
    <TableRow data-state={selected ? 'selected' : undefined}>
      <TableCell gutter="start" className="w-16">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${customer.name}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={customer.avatarUrl} alt="" />
            <AvatarFallback>{customer.avatarFallback}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{customer.name}</span>
            <span className="text-xs text-muted-foreground">{customer.email}</span>
          </div>
        </div>
      </TableCell>
      <TableCell size="sm" className="hidden @2xl/customers:table-cell">
        {customer.company}
      </TableCell>
      <TableCell className="hidden @md/customers:table-cell">
        <span className="text-sm font-medium">{customer.plan}</span>
      </TableCell>
      <TableCell>
        <Badge variant={status.variant} gap="sm">
          <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden="true" />
          {customer.status}
        </Badge>
      </TableCell>
      <TableCell
        size="sm"
        emphasis="medium"
        numeric
        className="hidden text-right @xl/customers:table-cell"
      >
        {customer.mrr === 0 ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          currencyFormatter.format(customer.mrr)
        )}
      </TableCell>
      <TableCell
        size="sm"
        tone="muted"
        numeric
        className="hidden text-right @3xl/customers:table-cell"
      >
        {dateFormatter.format(new Date(customer.joinedAt))}
      </TableCell>
      <TableCell gutter="end" className="w-16 text-right">
        <RowActions customer={customer} />
      </TableCell>
    </TableRow>
  );
}

function RowActions({ customer }: { customer: Customer }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Open actions for ${customer.name}`}
                />
              }
            />
          }
        >
          <MoreHorizontalIcon />
        </TooltipTrigger>
        <TooltipContent>Actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <EyeIcon data-icon="inline-start" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem>
            <PencilIcon data-icon="inline-start" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CopyIcon data-icon="inline-start" />
            Copy E-mail
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2Icon data-icon="inline-start" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PaginationButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof ChevronLeftIcon;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button size="icon-sm" variant="ghost" disabled={disabled} onClick={onClick} aria-label={label}>
      <Icon />
    </Button>
  );
}
