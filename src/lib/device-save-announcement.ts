import { createScopedAnnouncement } from '@/lib/scoped-announcement';

type Announcement =
  | 'stock-events.draft-failed'
  | 'stock-events.draft-saved'
  | 'stock-events.draft-copy-saved'
  | 'stock-events.draft-restored'
  | 'device-events.recorded-by-you'
  | 'device-events.status-queued'
  | 'device-events.removed';

const announcement = createScopedAnnouncement<Announcement>();
export const announceDeviceSave = announcement.announce;
export const useDeviceSaveAnnouncement = announcement.useAnnouncement;
