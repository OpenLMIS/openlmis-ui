import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBarcodeScan } from '@/hooks/use-barcode-scan';
import { scanMessage } from '@/lib/scan-messages';

const BARCODE = '0109506000134352';
let time = 1000;
function key(key: string, type = 'keydown', target: EventTarget = document) {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'timeStamp', { value: time });
  target.dispatchEvent(event);
  return event;
}
function scan(payload = BARCODE) {
  for (const character of payload) {
    key(character);
    time += 5;
  }
  const enter = key('Enter');
  key('Enter', 'keyup');
  time += 5;
  return enter;
}
async function settle() {
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers();
  time = 1000;
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('useBarcodeScan', () => {
  it('captures a burst, parses it, suppresses its suffix and resets accepted status', async () => {
    const onScan = vi.fn();
    const { result } = renderHook(() => useBarcodeScan({ enabled: true, onScan }));
    let enter: KeyboardEvent | undefined;
    act(() => {
      enter = scan();
    });
    await settle();
    expect(enter?.defaultPrevented).toBe(true);
    expect(onScan).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, gtin: '09506000134352' }),
      expect.any(AbortSignal),
    );
    expect(result.current.status).toBe('accepted');
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.status).toBe('ready');
  });

  it('leaves ordinary typing untouched', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScan({ enabled: true, onScan }));
    act(() => {
      for (const character of 'normal') {
        expect(key(character).defaultPrevented).toBe(false);
        time += 100;
      }
      expect(key('Enter').defaultPrevented).toBe(false);
      vi.advanceTimersByTime(500);
    });
    expect(onScan).not.toHaveBeenCalled();
  });

  it('restores a controlled focused field and its selection after leaked characters', async () => {
    function Field() {
      const [value, setValue] = useState('draft');
      useBarcodeScan({ enabled: true, onScan: vi.fn() });
      return (
        <input
          aria-label="Draft"
          onChange={(event) => setValue(event.target.value)}
          value={value}
        />
      );
    }
    render(<Field />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(1, 3);
    act(() => {
      key('0', 'keydown', input);
      fireEvent.input(input, { target: { value: 'd0ft' } });
      time += 5;
      key('1', 'keydown', input);
      fireEvent.input(input, { target: { value: 'd01ft' } });
      time += 5;
      scan(BARCODE.slice(2));
    });
    await settle();
    expect(input).toHaveValue('draft');
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(3);
    fireEvent.input(input, { target: { value: 'next' } });
    expect(input).toHaveValue('next');
  });

  it('replays a short suppressed burst without duplicating leaked characters', () => {
    renderHook(() => useBarcodeScan({ enabled: true, onScan: vi.fn() }));
    const input = document.createElement('textarea');
    document.body.append(input);
    input.value = 'draft';
    input.focus();
    input.setSelectionRange(1, 3);
    act(() => {
      key('a');
      input.value = 'daft';
      time += 5;
      key('b');
      input.value = 'dabft';
      time += 5;
      key('c');
      vi.advanceTimersByTime(300);
    });
    expect(input.value).toBe('dabcft');
    input.remove();
  });

  it('replays short numeric typing without trying to set an unsupported selection', () => {
    renderHook(() => useBarcodeScan({ enabled: true, onScan: vi.fn() }));
    const input = document.createElement('input');
    input.type = 'number';
    document.body.append(input);
    input.value = '4';
    input.focus();
    Object.defineProperty(input, 'selectionStart', { value: null });
    Object.defineProperty(input, 'selectionEnd', { value: null });
    const selection = vi.spyOn(input, 'setSelectionRange');
    act(() => {
      key('1');
      input.value = '41';
      time += 5;
      key('2');
      input.value = '412';
      time += 5;
      key('3');
      vi.advanceTimersByTime(300);
    });
    expect(input.value).toBe('4123');
    expect(selection).not.toHaveBeenCalled();
    input.remove();
  });

  it('does not overlap handlers when disabled and enabled again during a request', async () => {
    let finish: (() => void) | undefined;
    const onScan = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { rerender } = renderHook(({ enabled }) => useBarcodeScan({ enabled, onScan }), {
      initialProps: { enabled: true },
    });
    act(() => scan());
    rerender({ enabled: false });
    rerender({ enabled: true });
    act(() => scan());
    expect(onScan).toHaveBeenCalledTimes(1);
    await act(async () => finish?.());
    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it('pauses queued scans until a confirmation dialog closes', async () => {
    let finish: (() => void) | undefined;
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('data-open', '');
    const onScan = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderHook(() => useBarcodeScan({ enabled: true, onScan }));
    act(() => {
      scan();
      scan();
    });
    document.body.append(dialog);
    await act(async () => finish?.());
    expect(onScan).toHaveBeenCalledTimes(1);
    dialog.remove();
    await settle();
    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it('keeps a re-enabled scan queued if a dialog opens while an old request finishes', async () => {
    let finish: (() => void) | undefined;
    const onScan = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { rerender } = renderHook(({ enabled }) => useBarcodeScan({ enabled, onScan }), {
      initialProps: { enabled: true },
    });
    act(() => scan());
    rerender({ enabled: false });
    rerender({ enabled: true });
    act(() => scan());
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-open', '');
    document.body.append(dialog);
    await act(async () => finish?.());
    expect(onScan).toHaveBeenCalledTimes(1);
    dialog.remove();
    await settle();
    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it('shows a structured handler rejection and returns to ready', async () => {
    const onScan = vi.fn().mockRejectedValue(scanMessage('gtinLookupFailed'));
    const { result } = renderHook(() => useBarcodeScan({ enabled: true, onScan }));
    act(() => scan());
    await settle();
    expect(result.current).toEqual({ status: 'error', message: scanMessage('gtinLookupFailed') });
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.status).toBe('ready');
  });

  it('serializes two scans and lets the newest status win', async () => {
    let finish: (() => void) | undefined;
    const onScan = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockReturnValueOnce(scanMessage('lotRequired'));
    const { result } = renderHook(() => useBarcodeScan({ enabled: true, onScan }));
    act(() => {
      scan();
      scan();
    });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('working');
    await act(async () => finish?.());
    expect(onScan).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ status: 'error', message: scanMessage('lotRequired') });
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.status).toBe('ready');
  });

  it('shows parser errors and does not let an older async completion replace them', async () => {
    let finish: (() => void) | undefined;
    const onScan = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useBarcodeScan({ enabled: true, onScan }));
    act(() => {
      scan();
      scan('abcdefgh');
    });
    expect(result.current).toEqual({
      status: 'error',
      message: scanMessage('MALFORMED_ELEMENT_STRING'),
    });
    await act(async () => finish?.());
    expect(result.current.status).toBe('error');
  });

  it('discards queued callbacks and aborts the active scan after unmount', async () => {
    let finish: (() => void) | undefined;
    const onScan = vi.fn(
      (_result: unknown, _signal: AbortSignal) =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { unmount } = renderHook(() => useBarcodeScan({ enabled: true, onScan }));
    act(() => {
      scan();
      scan();
    });
    const signal = onScan.mock.calls[0]?.[1];
    unmount();
    await act(async () => {
      finish?.();
      scan();
      vi.advanceTimersByTime(5000);
    });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(signal?.aborted).toBe(true);
  });

  it('does not listen while disabled and drops a burst when disabled mid-scan', async () => {
    const onScan = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useBarcodeScan({ enabled, onScan }), {
      initialProps: { enabled: false },
    });
    act(() => {
      expect(scan().defaultPrevented).toBe(false);
    });
    rerender({ enabled: true });
    act(() => {
      key('0');
      key('1');
    });
    rerender({ enabled: false });
    act(() => scan());
    await settle();
    expect(onScan).not.toHaveBeenCalled();
  });

  it.each(['dialog', 'alertdialog'])(
    'pauses for open %s elements and resumes when closed',
    async (role) => {
      const onScan = vi.fn();
      renderHook(() => useBarcodeScan({ enabled: true, onScan }));
      const dialog = document.createElement('div');
      dialog.setAttribute('role', role);
      dialog.setAttribute('data-open', '');
      document.body.append(dialog);
      act(() => {
        expect(scan().defaultPrevented).toBe(false);
      });
      expect(onScan).not.toHaveBeenCalled();
      dialog.remove();
      await settle();
      act(() => scan());
      await settle();
      expect(onScan).toHaveBeenCalledOnce();
    },
  );
});
