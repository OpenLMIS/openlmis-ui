export function createNoticeCountdown(expire: () => void, duration = 4000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let state = { duration, remaining: duration, startedAt: 0, paused: false, revision: 0 };
  const reasons = new Set<string>();
  const listeners = new Set<() => void>();
  const remaining = () =>
    state.paused ? state.remaining : Math.max(0, state.remaining - (Date.now() - state.startedAt));
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    reasons.clear();
  };
  const schedule = () => {
    timer = setTimeout(() => {
      timer = undefined;
      expire();
    }, state.remaining);
  };
  return {
    start: () => {
      stop();
      state = {
        duration,
        remaining: duration,
        startedAt: Date.now(),
        paused: false,
        revision: state.revision + 1,
      };
      schedule();
      notify();
    },
    stop,
    pause: (reason: string, paused: boolean) => {
      if (paused) reasons.add(reason);
      else reasons.delete(reason);
      const next = reasons.size > 0;
      if (next === state.paused) return;
      const time = remaining();
      clearTimeout(timer);
      state = {
        ...state,
        remaining: time,
        paused: next,
        startedAt: Date.now(),
        revision: state.revision + 1,
      };
      if (!next) schedule();
      notify();
    },
    remaining,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type NoticeCountdown = ReturnType<typeof createNoticeCountdown>;
