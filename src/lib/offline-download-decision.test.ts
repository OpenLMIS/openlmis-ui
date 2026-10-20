import { expect, it } from 'vitest';
import { downloadDecision } from '@/lib/offline-download-decision';

it('respects targeted refresh, retry failures, shared generations and periodic backoff', () => {
  const task = {
    trigger: 'boot',
    requested: false,
    failed: false,
    accessFailed: false,
    changed: false,
    fresh: true,
    retryAt: 0,
    now: 10,
  } as const;
  expect(downloadDecision(task)).toBe('reuse');
  expect(downloadDecision({ ...task, trigger: 'force' })).toBe('fetch');
  expect(downloadDecision({ ...task, trigger: 'refresh' })).toBe('skip');
  expect(downloadDecision({ ...task, trigger: 'refresh', requested: true })).toBe('fetch');
  expect(downloadDecision({ ...task, trigger: 'retry', failed: true })).toBe('fetch');
  expect(downloadDecision({ ...task, trigger: 'retry' })).toBe('skip');
  expect(downloadDecision({ ...task, trigger: 'retry', accessFailed: true })).toBe('fetch');
  expect(downloadDecision({ ...task, trigger: 'force', changed: true })).toBe('reuse');
  expect(downloadDecision({ ...task, requested: true, retryAt: 20 })).toBe('defer');
});
