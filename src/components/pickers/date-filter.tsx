import { useRouter } from '@tanstack/react-router';
import { type ComponentProps, use, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableFilterFlushContext,
  DataTableFilterResetContext,
} from '@/components/data-table/data-table-filters-popover';
import { formatDateText, parseEditableDate } from '@/components/form/date-value';
import { DatePicker } from '@/components/form/form-fields';
import { useDateFormat } from '@/components/form/form-messages';
import { FieldError } from '@/components/ui/field';

type DateFilterProps = Pick<
  ComponentProps<typeof DatePicker>,
  'id' | 'label' | 'value' | 'earliest' | 'latest' | 'clearLabel' | 'disabled' | 'size'
> & { onValueChange: (value: string) => void };

function dateFilterError(value: string, earliest?: string, latest?: string) {
  if (!value) return;
  if (!parseEditableDate(value)) return { key: 'form.date-invalid' } as const;
  if (earliest && value < earliest) return { key: 'form.date-too-early', bound: earliest } as const;
  if (latest && value > latest) return { key: 'form.date-too-late', bound: latest } as const;
}

export function DateFilter({ value, onValueChange, earliest, latest, ...props }: DateFilterProps) {
  const { t } = useTranslation();
  const dateFormat = useDateFormat();
  const { id } = props;
  const router = useRouter({ warn: false });
  const flushers = use(DataTableFilterFlushContext);
  const reset = use(DataTableFilterResetContext);
  const [draft, setDraft] = useState<string>();
  const [showError, setShowError] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const pending = useRef<string | undefined>(undefined);
  const applied = useRef(value);

  const discard = useCallback(() => {
    pending.current = undefined;
    reset?.setPending(id, false);
    setDraft(undefined);
    setShowError(false);
    setResetKey((key) => key + 1);
  }, [id, reset]);

  useLayoutEffect(() => {
    if (applied.current !== value) discard();
    applied.current = value;
  }, [discard, value]);

  const apply = useCallback(
    (next: string) => {
      pending.current = undefined;
      reset?.setPending(id, false);
      setDraft(next === value ? undefined : next);
      setShowError(false);
      if (next !== applied.current) {
        applied.current = next;
        onValueChange(next);
      }
    },
    [id, onValueChange, reset, value],
  );

  const commit = useCallback(
    (closing: boolean) => {
      const next = pending.current;
      if (next === undefined) return;
      if (!dateFilterError(next, earliest, latest)) apply(next);
      else if (closing) discard();
      else setShowError(true);
    },
    [apply, discard, earliest, latest],
  );

  useLayoutEffect(() => {
    const flush = () => commit(true);
    flushers?.add(flush);
    return () => {
      flushers?.delete(flush);
    };
  }, [commit, flushers]);

  useLayoutEffect(() => {
    reset?.resetters.add(discard);
    return () => {
      reset?.resetters.delete(discard);
      reset?.setPending(id, false);
    };
  }, [discard, id, reset]);

  useLayoutEffect(
    () =>
      router?.history.subscribe(({ action }) => {
        if (action.type === 'BACK' || action.type === 'FORWARD' || action.type === 'GO') discard();
      }),
    [discard, router],
  );

  const error = showError && draft !== undefined && dateFilterError(draft, earliest, latest);
  const errorId = `${id}-error`;

  return (
    <div>
      <DatePicker
        {...props}
        describedBy={error ? errorId : undefined}
        earliest={earliest}
        invalid={error ? true : undefined}
        latest={latest}
        onEnter={() => commit(false)}
        onLeave={() => commit(false)}
        onTextChange={(next) => {
          pending.current = next;
          reset?.setPending(id, true);
          setDraft(next);
        }}
        onValueChange={apply}
        resetKey={resetKey}
        value={draft ?? value}
      />
      {error && (
        <FieldError id={errorId}>
          {error.key === 'form.date-invalid'
            ? t(error.key)
            : t(error.key, { date: formatDateText(error.bound, dateFormat) })}
        </FieldError>
      )}
    </div>
  );
}
