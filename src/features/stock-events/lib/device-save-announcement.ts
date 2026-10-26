import { useEffect, useRef } from 'react';
import type { DraftSaveState } from '@/lib/draft-writer';
import { createScopedAnnouncement } from '@/lib/scoped-announcement';

type Announcement =
  | 'stock-events.draft-failed'
  | 'stock-events.draft-saved'
  | 'stock-events.draft-copy-saved'
  | 'stock-events.draft-restored'
  | 'offline-events.recorded-by-you'
  | 'offline-events.status-queued'
  | 'offline-events.removed'
  | 'offline-events.refused-dismissed'
  | 'offline-events.synced-removed';

const announcement = createScopedAnnouncement<Announcement>();
export const announceDeviceSave = announcement.announce;
export const useDeviceSaveAnnouncement = announcement.useAnnouncement;

export function useDeviceSaveFailureAnnouncement(status: DraftSaveState['status']) {
  const failed = useRef(false);
  useEffect(() => {
    if (status === 'failed') {
      if (!failed.current) announceDeviceSave('stock-events.draft-failed');
      failed.current = true;
    } else if (status === 'saved' && failed.current) {
      failed.current = false;
      announceDeviceSave('stock-events.draft-saved');
    }
  }, [status]);
}
