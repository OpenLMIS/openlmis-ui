import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** Draft for a text input that reports after a pause; an upstream change it did not cause replaces the draft. */
export function useDebouncedInput(
  value: string,
  onValueChange: (value: string) => void,
  delay = 300,
) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [lastEmitted, setLastEmitted] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<string | undefined>(undefined);
  const latestOnValueChange = useRef(onValueChange);

  useLayoutEffect(() => {
    latestOnValueChange.current = onValueChange;
  });

  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== lastEmitted) setDraft(value);
  }

  // Unmounting, e.g. a popover closing, sends a pending value instead of dropping it.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current !== undefined) latestOnValueChange.current(pending.current);
    },
    [],
  );

  const emit = (next: string) => {
    clearTimeout(timer.current);
    pending.current = undefined;
    setLastEmitted(next);
    latestOnValueChange.current(next);
  };

  const change = (next: string) => {
    setDraft(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => emit(next), delay);
  };

  const commit = (next: string) => {
    setDraft(next);
    emit(next);
  };

  // Leaving the field, e.g. to press Reset, sends what was typed first so nothing arrives after it.
  const flush = () => {
    if (pending.current !== undefined) emit(pending.current);
  };

  const inputProps = {
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
    onBlur: flush,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') commit(event.currentTarget.value);
    },
  };

  return { draft, commit, inputProps };
}
