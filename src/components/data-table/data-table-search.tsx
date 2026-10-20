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
  resetKey?: string | number;
  /** Accessible name, when the placeholder alone does not say what is searched. */
  label?: string;
  id?: string;
  maxLength?: number;
  disabled?: boolean;
  size?: 'default' | 'lg';
};

export function DataTableSearch({
  value,
  onValueChange,
  placeholder,
  resetKey,
  label,
  id,
  maxLength,
  disabled,
  size = 'default',
}: DataTableSearchProps) {
  const labels = useDataTableLabels();
  const { draft, commit, inputProps } = useDebouncedInput(value, onValueChange, { resetKey });
  const text = placeholder ?? labels.search;

  return (
    <div className="w-full">
      <InputGroup size={size}>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={id ? undefined : (label ?? text)}
          disabled={disabled}
          id={id}
          maxLength={maxLength}
          placeholder={text}
          type="text"
          {...inputProps}
        />
        {draft && !disabled && (
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
