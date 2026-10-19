import { LocalDataUnavailableError } from '@/lib/local-data';

const OFFLINE_PAGES = [
  '/home',
  '/stock-management/adjustments',
  '/offline-events',
  '/stock-management/device-events',
];

export function isOfflineCapable(pathname: string) {
  return (
    pathname === '/' ||
    OFFLINE_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))
  );
}

export class OfflinePageUnavailableError extends LocalDataUnavailableError {
  constructor() {
    super();
    this.name = 'OfflinePageUnavailableError';
  }
}
