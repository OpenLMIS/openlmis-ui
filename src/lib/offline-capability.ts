import { LocalDataUnavailableError } from '@/lib/local-data';

export const matchesOfflinePage = (pathname: string, pages: readonly string[]) =>
  pathname === '/' || pages.some((page) => pathname === page || pathname.startsWith(`${page}/`));

export class OfflinePageUnavailableError extends LocalDataUnavailableError {
  constructor() {
    super();
    this.name = 'OfflinePageUnavailableError';
  }
}
