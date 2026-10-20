import { OFFLINE_FRESH_FOR } from '@/lib/offline-freshness';

type Failure = { attempts: number; retryAt: number };
type Schedule = { checkAt: number; failures: Record<string, Failure> };

export function downloadSchedule(databaseName: string) {
  const key = `${databaseName}:download-schedule`;
  let saved: Schedule;
  try {
    saved = (JSON.parse(localStorage.getItem(key) ?? 'null') as Schedule | null) ?? {
      checkAt: 0,
      failures: {},
    };
  } catch {
    saved = { checkAt: 0, failures: {} };
  }
  let checkAt = Date.now() + OFFLINE_FRESH_FOR;
  return {
    due: () => Date.now() >= saved.checkAt,
    retryAt: (task: string) => saved.failures[task]?.retryAt ?? 0,
    consider: (due: number) => {
      checkAt = Math.min(checkAt, due);
    },
    succeeded(task: string, fetchedAt: number) {
      delete saved.failures[task];
      checkAt = Math.min(checkAt, fetchedAt + OFFLINE_FRESH_FOR);
    },
    failed(task: string) {
      const attempts = Math.min((saved.failures[task]?.attempts ?? 0) + 1, 6);
      const retryAt = Date.now() + Math.min(60_000 * 2 ** (attempts - 1), OFFLINE_FRESH_FOR);
      saved.failures[task] = { attempts, retryAt };
      checkAt = Math.min(checkAt, retryAt);
    },
    save() {
      saved = { ...saved, checkAt };
      localStorage.setItem(key, JSON.stringify(saved));
    },
  };
}
