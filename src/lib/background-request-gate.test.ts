import { waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { withRequestPriority } from './background-request-gate';

it('reserves a transport slot for another waiting provider', async () => {
  const foreground = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  const sent: string[] = [];
  const foregroundRead = withRequestPriority(false, undefined, () => foreground.promise);
  const read = (provider: string) =>
    withRequestPriority(
      true,
      undefined,
      async () => {
        sent.push(provider);
        await held.promise;
      },
      provider,
    );
  const reads = [read('stock'), read('stock'), read('stock'), read('requisition-access')];
  foreground.resolve();
  await foregroundRead;
  try {
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent).toEqual(['stock', 'requisition-access']);
  } finally {
    held.resolve();
    await Promise.all(reads);
  }
});

it('lets a failed dataset abort queued siblings before draining the freed slot', async () => {
  const failure = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  const controller = new AbortController();
  const queued = vi.fn(async () => {});
  const read = (send: () => Promise<void>) =>
    withRequestPriority(true, controller.signal, send, 'stock');
  const running = read(() => failure.promise);
  const sibling = read(() => held.promise);
  const waiting = read(queued);
  const task = Promise.all([running, sibling, waiting]).catch(() => controller.abort());
  failure.reject(new Error('Timed out'));
  await task;
  held.resolve();
  await Promise.allSettled([running, sibling, waiting]);
  expect(queued).not.toHaveBeenCalled();
});

it('gives the next freed slot to another provider ahead of queued siblings', async () => {
  const first = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  const stock = vi.fn(() => held.promise);
  const running = withRequestPriority(true, undefined, () => first.promise, 'stock');
  const reads = Array.from({ length: 3 }, () =>
    withRequestPriority(true, undefined, stock, 'stock'),
  );
  await waitFor(() => expect(stock).toHaveBeenCalledOnce());
  const access = vi.fn(async () => {});
  const other = withRequestPriority(true, undefined, access, 'requisition-access');
  first.resolve();
  await running;
  try {
    await waitFor(() => expect(access).toHaveBeenCalledOnce());
  } finally {
    held.resolve();
    await Promise.all([...reads, other]);
  }
});

afterEach(async () => {
  if (vi.isFakeTimers()) await vi.runAllTimersAsync();
  else await new Promise((resolve) => setTimeout(resolve, 0));
  vi.useRealTimers();
});

it('interleaves three looping providers within the first few slots', async () => {
  vi.useFakeTimers();
  const sent: string[] = [];
  let active = 0;
  let maximum = 0;
  const loop = async (provider: string) => {
    for (let index = 0; index < 10; index += 1) {
      await withRequestPriority(
        true,
        undefined,
        async () => {
          sent.push(provider);
          active += 1;
          maximum = Math.max(maximum, active);
          await Promise.resolve();
          active -= 1;
        },
        provider,
      );
    }
  };
  const reads = [loop('A'), loop('B'), loop('C')];
  await vi.runAllTimersAsync();
  await Promise.all(reads);
  expect(sent.slice(0, 3)).toEqual(['A', 'B', 'C']);
  expect(maximum).toBeLessThanOrEqual(2);
  for (let index = 0; index < sent.length; index += 3) {
    expect(new Set(sent.slice(index, index + 3)).size).toBe(3);
  }
});

it('rotates among queued providers instead of draining their siblings first', async () => {
  vi.useFakeTimers();
  const foreground = Promise.withResolvers<void>();
  const blocker = withRequestPriority(false, undefined, () => foreground.promise);
  const sent: string[] = [];
  const read = (provider: string) =>
    withRequestPriority(
      true,
      undefined,
      async () => {
        sent.push(provider);
      },
      provider,
    );
  const reads = [
    ...Array.from({ length: 10 }, () => read('A')),
    ...Array.from({ length: 10 }, () => read('B')),
    read('C'),
  ];
  foreground.resolve();
  await blocker;
  await vi.runAllTimersAsync();
  await Promise.all(reads);
  expect(sent.slice(0, 3)).toEqual(['A', 'B', 'C']);
  expect(sent.slice(3, 7)).toEqual(['A', 'B', 'A', 'B']);
});

it('serves queued reads before arrivals during deferred release', async () => {
  vi.useFakeTimers();
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const sent: string[] = [];
  const running = [
    withRequestPriority(true, undefined, () => first.promise, 'A'),
    withRequestPriority(true, undefined, () => second.promise, 'B'),
  ];
  const read = (label: string) =>
    withRequestPriority(
      true,
      undefined,
      async () => {
        sent.push(label);
      },
      'C',
    );
  const queued = read('queued');
  first.resolve();
  await running[0];
  const later = read('later');
  second.resolve();
  await vi.runAllTimersAsync();
  await Promise.all([...running, queued, later]);
  expect(sent).toEqual(['queued', 'later']);
});

it('removes aborted waiters and retains running slots until their reads settle', async () => {
  vi.useFakeTimers();
  const held = Promise.withResolvers<void>();
  const runningAbort = new AbortController();
  const waitingAbort = new AbortController();
  const running = withRequestPriority(true, runningAbort.signal, () => held.promise, 'A');
  const sibling = withRequestPriority(true, undefined, () => held.promise, 'B');
  await vi.runAllTimersAsync();
  const canceled = vi.fn(async () => {});
  const waiting = withRequestPriority(true, waitingAbort.signal, canceled, 'C');
  const rejected = expect(waiting).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  waitingAbort.abort();
  runningAbort.abort();
  await rejected;
  const next = vi.fn(async () => {});
  const queued = withRequestPriority(true, undefined, next, 'C');
  await vi.runAllTimersAsync();
  expect(next).not.toHaveBeenCalled();
  held.resolve();
  await Promise.all([running, sibling]);
  await vi.runAllTimersAsync();
  await queued;
  expect(canceled).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledOnce();
  const final = withRequestPriority(true, undefined, next, 'A');
  await vi.runAllTimersAsync();
  await final;
  expect(next).toHaveBeenCalledTimes(2);
});
