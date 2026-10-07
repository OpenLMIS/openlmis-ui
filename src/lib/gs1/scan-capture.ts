export type ScanCaptureKeyEvent = {
  type: 'keydown' | 'keyup';
  key: string;
  code?: string;
  keyCode?: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
  timeStamp: number;
};

export type ScanCaptureEvent = ScanCaptureKeyEvent | { type: 'timeout'; timeStamp: number };

export type ScanCaptureConfig = {
  burstThreshold: number;
  minPayloadLength: number;
  suppressAfter: number;
  terminators: readonly string[];
  idleTimeout: number;
  suffixWindow: number;
  separatorKeyCode: number;
  separatorCtrlCodes: readonly string[];
  separatorCtrlKeys: readonly string[];
  restoreLeakedInput: boolean;
};

export type ScanCaptureState = {
  buffer: string;
  lastKeyTime: number | null;
  suppressing: boolean;
  scanEndedAt: number | null;
  lateTerminatorFrom: number | null;
  timeoutAt: number | null;
};

export type ScanCaptureEffect =
  | { type: 'suppress' }
  | { type: 'snapshot-field' }
  | { type: 'restore-field' }
  | { type: 'replay'; text: string }
  | { type: 'emit'; payload: string }
  | { type: 'schedule-timeout'; at: number }
  | { type: 'cancel-timeout' };

export type ScanCaptureResult = { state: ScanCaptureState; effects: ScanCaptureEffect[] };

export const SCAN_CAPTURE_DEFAULTS: Readonly<ScanCaptureConfig> = {
  burstThreshold: 40,
  minPayloadLength: 8,
  suppressAfter: 3,
  terminators: ['Enter', 'Tab'],
  idleTimeout: 300,
  suffixWindow: 150,
  separatorKeyCode: 29,
  separatorCtrlCodes: ['BracketRight'],
  separatorCtrlKeys: [']'],
  restoreLeakedInput: true,
};

export function createScanCaptureState(): ScanCaptureState {
  return {
    buffer: '',
    lastKeyTime: null,
    suppressing: false,
    scanEndedAt: null,
    lateTerminatorFrom: null,
    timeoutAt: null,
  };
}

function readCharacter(event: ScanCaptureKeyEvent, config: ScanCaptureConfig) {
  if (
    event.keyCode === config.separatorKeyCode ||
    (event.ctrlKey &&
      (config.separatorCtrlCodes.includes(event.code ?? '') ||
        config.separatorCtrlKeys.includes(event.key)))
  )
    return '\u001D';
  return event.key.length === 1 ? event.key : undefined;
}

function replay(state: ScanCaptureState, effects: ScanCaptureEffect[]) {
  if (state.suppressing) effects.push({ type: 'replay', text: state.buffer });
}

function restore(config: ScanCaptureConfig, effects: ScanCaptureEffect[]) {
  if (config.restoreLeakedInput) effects.push({ type: 'restore-field' });
}

function resetBurst(state: ScanCaptureState, effects: ScanCaptureEffect[]) {
  if (state.timeoutAt !== null) effects.push({ type: 'cancel-timeout' });
  state.buffer = '';
  state.lastKeyTime = null;
  state.suppressing = false;
  state.lateTerminatorFrom = null;
  state.timeoutAt = null;
}

function abandonBurst(
  state: ScanCaptureState,
  config: ScanCaptureConfig,
  effects: ScanCaptureEffect[],
) {
  const looksLikeScan = state.buffer.length >= config.minPayloadLength;
  const lastKeyTime = state.lastKeyTime;
  if (looksLikeScan) restore(config, effects);
  else replay(state, effects);
  resetBurst(state, effects);
  state.lateTerminatorFrom = looksLikeScan ? lastKeyTime : null;
}

export function reduceScanCapture(
  previous: ScanCaptureState,
  event: ScanCaptureEvent,
  options: Partial<ScanCaptureConfig> = {},
): ScanCaptureResult {
  const config = { ...SCAN_CAPTURE_DEFAULTS, ...options };
  const state = { ...previous };
  const effects: ScanCaptureEffect[] = [];
  const result = { state, effects };
  if (event.type === 'timeout') {
    if (state.timeoutAt !== null && event.timeStamp >= state.timeoutAt) {
      abandonBurst(state, config, effects);
    }
    return result;
  }

  const isTail =
    state.scanEndedAt !== null && event.timeStamp - state.scanEndedAt <= config.suffixWindow;
  const terminator = config.terminators.includes(event.key);
  const character = readCharacter(event, config);

  if (event.type === 'keyup') {
    if ((state.suppressing || isTail) && (terminator || character !== undefined)) {
      effects.push({ type: 'suppress' });
    }
    return result;
  }
  if (event.repeat) return result;

  const modified = event.ctrlKey || event.altKey || event.metaKey;
  const collectable = character !== undefined && (!modified || character === '\u001D');
  if (isTail && !collectable) {
    effects.push({ type: 'suppress' });
    return result;
  }

  if (terminator) {
    if (
      !state.buffer &&
      state.lateTerminatorFrom !== null &&
      event.timeStamp - state.lateTerminatorFrom <= config.idleTimeout + config.suffixWindow
    ) {
      effects.push({ type: 'suppress' });
      state.lateTerminatorFrom = null;
      return result;
    }
    if (state.buffer.length < config.minPayloadLength) {
      replay(state, effects);
      resetBurst(state, effects);
      return result;
    }
    const payload = state.buffer;
    effects.push({ type: 'suppress' });
    restore(config, effects);
    resetBurst(state, effects);
    state.scanEndedAt = event.timeStamp;
    effects.push({ type: 'emit', payload });
    return result;
  }
  if (!collectable) return result;

  if (state.lastKeyTime === null || event.timeStamp - state.lastKeyTime > config.burstThreshold) {
    abandonBurst(state, config, effects);
    effects.push({ type: 'snapshot-field' });
    state.scanEndedAt = null;
  }
  state.buffer += character;
  state.lastKeyTime = event.timeStamp;
  if (state.buffer.length >= config.suppressAfter) state.suppressing = true;
  if (state.suppressing) effects.push({ type: 'suppress' });
  state.lateTerminatorFrom = null;
  state.timeoutAt = event.timeStamp + config.idleTimeout;
  effects.push({ type: 'schedule-timeout', at: state.timeoutAt });
  return result;
}
