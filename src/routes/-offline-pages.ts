import {
  EVENT_KINDS,
  OFFLINE_EVENT_KINDS,
  OFFLINE_EVENT_RIGHTS,
} from '@/features/stock-events/lib/event-kinds';
import { registerNavRights } from '@/lib/nav-rights';
import { registerOfflinePages } from '@/lib/offline-pages';
import { RIGHTS } from '@/lib/rights';

registerOfflinePages(['/stock-management/stock-on-hand'], [RIGHTS.stockCardsView]);
registerOfflinePages(
  OFFLINE_EVENT_KINDS.map((kind) => kind.listRoute),
  OFFLINE_EVENT_RIGHTS,
);
registerNavRights({
  '/offline-events': OFFLINE_EVENT_RIGHTS,
  ...Object.fromEntries(Object.values(EVENT_KINDS).map((kind) => [kind.listRoute, kind.right])),
});
