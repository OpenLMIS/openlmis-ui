import { SearchIcon, XIcon } from 'lucide-react';
import { useDataTableLabels } from '@/components/data-table/data-table-labels';
import { useDebouncedInput } from '@/components/data-table/use-debounced-input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';

type DataTableSearchProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name, when the placeholder alone does not say what is searched. */
  label?: string;
};

export function DataTableSearch({
  value,
  onValueChange,
  placeholder,
  label,
}: DataTableSearchProps) {
  const labels = useDataTableLabels();
  const { draft, commit, inputProps } = useDebouncedInput(value, onValueChange);
  const text = placeholder ?? labels.search;

  return (
    <div className="w-full sm:w-72">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={label ?? text}
          placeholder={text}
          type="text"
          {...inputProps}
        />
        {draft && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={labels.clearSearch}
              onClick={() => commit('')}
              size="icon-xs"
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}
