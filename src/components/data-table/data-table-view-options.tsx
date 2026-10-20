import type { ColumnVisibilityState } from '@tanstack/react-table';
import { Settings2Icon } from 'lucide-react';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type DataTableViewColumn = {
  id: string;
  label: string;
};

export type DataTableViewSortValue = { id: string; desc: boolean };

export type DataTableViewSort = {
  columns: DataTableViewColumn[];
  value: DataTableViewSortValue;
  onValueChange: (value: DataTableViewSortValue) => void;
};

type DataTableViewOptionsProps = {
  /** The columns a user may hide; leave out the identifying column and actions, which always show. */
  columns?: DataTableViewColumn[];
  disabled?: boolean;
  visibility?: ColumnVisibilityState;
  onVisibilityChange?: (visibility: ColumnVisibilityState) => void;
  /** Returns every column to its default, e.g. the one suited to the screen size. */
  onReset?: () => void;
  layout?: 'table' | 'cards';
  sort?: DataTableViewSort;
  size?: 'default' | 'lg';
};

const NO_COLUMNS: DataTableViewColumn[] = [];
const ALL_VISIBLE: ColumnVisibilityState = {};

export function DataTableViewOptions({
  columns = NO_COLUMNS,
  disabled,
  visibility = ALL_VISIBLE,
  onVisibilityChange,
  onReset,
  layout = 'table',
  sort,
  size = 'default',
}: DataTableViewOptionsProps) {
  const labels = useDataTableLabels();
  const isVisible = (id: string) => visibility[id] !== false;
  const sorting = layout === 'cards' && sort && sort.columns.length > 0 ? sort : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button disabled={disabled} size={size} variant="outline" width="full" />}
      >
        <Settings2Icon data-icon="inline-start" />
        {labels.view}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" width="auto">
        {sorting && (
          <>
            <DropdownMenuRadioGroup
              onValueChange={(id: string) => sorting.onValueChange({ ...sorting.value, id })}
              value={sorting.value.id}
            >
              <DropdownMenuLabel>{labels.sortBy}</DropdownMenuLabel>
              {sorting.columns.map((column) => (
                <DropdownMenuRadioItem key={column.id} value={column.id}>
                  {column.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              onValueChange={(order: string) =>
                sorting.onValueChange({ ...sorting.value, desc: order === 'desc' })
              }
              value={sorting.value.desc ? 'desc' : 'asc'}
            >
              <DropdownMenuLabel>{labels.sortOrder}</DropdownMenuLabel>
              <DropdownMenuRadioItem value="asc">{labels.ascending}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">{labels.descending}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            {columns.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        {columns.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {layout === 'cards' ? labels.toggleDetails : labels.toggleColumns}
            </DropdownMenuLabel>
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                checked={isVisible(column.id)}
                key={column.id}
                onCheckedChange={(checked) =>
                  onVisibilityChange?.({ ...visibility, [column.id]: checked })
                }
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        )}
        {onReset && columns.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReset} variant="destructive">
              {layout === 'cards' ? labels.resetDetails : labels.resetColumns}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
