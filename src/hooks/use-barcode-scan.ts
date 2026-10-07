import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { type Gs1Result, parseGs1 } from '@/lib/gs1/parse-gs1';
import {
  createScanCaptureState,
  reduceScanCapture,
  type ScanCaptureEvent,
} from '@/lib/gs1/scan-capture';
import { type ScanMessage, scanMessage } from '@/lib/scan-messages';

export type BarcodeScanStatus = {
  status: 'ready' | 'working' | 'accepted' | 'error';
  message?: ScanMessage;
};

type UseBarcodeScanOptions = {
  enabled: boolean;
  onScan: (
    result: Gs1Result,
    signal: AbortSignal,
  ) => void | ScanMessage | Promise<void> | Promise<ScanMessage | undefined>;
};
type FieldSnapshot = {
  field: HTMLInputElement | HTMLTextAreaElement;
  value: string;
  start: number | null;
  end: number | null;
  direction: 'forward' | 'backward' | 'none' | null;
};

function hasOpenDialog() {
  return (
    document.querySelector(
      '[role="dialog"]:not([data-closed]):not([hidden]):not([aria-hidden="true"]), ' +
        '[role="alertdialog"]:not([data-closed]):not([hidden]):not([aria-hidden="true"]), dialog[open]',
    ) !== null
  );
}

function snapshotField(): FieldSnapshot | undefined {
  const field = document.activeElement;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  if (field.readOnly || field.disabled) return;
  return {
    field,
    value: field.value,
    start: field.selectionStart,
    end: field.selectionEnd,
    direction: field.selectionDirection,
  };
}

function writeField(
  snapshot: FieldSnapshot,
  value: string,
  start = snapshot.start,
  end = snapshot.end,
) {
  const { field } = snapshot;
  if (!field.isConnected) return;
  const prototype =
    field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  if (snapshot.start !== null && start !== null && end !== null)
    field.setSelectionRange(start, end, snapshot.direction ?? undefined);
}

function rejectedMessage(error: unknown): ScanMessage {
  if (
    typeof error === 'object' &&
    error !== null &&
    'key' in error &&
    typeof error.key === 'string'
  ) {
    return error as ScanMessage;
  }
  return { key: 'scan.not-resolved' };
}

export function useBarcodeScan({ enabled, onScan }: UseBarcodeScanOptions): BarcodeScanStatus {
  const [status, setStatus] = useState<BarcodeScanStatus>({ status: 'ready' });
  const handleScan = useEffectEvent(onScan);
  const inFlight = useRef<
    Promise<Awaited<ReturnType<UseBarcodeScanOptions['onScan']>>> | undefined
  >(undefined);

  useEffect(() => {
    setStatus({ status: 'ready' });
    if (!enabled) return;
    const controller = new AbortController();
    let state = createScanCaptureState();
    let snapshot: FieldSnapshot | undefined;
    let captureTimer: ReturnType<typeof setTimeout> | undefined;
    let statusTimer: ReturnType<typeof setTimeout> | undefined;
    let listening = false;
    let working = false;
    let latest = 0;
    const queue: { result: Gs1Result; id: number }[] = [];

    function show(id: number, next: BarcodeScanStatus) {
      if (controller.signal.aborted || id !== latest) return;
      clearTimeout(statusTimer);
      setStatus(next);
      if (next.status === 'accepted' || next.status === 'error') {
        statusTimer = setTimeout(() => {
          if (!controller.signal.aborted && id === latest) setStatus({ status: 'ready' });
        }, 2500);
      }
    }

    function runHandler(result: Gs1Result) {
      return Promise.resolve(handleScan(result, controller.signal));
    }

    async function processQueue() {
      if (working || controller.signal.aborted || hasOpenDialog()) return;
      working = true;
      try {
        while (queue.length && !controller.signal.aborted && !hasOpenDialog()) {
          const entry = queue.shift();
          if (!entry) break;
          try {
            if (inFlight.current) await inFlight.current.catch(() => undefined);
            if (controller.signal.aborted) break;
            if (hasOpenDialog()) {
              queue.unshift(entry);
              break;
            }
            const operation = runHandler(entry.result);
            inFlight.current = operation;
            const message = await operation.finally(() => {
              if (inFlight.current === operation) inFlight.current = undefined;
            });
            show(
              entry.id,
              !entry.result.ok
                ? { status: 'error', message: scanMessage(entry.result.error) }
                : message
                  ? { status: 'error', message }
                  : { status: 'accepted' },
            );
          } catch (error) {
            show(entry.id, { status: 'error', message: rejectedMessage(error) });
          }
        }
      } finally {
        working = false;
      }
    }

    function apply(event: ScanCaptureEvent, keyboard?: KeyboardEvent) {
      const result = reduceScanCapture(state, event);
      state = result.state;
      for (const effect of result.effects) {
        switch (effect.type) {
          case 'suppress':
            keyboard?.preventDefault();
            keyboard?.stopImmediatePropagation();
            break;
          case 'snapshot-field':
            snapshot = snapshotField();
            break;
          case 'restore-field':
            if (snapshot) writeField(snapshot, snapshot.value);
            snapshot = undefined;
            break;
          case 'replay':
            if (snapshot) {
              const start = snapshot.start ?? snapshot.value.length;
              const end = snapshot.end ?? start;
              const value =
                snapshot.value.slice(0, start) + effect.text + snapshot.value.slice(end);
              writeField(snapshot, value, start + effect.text.length, start + effect.text.length);
            }
            snapshot = undefined;
            break;
          case 'schedule-timeout':
            clearTimeout(captureTimer);
            captureTimer = setTimeout(
              () => {
                if (hasOpenDialog()) {
                  syncListening();
                  return;
                }
                apply({ type: 'timeout', timeStamp: effect.at });
              },
              Math.max(0, effect.at - event.timeStamp),
            );
            break;
          case 'cancel-timeout':
            clearTimeout(captureTimer);
            break;
          case 'emit': {
            const parsed = parseGs1(effect.payload);
            const id = ++latest;
            show(
              id,
              parsed.ok
                ? { status: 'working' }
                : { status: 'error', message: scanMessage(parsed.error) },
            );
            queue.push({ result: parsed, id });
            void processQueue();
            break;
          }
        }
      }
    }

    function onKey(event: KeyboardEvent) {
      if (hasOpenDialog()) {
        syncListening();
        return;
      }
      apply(
        {
          type: event.type === 'keyup' ? 'keyup' : 'keydown',
          key: event.key,
          code: event.code,
          keyCode: event.keyCode,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          repeat: event.repeat,
          timeStamp: event.timeStamp,
        },
        event,
      );
    }

    function resetCapture() {
      clearTimeout(captureTimer);
      if (state.suppressing && snapshot) {
        const result = reduceScanCapture(state, {
          type: 'timeout',
          timeStamp: state.timeoutAt ?? 0,
        });
        for (const effect of result.effects) {
          if (effect.type === 'restore-field') writeField(snapshot, snapshot.value);
          if (effect.type === 'replay') {
            const start = snapshot.start ?? snapshot.value.length;
            const end = snapshot.end ?? start;
            writeField(
              snapshot,
              snapshot.value.slice(0, start) + effect.text + snapshot.value.slice(end),
              start + effect.text.length,
              start + effect.text.length,
            );
          }
        }
      }
      snapshot = undefined;
      state = createScanCaptureState();
    }

    function syncListening() {
      const next = !controller.signal.aborted && !hasOpenDialog();
      if (next === listening) return;
      listening = next;
      if (next) {
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('keyup', onKey, true);
        void processQueue();
      } else {
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('keyup', onKey, true);
        resetCapture();
      }
    }

    const observer = new MutationObserver(syncListening);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'data-open', 'data-closed', 'hidden', 'aria-hidden', 'open'],
    });
    syncListening();
    return () => {
      controller.abort();
      observer.disconnect();
      queue.length = 0;
      clearTimeout(statusTimer);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKey, true);
      resetCapture();
    };
  }, [enabled]);

  return status;
}
