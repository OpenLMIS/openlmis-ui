import { describe, expect, it } from 'vitest';
import {
  createScanCaptureState,
  reduceScanCapture,
  type ScanCaptureEffect,
  type ScanCaptureKeyEvent,
} from '@/lib/gs1/scan-capture';

const PAYLOAD = ']d20105890123456786';
const SUPPRESS = { type: 'suppress' };

function capture(initialValue: string | null = 'PRE') {
  let state = createScanCaptureState();
  let now = 1000;
  let snapshot: string | null = null;
  const field = { value: initialValue };
  const effects: ScanCaptureEffect[] = [];
  const payloads: string[] = [];

  function apply(nextEffects: ScanCaptureEffect[]) {
    effects.push(...nextEffects);
    for (const effect of nextEffects) {
      if (effect.type === 'snapshot-field') snapshot = field.value;
      if (effect.type === 'restore-field' && snapshot !== null) field.value = snapshot;
      if (effect.type === 'replay' && snapshot !== null) field.value = snapshot + effect.text;
      if (effect.type === 'emit') payloads.push(effect.payload);
    }
  }

  function key(key: string, gap = 5, overrides: Partial<ScanCaptureKeyEvent> = {}) {
    now += gap;
    const event: ScanCaptureKeyEvent = {
      type: 'keydown',
      key,
      code: '',
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      repeat: false,
      timeStamp: now,
      ...overrides,
    };
    const result = reduceScanCapture(state, event);
    state = result.state;
    apply(result.effects);
    if (
      event.type === 'keydown' &&
      key.length === 1 &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !result.effects.some((effect) => effect.type === 'suppress') &&
      field.value !== null
    )
      field.value += key;
    return result.effects;
  }

  function type(text: string, gap = 5, firstGap = gap) {
    return [...text].map((character, index) => key(character, index === 0 ? firstGap : gap));
  }

  function timeout(gap = 300) {
    now += gap;
    const result = reduceScanCapture(state, { type: 'timeout', timeStamp: now });
    state = result.state;
    apply(result.effects);
    return result.effects;
  }

  return {
    key,
    type,
    timeout,
    field,
    effects,
    payloads,
    get state() {
      return state;
    },
  };
}

describe('reduceScanCapture', () => {
  it.each([
    'Backspace',
    'Delete',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ])('resolves pending typing before %s without swallowing the edit', (key) => {
    const scan = capture('');
    scan.type('123');
    expect(scan.key(key)).not.toContainEqual(SUPPRESS);
    expect(scan.field.value).toBe('123');
    if (key === 'Backspace') scan.field.value = scan.field.value?.slice(0, -1) ?? null;
    else scan.field.value = '12';
    expect(scan.timeout()).toEqual([]);
    expect(scan.field.value).toBe('12');
    expect(scan.state.buffer).toBe('');
  });

  it.each(['Enter', 'Tab'])('emits a fast scan on %s and restores leaked input', (suffix) => {
    const scan = capture();
    scan.type(PAYLOAD);
    expect(scan.field.value).toBe('PRE]d');
    expect(scan.key(suffix)).toContainEqual(SUPPRESS);
    expect(scan.field.value).toBe('PRE');
    expect(scan.payloads).toEqual([PAYLOAD]);
  });

  it.each([5, 40])('accepts inter-character gaps of %s ms', (gap) => {
    const scan = capture();
    scan.type('12345678', gap);
    scan.key('Enter');
    expect(scan.payloads).toEqual(['12345678']);
  });

  it('leaves ordinary typing and its Enter untouched at 41 ms', () => {
    const scan = capture();
    const characters = scan.type(PAYLOAD, 41);
    expect(characters.every((effects) => !effects.some((e) => e.type === 'suppress'))).toBe(true);
    expect(scan.key('1', 41, { type: 'keyup' })).not.toContainEqual(SUPPRESS);
    expect(scan.key('Enter', 41)).not.toContainEqual(SUPPRESS);
    expect(scan.payloads).toEqual([]);
    expect(scan.field.value).toBe(`PRE${PAYLOAD}`);
  });

  it('never intercepts Enter in a form without a scan', () => {
    const scan = capture();
    expect(scan.key('Enter')).toEqual([]);
    expect(scan.key('Enter', 5, { type: 'keyup' })).toEqual([]);
  });

  it('suppresses from character three, including keyup, but leaves modifier releases alone', () => {
    const scan = capture();
    expect(scan.key('1')).not.toContainEqual(SUPPRESS);
    expect(scan.key('2')).not.toContainEqual(SUPPRESS);
    expect(scan.key('3')).toContainEqual(SUPPRESS);
    expect(scan.key('3', 1, { type: 'keyup' })).toContainEqual(SUPPRESS);
    expect(scan.key('Shift', 1, { type: 'keyup' })).toEqual([]);
  });

  it('replays seven characters as typing and leaves the suffix alone', () => {
    const scan = capture();
    scan.type('1234567');
    const effects = scan.key('Enter');
    expect(effects).toContainEqual({ type: 'replay', text: '1234567' });
    expect(effects).not.toContainEqual(SUPPRESS);
    expect(scan.field.value).toBe('PRE1234567');
    expect(scan.payloads).toEqual([]);
  });

  it('does not rewrite a field when no characters were suppressed', () => {
    const scan = capture();
    scan.type('12');
    scan.field.value = 'P1X2RE';
    expect(scan.key('Enter')).not.toContainEqual({ type: 'replay', text: '12' });
    expect(scan.field.value).toBe('P1X2RE');
  });

  it('does not apply the character gap threshold to a suffix before idle abandonment', () => {
    const scan = capture();
    scan.type(PAYLOAD);
    expect(scan.key('Enter', 299)).toContainEqual(SUPPRESS);
    expect(scan.payloads).toEqual([PAYLOAD]);
  });

  it('suppresses duplicate suffix keydowns and keyups without emitting twice', () => {
    const scan = capture();
    scan.type(PAYLOAD);
    scan.key('Enter');
    expect(scan.key('Enter', 1, { type: 'keyup' })).toContainEqual(SUPPRESS);
    expect(scan.key('Tab')).toContainEqual(SUPPRESS);
    expect(scan.key('Tab', 1, { type: 'keyup' })).toContainEqual(SUPPRESS);
    expect(scan.payloads).toEqual([PAYLOAD]);
  });

  it.each([150, 151])('bounds the suffix window at %s ms', (gap) => {
    const scan = capture();
    scan.type(PAYLOAD);
    scan.key('Enter');
    expect(scan.key('Enter', gap).some((e) => e.type === 'suppress')).toBe(gap === 150);
  });

  it('accepts a second scan inside the previous suffix window', () => {
    const scan = capture();
    scan.type(PAYLOAD);
    scan.key('Enter');
    scan.type(PAYLOAD);
    scan.key('Tab');
    expect(scan.payloads).toEqual([PAYLOAD, PAYLOAD]);
    expect(scan.field.value).toBe('PRE');
  });

  it('ends the suffix window as soon as a new typing burst begins', () => {
    const scan = capture();
    scan.type(PAYLOAD);
    scan.key('Enter');
    scan.type('12');
    expect(scan.key('Enter')).not.toContainEqual(SUPPRESS);
    expect(scan.key('Enter', 1, { type: 'keyup' })).not.toContainEqual(SUPPRESS);
    expect(scan.field.value).toBe('PRE12');
  });

  it.each([
    { key: '\u001D' },
    { key: 'Unidentified', keyCode: 29 },
    { key: 'Unidentified', code: 'BracketRight', ctrlKey: true },
    { key: ']', ctrlKey: true },
  ])('normalizes a GS representation %j', (separator) => {
    const scan = capture();
    scan.type(`${PAYLOAD}10ABC`);
    expect(scan.key(separator.key, 5, separator)).toContainEqual(SUPPRESS);
    scan.type('21S1');
    scan.key('Enter');
    expect(scan.payloads).toEqual([`${PAYLOAD}10ABC\u001D21S1`]);
  });

  it.each(['ctrlKey', 'altKey', 'metaKey'] as const)('ignores %s shortcuts', (modifier) => {
    const scan = capture();
    expect(scan.key('a', 5, { [modifier]: true })).toEqual([]);
    scan.type(PAYLOAD);
    expect(scan.key('x', 5, { [modifier]: true })).toEqual([]);
    scan.key('Enter');
    expect(scan.payloads).toEqual([PAYLOAD]);
  });

  it('ignores repeats without corrupting the payload', () => {
    const scan = capture();
    scan.type(PAYLOAD);
    expect(scan.key('X', 5, { repeat: true })).toEqual([]);
    expect(scan.key('Enter', 5, { repeat: true })).toEqual([]);
    scan.key('Enter');
    expect(scan.payloads).toEqual([PAYLOAD]);
  });

  it.each([
    ['12', '345', 'PRE12345'],
    ['12345', '67', 'PRE1234567'],
    ['0105890123', 'xy', 'PRExy'],
  ])('resolves interrupted burst %s before starting %s', (before, after, value) => {
    const scan = capture();
    scan.type(before);
    scan.type(after, 5, 100);
    scan.timeout();
    expect(scan.field.value).toBe(value);
    expect(scan.payloads).toEqual([]);
  });

  it('preserves earlier typing when a scan follows it', () => {
    const scan = capture();
    scan.type('99999');
    scan.type(PAYLOAD, 5, 50);
    scan.key('Enter');
    expect(scan.payloads).toEqual([PAYLOAD]);
    expect(scan.field.value).toBe('PRE99999');
  });

  it('takes the fresh snapshot after replaying interrupted typing', () => {
    const scan = capture();
    scan.type('12345');
    const effects = scan.key('x', 50);
    expect(
      effects.indexOf(effects.find((e) => e.type === 'replay') as ScanCaptureEffect),
    ).toBeLessThan(
      effects.indexOf(effects.find((e) => e.type === 'snapshot-field') as ScanCaptureEffect),
    );
  });

  it('replays a short abandoned scan fragment as typing', () => {
    const scan = capture();
    scan.type(PAYLOAD.slice(0, 7));
    expect(scan.timeout()).toContainEqual({ type: 'replay', text: PAYLOAD.slice(0, 7) });
    expect(scan.field.value).toBe(`PRE${PAYLOAD.slice(0, 7)}`);
    expect(scan.key('Enter')).not.toContainEqual(SUPPRESS);
  });

  it('abandons an unterminated scan after idle without emitting it', () => {
    const scan = capture();
    scan.type(PAYLOAD);
    expect(scan.timeout()).toContainEqual({ type: 'restore-field' });
    expect(scan.field.value).toBe('PRE');
    expect(scan.payloads).toEqual([]);
  });

  it('does not accumulate repeated unterminated scans in a field', () => {
    const scan = capture();
    for (let i = 0; i < 4; i++) scan.type(PAYLOAD, 5, 500);
    scan.timeout();
    expect(scan.field.value).toBe('PRE');
    expect(scan.payloads).toEqual([]);
  });

  it.each([150, 151])('bounds late suffix suppression after idle at %s ms', (gap) => {
    const scan = capture();
    scan.type(PAYLOAD);
    scan.timeout();
    expect(scan.key('Enter', gap).some((e) => e.type === 'suppress')).toBe(gap === 150);
    expect(scan.payloads).toEqual([]);
  });

  it('swallows only the first late suffix after abandonment', () => {
    const scan = capture();
    scan.type(PAYLOAD);
    scan.timeout();
    expect(scan.key('Enter')).toContainEqual(SUPPRESS);
    expect(scan.key('Enter')).not.toContainEqual(SUPPRESS);
  });

  it('a new scan clears the abandoned scans late-suffix marker', () => {
    const scan = capture();
    scan.type(PAYLOAD);
    scan.timeout();
    scan.type(PAYLOAD);
    scan.key('Enter');
    expect(scan.payloads).toEqual([PAYLOAD]);
  });

  it('ignores stale timeout events before the latest idle deadline', () => {
    const scan = capture();
    scan.type('12');
    const deadline = scan.state.timeoutAt;
    expect(deadline).toBe(1310);
    scan.type('34');
    expect(scan.timeout(285)).toEqual([]);
    expect(scan.timeout(15)).toContainEqual({ type: 'replay', text: '1234' });
  });

  it('cancels the scheduled idle timeout after completion', () => {
    const scan = capture();
    expect(scan.key('1')).toContainEqual({ type: 'schedule-timeout', at: 1305 });
    scan.type('2345678');
    expect(scan.key('Enter')).toContainEqual({ type: 'cancel-timeout' });
    expect(scan.timeout()).toEqual([]);
    expect(scan.payloads).toEqual(['12345678']);
  });

  it('emits with nothing restorable focused', () => {
    const scan = capture(null);
    scan.type(PAYLOAD);
    scan.key('Enter');
    expect(scan.payloads).toEqual([PAYLOAD]);
    expect(scan.field.value).toBeNull();
  });

  it('supports timestamp zero without reading a wall clock or losing the initial snapshot', () => {
    const result = reduceScanCapture(createScanCaptureState(), {
      type: 'keydown',
      key: '1',
      timeStamp: 0,
    });
    expect(result.effects).toContainEqual({ type: 'snapshot-field' });
    expect(result.effects).toContainEqual({ type: 'schedule-timeout', at: 300 });
  });

  it('does not mutate the previous state', () => {
    const state = createScanCaptureState();
    const before = structuredClone(state);
    reduceScanCapture(state, { type: 'keydown', key: '1', timeStamp: 10 });
    expect(state).toEqual(before);
  });
});
