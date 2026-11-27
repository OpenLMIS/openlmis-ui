import type { DashboardReport } from '@/features/reports/lib/types';
import { frameableUrl } from '@/lib/frameable-url';

export type DashboardMode =
  | { kind: 'embedded'; uuid: string; supersetUrl: string }
  | { kind: 'superset-sign-in'; url: string; supersetUrl: string }
  | { kind: 'link'; url: string }
  | { kind: 'not-configured' }
  | { kind: 'unsupported' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Superset address the SDK and older sign-in build on, or undefined when unusable. */
function supersetBase(raw: string | null | undefined, appOrigin: string) {
  const url = frameableUrl(raw, appOrigin);
  if (!url || raw?.includes('?') || raw?.includes('#')) return undefined;
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function resolveDashboardMode(
  report: DashboardReport,
  supersetUrl: string | undefined,
  appOrigin: string,
): DashboardMode {
  const superset = report.type === 'SUPERSET';
  if (superset && report.embeddedUuid) {
    if (!UUID.test(report.embeddedUuid)) return { kind: 'unsupported' };
    const base = supersetBase(supersetUrl, appOrigin);
    return base
      ? { kind: 'embedded', uuid: report.embeddedUuid, supersetUrl: base }
      : { kind: 'not-configured' };
  }
  const link = frameableUrl(report.url, appOrigin);
  if (!link) return { kind: 'unsupported' };
  if (!superset) return { kind: 'link', url: link.href };
  if (!link.searchParams.has('standalone')) link.searchParams.set('standalone', 'true');
  const base = supersetBase(supersetUrl, appOrigin);
  return base && link.origin === new URL(base).origin
    ? { kind: 'superset-sign-in', url: link.href, supersetUrl: base }
    : { kind: 'not-configured' };
}
