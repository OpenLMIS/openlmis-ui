import { CanceledError, type GenericAbortSignal } from 'axios';

let routeLoading = false;
let quietUntil = 0;
let quietTimer: ReturnType<typeof setTimeout> | undefined;
export function setBackgroundRouteLoading(loading: boolean) {
  routeLoading = loading;
  clearTimeout(quietTimer);
  if (!loading) {
    quietUntil = Date.now() + 1800;
    quietTimer = setTimeout(drain, 1800);
  }
}

let foreground = 0;
let background = 0;
const waiting = new Map<string, Set<() => void>>();
let drainScheduled = false;
const providers = new Map<string, number>();

const drain = () => {
  if (drainScheduled || routeLoading || Date.now() < quietUntil) return;
  while (!foreground && background < 2 && waiting.size) {
    let selected: string | undefined;
    let fewest = Infinity;
    for (const provider of waiting.keys()) {
      const held = providers.get(provider) ?? 0;
      if (held < fewest) {
        selected = provider;
        fewest = held;
      }
    }
    if (selected === undefined) return;
    const queue = waiting.get(selected);
    const resume = queue?.values().next().value;
    waiting.delete(selected);
    if (queue && resume) {
      queue.delete(resume);
      if (queue.size) waiting.set(selected, queue);
      resume();
    }
  }
};

export async function withRequestPriority<T>(
  isBackground: boolean,
  signal: GenericAbortSignal | undefined,
  send: () => Promise<T>,
  provider = 'download',
): Promise<T> {
  if (isBackground) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        const queue = waiting.get(provider);
        queue?.delete(resume);
        if (!queue?.size) waiting.delete(provider);
        signal?.removeEventListener?.('abort', abort);
      };
      const abort = () => {
        cleanup();
        reject(new CanceledError());
      };
      const resume = () => {
        if (signal?.aborted) return abort();
        cleanup();
        background += 1;
        providers.set(provider, (providers.get(provider) ?? 0) + 1);
        resolve();
      };
      const queue = waiting.get(provider) ?? new Set<() => void>();
      queue.add(resume);
      waiting.set(provider, queue);
      signal?.addEventListener?.('abort', abort);
      if (signal?.aborted) abort();
      drain();
    });
  } else foreground += 1;
  try {
    if (signal?.aborted) throw new CanceledError();
    return await send();
  } finally {
    if (isBackground) {
      background -= 1;
      const remaining = (providers.get(provider) ?? 1) - 1;
      if (remaining) providers.set(provider, remaining);
      else providers.delete(provider);
    } else foreground -= 1;
    if (!drainScheduled) {
      drainScheduled = true;
      setTimeout(() => {
        drainScheduled = false;
        drain();
      }, 0);
    }
  }
}
