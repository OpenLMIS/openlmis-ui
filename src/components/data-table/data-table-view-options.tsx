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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type DataTableViewColumn = {
  id: string;
  label: string;
};

type DataTableViewOptionsProps = {
  /** The columns a user may hide; leave out ones that must always show, such as actions. */
  columns: DataTableViewColumn[];
  visibility: ColumnVisibilityState;
  onVisibilityChange: (visibility: ColumnVisibilityState) => void;
  /** Returns every column to its default, e.g. the one suited to the screen size. */
  onReset?: () => void;
};

export function DataTableViewOptions({
  columns,
  visibility,
  onVisibilityChange,
  onReset,
}: DataTableViewOptionsProps) {
  const labels = useDataTableLabels();
  const isVisible = (id: string) => visibility[id] !== false;
  const visibleCount = columns.filter((column) => isVisible(column.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" width="mobile-full" />}>
        <Settings2Icon data-icon="inline-start" />
        {labels.view}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" width="auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{labels.toggleColumns}</DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              checked={isVisible(column.id)}
              // An empty table is never what anyone wants, so the last column stays.
              disabled={isVisible(column.id) && visibleCount === 1}
              key={column.id}
              onCheckedChange={(checked) =>
                onVisibilityChange({ ...visibility, [column.id]: checked })
              }
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {onReset && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReset} variant="destructive">
              {labels.resetColumns}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
