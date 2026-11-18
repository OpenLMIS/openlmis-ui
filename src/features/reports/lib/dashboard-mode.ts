import type { DashboardReport } from '@/features/reports/lib/types';

export type DashboardMode =
  | { kind: 'embedded'; uuid: string; supersetUrl: string }
  | { kind: 'link'; url: string }
  | { kind: 'not-configured' }
  | { kind: 'unsupported' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An absolute HTTP(S) address on another origin, carrying no credentials. */
function frameableUrl(raw: string | null | undefined, appOrigin: string) {
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  if (url.username || url.password || url.origin === appOrigin) return undefined;
  return url;
}

/** The Superset address the SDK appends `/embedded/<id>` to, or undefined when unusable. */
export function supersetBase(raw: string | null | undefined, appOrigin: string) {
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
  if (superset && !link.searchParams.has('standalone')) link.searchParams.set('standalone', 'true');
  return { kind: 'link', url: link.href };
}
