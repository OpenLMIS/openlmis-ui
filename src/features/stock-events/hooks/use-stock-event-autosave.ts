import { useEffect, useRef, useState } from 'react';
import type { EventForm } from '@/features/stock-events/hooks/use-event-form';
import {
  createStockEventWriter,
  type StockEventSaveState,
} from '@/features/stock-events/lib/stock-event-autosave';
import {
  createStockEventContext,
  readStockEventDraft,
  type StockEventSelection,
} from '@/features/stock-events/lib/stock-event-local';
import { announceDeviceSave } from '@/lib/device-save-announcement';
import { getSessionScope } from '@/lib/session-scope';

export function useStockEventAutosave(
  enabled: boolean,
  selection: StockEventSelection,
  form: EventForm,
  generation: () => string | undefined = () => undefined,
) {
  const [state, setState] = useState<StockEventSaveState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [retryLoad, setRetryLoad] = useState(0);
  const opening = useRef(retryLoad);
  opening.current = retryLoad;
  const writer = useRef<ReturnType<typeof createStockEventWriter> | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoring = useRef(false);
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const { kind, facilityId, programId } = selection;
  useEffect(() => {
    if (!enabled) return;
    const context = createStockEventContext({ kind, facilityId, programId });
    let active = true;
    let failed = false;
    const attempt = retryLoad;
    const current = () =>
      active && opening.current === attempt && context.sessionScope === getSessionScope();
    let subscription: { unsubscribe: () => void } | undefined;
    writer.current = undefined;
    setState({ status: 'loading' });
    const onStatus = (next: StockEventSaveState) => {
      if (!current()) return;
      setState((previous) =>
        next.status === 'saving' ? { ...next, error: previous.error } : next,
      );
      if (next.status === 'failed' || next.status === 'conflict') {
        if (!failed) announceDeviceSave('stock-events.draft-failed');
        failed = true;
      } else if (next.status === 'saved' && failed) {
        failed = false;
        announceDeviceSave('stock-events.draft-saved');
      }
    };
    void readStockEventDraft(context)
      .then((draft) => {
        if (!current()) return;
        restoring.current = true;
        form.setFieldValue('lines', draft?.lines ?? []);
        restoring.current = false;
        const serial = createStockEventWriter(context, draft, onStatus, () =>
          generationRef.current(),
        );
        writer.current = serial;
        setState({ status: 'saved' });
        let previous = form.state.values.lines;
        subscription = form.store.subscribe((value) => {
          if (value.values.lines === previous) return;
          previous = value.values.lines;
          if (restoring.current) return;
          clearTimeout(timer.current);
          serial.stage(previous);
          timer.current = setTimeout(() => serial.start(), 350);
        });
      })
      .catch((error: unknown) => {
        onStatus({ status: 'failed', error });
      });
    return () => {
      active = false;
      clearTimeout(timer.current);
      subscription?.unsubscribe();
      writer.current = undefined;
    };
  }, [enabled, kind, facilityId, programId, form, retryLoad]);
  return {
    ...state,
    busy,
    protected:
      enabled &&
      writer.current !== undefined &&
      state.status !== 'saved' &&
      state.status !== 'loading',
    readFailed: enabled && state.status === 'failed' && writer.current === undefined,
    loading: enabled && (state.status === 'loading' || !writer.current),
    retry: () => {
      if (writer.current) writer.current.retry();
      else setRetryLoad((value) => value + 1);
    },
    async flush() {
      clearTimeout(timer.current);
      return (await writer.current?.flush()) ?? false;
    },
    async clear(keys: Set<string>) {
      clearTimeout(timer.current);
      const lines = form.state.values.lines.filter((line) => !keys.has(line.key));
      const serial = writer.current;
      const scope = getSessionScope();
      if (!serial) return;
      setBusy(true);
      try {
        if (!(await serial.replace(lines))) return;
        if (scope !== getSessionScope() || serial !== writer.current) return;
        restoring.current = true;
        form.setFieldValue('lines', lines);
        restoring.current = false;
      } finally {
        if (scope === getSessionScope() && serial === writer.current) setBusy(false);
      }
    },
    async discard() {
      clearTimeout(timer.current);
      const serial = writer.current;
      const scope = getSessionScope();
      if (!serial || !(await serial.discard())) return false;
      if (scope !== getSessionScope() || serial !== writer.current) return false;
      restoring.current = true;
      form.setFieldValue('lines', []);
      restoring.current = false;
      return true;
    },
    async resolve(choice: 'load' | 'copy') {
      clearTimeout(timer.current);
      const serial = writer.current;
      const scope = getSessionScope();
      if (!serial) return;
      try {
        const draft = await serial.resolve(choice);
        if (scope !== getSessionScope() || serial !== writer.current) return;
        restoring.current = true;
        form.setFieldValue('lines', draft?.lines ?? []);
        restoring.current = false;
        if (choice === 'copy') announceDeviceSave('stock-events.draft-copy-saved');
      } catch (error) {
        if (scope !== getSessionScope() || serial !== writer.current) return;
        setState({ status: 'conflict', error });
        announceDeviceSave('stock-events.draft-failed');
      }
    },
  };
}
