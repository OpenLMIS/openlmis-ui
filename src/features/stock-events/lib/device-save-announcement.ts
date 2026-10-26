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
