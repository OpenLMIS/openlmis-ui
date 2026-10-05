import { XIcon } from 'lucide-react';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DataTableSelectFilterOption = {
  value: string;
  label: string;
};

type DataTableSelectFilterProps = {
  /** Shown muted, alone while nothing is picked and before the pick after, e.g. "Status: Active". */
  label: string;
  /** An empty string means no filter. */
  value: string;
  onValueChange: (value: string) => void;
  options: DataTableSelectFilterOption[];
};

/** A toolbar dropdown that narrows the rows to one value, with a button to clear it. */
export function DataTableSelectFilter({
  label,
  value,
  onValueChange,
  options,
}: DataTableSelectFilterProps) {
  const labels = useDataTableLabels();

  return (
    <div className="relative">
      <Select
        items={options}
        onValueChange={(next) => onValueChange(next ?? '')}
        value={value || null}
      >
        <SelectTrigger width="full">
          <span className="flex min-w-0 items-center gap-1 pe-8">
            {value ? (
              <>
                <span className="shrink-0 text-muted-foreground">{label}:</span>
                <span className="min-w-0 truncate">
                  <SelectValue />
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{label}</span>
            )}
          </span>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* A sibling of the trigger, not inside it, since a button cannot hold another button. */}
      {value && (
        <div className="absolute inset-y-0 end-7 flex items-center">
          <Button
            aria-label={labels.clearFilter(label)}
            onClick={() => onValueChange('')}
            size="icon-xs"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </div>
      )}
    </div>
  );
}

type DataTableComboboxFilterOption = DataTableSelectFilterOption & {
  description?: string;
};

type DataTableComboboxFilterProps = {
  label: string;
  /** An empty string means no filter. */
  value: string;
  onValueChange: (value: string) => void;
  options: DataTableComboboxFilterOption[];
  limit?: number;
  /** Searches the server with the typed text; the options are then listed as given, unfiltered. */
  onSearch?: (text: string) => void;
  /** Shown when there is nothing to list; "No Matches" by default. */
  emptyMessage?: string;
  onOpenChange?: (open: boolean) => void;
};

export function DataTableComboboxFilter({
  label,
  value,
  onValueChange,
  options,
  limit = 50,
  onSearch,
  emptyMessage,
  onOpenChange,
}: DataTableComboboxFilterProps) {
  const labels = useDataTableLabels();
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      filter={onSearch ? null : undefined}
      isItemEqualToValue={(item, picked) => item.value === picked.value}
      itemToStringLabel={(item) => item.label}
      items={options}
      limit={limit}
      onInputValueChange={onSearch && ((text) => onSearch(text))}
      onOpenChange={onOpenChange && ((open) => onOpenChange(open))}
      onValueChange={(item) => onValueChange(item?.value ?? '')}
      value={selected}
    >
      <ComboboxInput
        aria-label={label}
        clearLabel={labels.clearFilter(label)}
        placeholder={label}
        showClear={selected !== null}
        width="full"
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyMessage ?? labels.noMatches}</ComboboxEmpty>
        <ComboboxList>
          {(option: DataTableComboboxFilterOption) => (
            <ComboboxItem key={option.value} value={option}>
              <span className="min-w-0 truncate">{option.label}</span>
              {option.description && (
                <span className="ms-auto shrink-0 text-muted-foreground text-xs">
                  {option.description}
                </span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
