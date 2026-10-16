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
  /** The columns a user may hide; leave out the identifying column and actions, which always show. */
  columns: DataTableViewColumn[];
  disabled?: boolean;
  visibility: ColumnVisibilityState;
  onVisibilityChange: (visibility: ColumnVisibilityState) => void;
  /** Returns every column to its default, e.g. the one suited to the screen size. */
  onReset?: () => void;
  layout?: 'table' | 'cards';
};

export function DataTableViewOptions({
  columns,
  disabled,
  visibility,
  onVisibilityChange,
  onReset,
  layout = 'table',
}: DataTableViewOptionsProps) {
  const labels = useDataTableLabels();
  const isVisible = (id: string) => visibility[id] !== false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" width="full" disabled={disabled} />}>
        <Settings2Icon data-icon="inline-start" />
        {labels.view}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" width="auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {layout === 'cards' ? labels.toggleDetails : labels.toggleColumns}
          </DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              checked={isVisible(column.id)}
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
              {layout === 'cards' ? labels.resetDetails : labels.resetColumns}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
