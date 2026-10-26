import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  useDeviceSaveAnnouncement,
  useDeviceSaveFailureAnnouncement,
} from '@/features/stock-events/lib/device-save-announcement';
import type { DraftSaveState } from '@/lib/draft-writer';

it('announces a failed device save once and its recovery, never routine saves', () => {
  const view = renderHook(
    ({ status }: { status: DraftSaveState['status'] }) => {
      useDeviceSaveFailureAnnouncement(status);
      return useDeviceSaveAnnouncement();
    },
    { initialProps: { status: 'saved' } },
  );
  view.rerender({ status: 'saving' });
  view.rerender({ status: 'saved' });
  expect(view.result.current).toBeNull();
  view.rerender({ status: 'failed' });
  expect(view.result.current).toBe('stock-events.draft-failed');
  view.rerender({ status: 'saving' });
  view.rerender({ status: 'saved' });
  expect(view.result.current).toBe('stock-events.draft-saved');
});
