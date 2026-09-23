import { useDataTableLabels } from '@/components/data-table/data-table-labels';
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
  /** Shown muted before the selected option, e.g. "Status: All". */
  label: string;
  /** An empty string means no filter. */
  value: string;
  onValueChange: (value: string) => void;
  options: DataTableSelectFilterOption[];
};

/** A toolbar dropdown that narrows the rows to one value, or shows them all. */
export function DataTableSelectFilter({
  label,
  value,
  onValueChange,
  options,
}: DataTableSelectFilterProps) {
  const labels = useDataTableLabels();
  const items = [{ value: '', label: labels.all }, ...options];

  return (
    <Select items={items} onValueChange={(next) => onValueChange(next ?? '')} value={value}>
      <SelectTrigger width="full">
        <span className="flex min-w-0 items-center gap-1">
          <span className="text-muted-foreground">{label}:</span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
