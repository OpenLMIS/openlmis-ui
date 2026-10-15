import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  deploymentTimeZoneOptions,
  homeFacilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { setDownloadStatus } from '@/lib/offline-download-status';
import { parsePermissions } from '@/lib/permissions';
import { StockEventProgramPicker } from '@/routes/(protected)/-stock-event-program-picker';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
vi.mock('@/hooks/use-adjustment-readiness', () => ({ useAdjustmentReadiness: () => [] }));
vi.mock('@/features/stock-events/hooks/use-device-events', () => ({
  useDeviceEvents: () => ({
    events: [
      { kind: 'adjustment', status: 'queued' },
      { kind: 'issue', status: 'queued' },
      { kind: 'adjustment', status: 'accepted' },
    ] as DeviceEvent[],
  }),
}));
afterEach(() => setDownloadStatus({ phase: 'idle', failed: [] }));
it('shows pending work for this kind and downloading readiness for an unfinished program', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const program = { id: 'p', code: 'P', name: 'Medicines', active: true };
  client.setQueryData(userRecordOptions('u').queryKey, {
    id: 'u',
    username: 'u',
    firstName: '',
    lastName: '',
    active: true,
    homeFacilityId: 'f',
    roleAssignments: [],
  });
  client.setQueryData(userProgramsOptions('u').queryKey, [program]);
  client.setQueryData(homeFacilityOptions('f').queryKey, {
    id: 'f',
    code: 'F',
    name: 'Clinic',
    active: true,
    enabled: true,
    type: { id: 'type', code: 'T', name: 'Type' },
    geographicZone: { id: 'z', code: 'Z', name: 'Zone', level: { name: 'District' } },
    supportedPrograms: [{ ...program, supportActive: true, supportLocallyFulfilled: false }],
  });
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  setDownloadStatus({ phase: 'running', failed: [{ id: 'p', name: 'Medicines' }] });
  renderPage(
    <StockEventProgramPicker
      userId="u"
      permissions={parsePermissions(['STOCK_ADJUST|f|p'])}
      kind="adjustment"
      editorLink={() => <a href="/edit">Edit</a>}
    />,
    { queryClient: client },
  );
  expect(await screen.findByRole('note')).toHaveTextContent('device-events.program-pending');
  expect(screen.getByRole('link', { name: 'device-events.review' })).toHaveAttribute(
    'href',
    '/stock-management/device-events',
  );
  expect(await screen.findByText('offline.download.downloading')).toBeInTheDocument();
  expect(screen.queryByText('offline.download.not-downloaded')).not.toBeInTheDocument();
});
