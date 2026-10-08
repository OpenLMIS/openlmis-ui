import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

export function useDebouncedInput(
  value: string,
  onValueChange: (value: string) => void,
  { delay = 300, resetKey }: { delay?: number; resetKey?: string | number } = {},
) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState({ value, resetKey });
  const emittedValue = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<string | undefined>(undefined);
  const latestOnValueChange = useRef(onValueChange);

  useLayoutEffect(() => {
    latestOnValueChange.current = onValueChange;
  });

  if (value !== synced.value || resetKey !== synced.resetKey) {
    setSynced({ value, resetKey });
    if (value.trim() !== emittedValue.current?.trim()) setDraft(value);
  }

  useLayoutEffect(() => {
    if (synced.value.trim() !== emittedValue.current?.trim()) {
      clearTimeout(timer.current);
      pending.current = undefined;
    }
    emittedValue.current = undefined;
  }, [synced]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const emit = (next: string) => {
    clearTimeout(timer.current);
    pending.current = undefined;
    emittedValue.current = next;
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

  const flush = () => {
    if (pending.current !== undefined) emit(pending.current);
  };

  const inputProps = {
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
    onBlur: flush,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commit(event.currentTarget.value);
    },
  };

  return { draft, commit, inputProps };
}
