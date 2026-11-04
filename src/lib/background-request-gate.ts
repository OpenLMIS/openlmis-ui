import { CanceledError, type GenericAbortSignal } from 'axios';

let foreground = 0;
let background = 0;
const waiting = new Map<() => void, string>();
const providers = new Map<string, number>();

const drain = () => {
  for (const resume of waiting.keys()) resume();
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
        waiting.delete(resume);
        signal?.removeEventListener?.('abort', abort);
      };
      const abort = () => {
        cleanup();
        reject(new CanceledError());
      };
      const resume = () => {
        if (signal?.aborted) return abort();
        if (foreground || background >= 2) return;
        if (
          (providers.get(provider) ?? 0) > 0 &&
          [...waiting.values()].some((other) => other !== provider)
        )
          return;
        cleanup();
        background += 1;
        providers.set(provider, (providers.get(provider) ?? 0) + 1);
        resolve();
      };
      waiting.set(resume, provider);
      signal?.addEventListener?.('abort', abort);
      resume();
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
    setTimeout(drain, 0);
  }
}
