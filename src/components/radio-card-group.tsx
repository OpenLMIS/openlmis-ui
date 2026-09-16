import type { LucideIcon } from 'lucide-react';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type RadioCardOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
};

export type RadioCardGroupProps<T extends string> = {
  name: string;
  value: T | '';
  onChange: (next: T) => void;
  options: readonly RadioCardOption<T>[];
  columns?: 1 | 2 | 3;
  ariaInvalid?: boolean;
  className?: string;
};

/*
  Card-style radio group - each option renders as a bordered selection
  card that gets a primary-tinted border + background when checked.
  Uses the shadcn `FieldLabel has-data-checked:*` hooks so the whole
  card becomes a single click/tap target without needing extra DOM.
*/
export function RadioCardGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 1,
  ariaInvalid,
  className,
}: RadioCardGroupProps<T>) {
  const columnClass =
    columns === 3
      ? 'grid @sm/field-group:grid-cols-2 @md/field-group:grid-cols-3'
      : columns === 2
        ? 'grid @md/field-group:grid-cols-2'
        : 'flex flex-col';

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      aria-invalid={ariaInvalid}
      gap="md"
      className={cn(columnClass, className)}
    >
      {options.map((option) => {
        const inputId = `${name}-${option.value}`;
        const Icon = option.icon;
        return (
          <FieldLabel
            key={option.value}
            htmlFor={inputId}
            interactive
            className="h-full cursor-pointer"
          >
            <Field orientation="horizontal">
              <RadioGroupItem id={inputId} value={option.value} aria-invalid={ariaInvalid} />
              <FieldContent>
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
                {option.description && <FieldDescription>{option.description}</FieldDescription>}
              </FieldContent>
            </Field>
          </FieldLabel>
        );
      })}
    </RadioGroup>
  );
}
