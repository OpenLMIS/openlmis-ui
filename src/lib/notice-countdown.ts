import { createStore } from 'zustand/vanilla';

export function createNoticeCountdown(expire: () => void, duration = 4000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const store = createStore(() => ({
    duration,
    remaining: duration,
    startedAt: 0,
    paused: false,
    revision: 0,
  }));
  const reasons = new Set<string>();
  const remaining = () => {
    const state = store.getState();
    return state.paused
      ? state.remaining
      : Math.max(0, state.remaining - (Date.now() - state.startedAt));
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
    }, store.getState().remaining);
  };
  return {
    start: () => {
      stop();
      store.setState({
        duration,
        remaining: duration,
        startedAt: Date.now(),
        paused: false,
        revision: store.getState().revision + 1,
      });
      schedule();
    },
    stop,
    pause: (reason: string, paused: boolean) => {
      if (paused) reasons.add(reason);
      else reasons.delete(reason);
      const state = store.getState();
      const next = reasons.size > 0;
      if (next === state.paused) return;
      const time = remaining();
      clearTimeout(timer);
      store.setState({
        ...state,
        remaining: time,
        paused: next,
        startedAt: Date.now(),
        revision: store.getState().revision + 1,
      });
      if (!next) schedule();
    },
    remaining,
    getSnapshot: store.getState,
    subscribe: store.subscribe,
  };
}
export type NoticeCountdown = ReturnType<typeof createNoticeCountdown>;
