import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/*
  Composed date picker - there is no standalone shadcn `DatePicker`
  component; the docs recommend this Popover + Calendar + Button recipe
  and we implement it once here so every form consumes the same
  keyboard behavior, focus handling, and error styling.

  Value contract - the field stores an ISO YYYY-MM-DD string, not a
  Date object. Rationale:
    - JSON-serialisable (survives form submit as-is).
    - Sorts lexicographically - cross-field rules like
      `dueDate >= startDate` become plain string comparisons.
    - Immune to accidental UTC round-trips via Date.toISOString().

  Parse for display with `parseISO` (treats the string as local
  midnight) and serialise with `format(d, 'yyyy-MM-dd')` (reads local
  components). Using `new Date(value)` or `d.toISOString().slice(0,10)`
  would drift by a day in timezones west of UTC.
*/

export type DateFieldProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: Matcher | Matcher[];
  placeholder?: string;
  ariaInvalid?: boolean;
  className?: string;
};

const DISPLAY_FORMAT = 'PPP';
const STORAGE_FORMAT = 'yyyy-MM-dd';

export function DateField({
  id,
  value,
  onChange,
  disabled,
  placeholder = 'Pick a date',
  ariaInvalid,
  className,
}: DateFieldProps) {
  const parsed = value ? parseISO(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="field"
            data-empty={!value}
            aria-invalid={ariaInvalid}
            className={cn('w-full justify-start', className)}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {parsed ? format(parsed, DISPLAY_FORMAT) : <span>{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent padding="none" className="w-auto" align="start" side="bottom">
        <Calendar
          mode="single"
          selected={parsed}
          onSelect={(next) => onChange(next ? format(next, STORAGE_FORMAT) : '')}
          disabled={disabled}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
