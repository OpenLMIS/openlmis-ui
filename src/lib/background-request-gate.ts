import { CanceledError, type GenericAbortSignal } from 'axios';

let foreground = 0;
let background = 0;
const waiting = new Set<() => void>();

const drain = () => {
  for (const resume of waiting) resume();
};

export async function withRequestPriority<T>(
  isBackground: boolean,
  signal: GenericAbortSignal | undefined,
  send: () => Promise<T>,
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
        cleanup();
        background += 1;
        resolve();
      };
      waiting.add(resume);
      signal?.addEventListener?.('abort', abort);
      resume();
    });
  } else foreground += 1;
  try {
    if (signal?.aborted) throw new CanceledError();
    return await send();
  } finally {
    if (isBackground) background -= 1;
    else foreground -= 1;
    drain();
  }
}
