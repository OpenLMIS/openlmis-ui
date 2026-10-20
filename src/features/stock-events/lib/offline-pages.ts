import { OFFLINE_EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { HOME_STOCK_PAGES } from '@/features/stock-events/lib/home-stock-pages';
import { matchesOfflinePage } from '@/lib/offline-capability';

const pages = [
  '/home',
  '/offline-events',
  '/stock-management/device-events',
  ...HOME_STOCK_PAGES,
  ...OFFLINE_EVENT_KINDS.map((kind) => kind.listRoute),
];
export const isOfflineCapable = (pathname: string) => matchesOfflinePage(pathname, pages);
