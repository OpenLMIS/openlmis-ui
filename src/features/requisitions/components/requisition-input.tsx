import type { ParseKeys } from 'i18next';
import { Fragment, memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { quantityValue, updateQuantityValue } from '@/components/form/quantity-value';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { QuantityUnit } from '@/lib/quantity';

export function RequisitionInput({
  name,
  label,
  value,
  kind,
  unit,
  netContent,
  cards,
  disabled,
  error,
  maxLength,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  kind: 'quantity' | 'count' | 'text';
  unit: QuantityUnit;
  netContent?: number | null;
  cards?: boolean;
  disabled: boolean;
  error?: ParseKeys;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(() => quantityValue(value, netContent));
  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    if (quantity.doses !== value) setQuantity(quantityValue(value, netContent));
  }
  const message = error ? t(error) : '';
  const shared = {
    'aria-invalid': !!error,
    'aria-describedby': error ? `${name}-error` : undefined,
    disabled,
  };
  const parts = unit === 'PACKS' ? (['packs', 'remainder'] as const) : (['doses'] as const);
  return (
    <Field spacing="tight" surface="background" data-invalid={!!error}>
      <div className="sr-only">
        <label id={`${name}-label`} htmlFor={name}>
          {label}
        </label>
        <span id={`${name}-error`}>{message}</span>
      </div>
      <Tooltip disabled={!error || cards} open={!!error && !cards && open} onOpenChange={setOpen}>
        <TooltipTrigger
          render={<div className="min-w-0" />}
          tabIndex={-1}
          onFocusCapture={() => setOpen(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
          }}
        >
          {kind === 'quantity' ? (
            <div
              dir="ltr"
              className={
                cards
                  ? 'flex min-w-0 items-center gap-1'
                  : 'flex w-full min-w-0 contain-inline-size items-center gap-1'
              }
            >
              {parts.map((part, index) => (
                <Fragment key={part}>
                  {unit === 'PACKS' && index === 1 && (
                    <span aria-hidden className="shrink-0 whitespace-nowrap">
                      {cards ? '+' : '( +'}
                    </span>
                  )}
                  {unit === 'PACKS' && (
                    <span className="sr-only" id={`${name}-${part}-label`}>
                      {t(part === 'packs' ? 'quantity-unit.packs' : 'quantity-unit.doses')}
                    </span>
                  )}
                  <div className={cards ? 'min-w-0 flex-1' : 'flex-auto'}>
                    <Input
                      {...shared}
                      id={index === 0 ? name : `${name}-${part}`}
                      name={`${name}.${part}`}
                      aria-labelledby={
                        unit === 'PACKS' ? `${name}-label ${name}-${part}-label` : `${name}-label`
                      }
                      autoComplete="off"
                      inputMode="numeric"
                      dir="ltr"
                      sizing={cards ? (unit === 'PACKS' ? 'full' : 'full-minimum') : 'minimum'}
                      controlSize="sm"
                      placeholder={t(
                        part === 'packs' ? 'quantity-unit.packs' : 'quantity-unit.doses',
                      )}
                      disabled={disabled || (part === 'remainder' && netContent === 1)}
                      value={part === 'remainder' && netContent === 1 ? '0' : quantity[part]}
                      onChange={(event) => {
                        const next = updateQuantityValue(
                          quantity,
                          part,
                          event.target.value,
                          netContent,
                        );
                        setQuantity(next);
                        onChange(next.doses);
                      }}
                    />
                  </div>
                </Fragment>
              ))}
              {unit === 'PACKS' && !cards && (
                <span aria-hidden className="shrink-0">
                  )
                </span>
              )}
            </div>
          ) : kind === 'text' ? (
            <Textarea
              {...shared}
              id={name}
              name={name}
              aria-label={label}
              dir="auto"
              maxLength={maxLength}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <Input
              {...shared}
              id={name}
              name={name}
              aria-label={label}
              autoComplete="off"
              dir="ltr"
              inputMode="numeric"
              controlSize={cards ? 'default' : 'sm'}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </TooltipTrigger>
        <ErrorContent message={message} />
      </Tooltip>
      {cards && error && <p className="text-destructive text-sm">{message}</p>}
    </Field>
  );
}
const ErrorContent = memo(function ErrorContent({ message }: { message: string }) {
  return <TooltipContent role="tooltip">{message}</TooltipContent>;
});
