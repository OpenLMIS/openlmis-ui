import { describe, expect, it } from 'vitest';
import { resolveDashboardMode, supersetBase } from '@/features/reports/lib/dashboard-mode';
import type { DashboardReport } from '@/features/reports/lib/types';

const app = 'https://lmis.example.org';
const superset = 'https://superset.example.org';
const uuid = '0d6f1b4e-3c1a-4c58-9a3f-2f1d6a6e7b10';

const record = (fields: Partial<DashboardReport>): DashboardReport => ({
  id: 'r1',
  name: 'Stock Dashboard',
  type: 'SUPERSET',
  ...fields,
});

describe('resolveDashboardMode', () => {
  it('embeds a Superset dashboard with a valid id against a configured Superset', () => {
    expect(resolveDashboardMode(record({ embeddedUuid: uuid }), `${superset}//`, app)).toEqual({
      kind: 'embedded',
      uuid,
      supersetUrl: superset,
    });
  });

  it('refuses an embedded id that is not a UUID, since the SDK puts it in the frame path', () => {
    expect(resolveDashboardMode(record({ embeddedUuid: '../../admin' }), superset, app)).toEqual({
      kind: 'unsupported',
    });
  });

  it.each([
    undefined,
    '',
    '/superset',
    'javascript:alert(1)',
    'https://user:secret@superset.example.org',
    'https://superset.example.org/?next=/x',
    'https://superset.example.org/#top',
    `${app}/superset`,
  ])('treats Superset address %s as not set up', (configured) => {
    expect(resolveDashboardMode(record({ embeddedUuid: uuid }), configured, app)).toEqual({
      kind: 'not-configured',
    });
  });

  it('keeps a deployment path prefix on the Superset address without trailing slashes', () => {
    expect(supersetBase('http://localhost:5174/reporting///', 'http://localhost:5173')).toBe(
      'http://localhost:5174/reporting',
    );
  });

  it('frames a Superset link in standalone mode, keeping its own query and fragment', () => {
    expect(
      resolveDashboardMode(
        record({ url: `${superset}/superset/dashboard/7/?native_filters=a#tab` }),
        undefined,
        app,
      ),
    ).toEqual({
      kind: 'link',
      url: `${superset}/superset/dashboard/7/?native_filters=a&standalone=true#tab`,
    });
  });

  it('frames another provider link unchanged', () => {
    const url = 'https://app.powerbi.com/view?r=abc#page';
    expect(resolveDashboardMode(record({ type: 'POWERBI', url }), undefined, app)).toEqual({
      kind: 'link',
      url,
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<p>x</p>',
    '/reports',
    '//evil.example.org/x',
    'https://user:pass@app.powerbi.com/view',
    `${app}/v2/home`,
    'ftp://files.example.org/dashboard',
    undefined,
  ])('cannot show link %s', (url) => {
    expect(resolveDashboardMode(record({ type: 'POWERBI', url }), undefined, app)).toEqual({
      kind: 'unsupported',
    });
  });
});
