import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventForm } from '@/features/stock-events/hooks/use-event-form';
import { type EventLine, refreshStockEventLines } from '@/features/stock-events/lib/event-form';
import {
  createStockEventWriter,
  type StockEventSaveState,
} from '@/features/stock-events/lib/stock-event-autosave';
import {
  createStockEventContext,
  readStockEventDraft,
  type StockEventDraft,
  type StockEventSelection,
} from '@/features/stock-events/lib/stock-event-local';
import type { StockEventDisplay } from '@/features/stock-events/lib/stock-event-queue';
import type { EventStockCard, StockEvent } from '@/features/stock-events/lib/types';
import { announceDeviceSave } from '@/lib/device-save-announcement';
import { getSessionScope } from '@/lib/session-scope';

export function useStockEventAutosave(
  enabled: boolean,
  selection: StockEventSelection,
  form: EventForm,
  cards: readonly EventStockCard[] | undefined,
  today: string,
  generation: () => string | undefined = () => undefined,
) {
  const [state, setState] = useState<StockEventSaveState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const snapshots = useRef({ cards, today });
  snapshots.current = { cards, today };
  const [retryLoad, setRetryLoad] = useState(0);
  const opening = useRef(retryLoad);
  opening.current = retryLoad;
  const writer = useRef<ReturnType<typeof createStockEventWriter> | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoring = useRef(false);
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const { kind, facilityId, programId } = selection;
  const applyStoredLines = useCallback(
    (restored: EventLine[]) => {
      const currentCards = snapshots.current.cards;
      const lines = currentCards
        ? refreshStockEventLines(restored, currentCards, snapshots.current.today, kind)
        : restored;
      restoring.current = true;
      form.setFieldValue('lines', lines);
      restoring.current = false;
      return lines;
    },
    [form, kind],
  );
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
      if (next.status === 'failed') {
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
        const restored = draft?.lines ?? [];
        const lines = applyStoredLines(restored);
        const serial = createStockEventWriter(context, draft, onStatus, () =>
          generationRef.current(),
        );
        writer.current = serial;
        setState({ status: 'saved' });
        if (lines !== restored) serial.enqueue(lines);
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
      clearTimeout(timer.current);
      if (current()) writer.current?.start();
      active = false;
      subscription?.unsubscribe();
      writer.current = undefined;
    };
  }, [enabled, kind, facilityId, programId, form, retryLoad, applyStoredLines]);
  useEffect(() => {
    if (!enabled || !cards || !writer.current) return;
    const current = form.state.values.lines;
    const refreshed = refreshStockEventLines(current, cards, today, kind);
    if (refreshed !== current) form.setFieldValue('lines', refreshed);
  }, [enabled, cards, today, form, kind]);
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
    reload: () => setRetryLoad((value) => value + 1),
    retry: () => {
      if (writer.current) writer.current.retry();
      else setRetryLoad((value) => value + 1);
    },
    async flush() {
      clearTimeout(timer.current);
      return (await writer.current?.flush()) ?? true;
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
        return true;
      } finally {
        if (scope === getSessionScope() && serial === writer.current) setBusy(false);
      }
    },
    async submit(
      payload: StockEvent,
      display: StockEventDisplay,
      options?: { foreground?: boolean },
    ) {
      clearTimeout(timer.current);
      const serial = writer.current;
      if (!serial) throw new Error('The device draft is not ready');
      return serial.submit(payload, display, options);
    },
    async restore(copy: StockEventDraft) {
      clearTimeout(timer.current);
      const serial = writer.current;
      const scope = getSessionScope();
      if (!serial) return false;
      setBusy(true);
      try {
        const restored = await serial.restore(copy);
        if (!restored || scope !== getSessionScope() || serial !== writer.current) return false;
        const refreshed = applyStoredLines(restored.lines);
        if (refreshed !== restored.lines) serial.enqueue(refreshed);
        return true;
      } finally {
        if (scope === getSessionScope() && serial === writer.current) setBusy(false);
      }
    },
    async discard() {
      clearTimeout(timer.current);
      const serial = writer.current;
      const scope = getSessionScope();
      if (!serial) return true;
      if (!(await serial.discard())) return false;
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
        const restored = draft?.lines ?? [];
        const lines = applyStoredLines(restored);
        if (lines !== restored) serial.enqueue(lines);
        if (choice === 'copy') announceDeviceSave('stock-events.draft-copy-saved');
      } catch (error) {
        if (scope !== getSessionScope() || serial !== writer.current) return;
        setState({ status: 'conflict', error });
      }
    },
  };
}
