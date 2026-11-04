import { waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
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
