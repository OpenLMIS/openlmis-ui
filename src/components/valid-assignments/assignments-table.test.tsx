import { screen, within } from '@testing-library/react';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { Suspense } from 'react';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignmentsTable } from '@/components/valid-assignments/assignments-table';
import type { AssignmentsSearch } from '@/components/valid-assignments/search';
import { NOTHING_PICKED } from '@/components/valid-assignments/selection';
import type { AssignmentsApi, ValidAssignment } from '@/components/valid-assignments/types';
import {
  fetchFacilitiesByIds,
  fetchFacilityTypes,
  fetchGeographicLevels,
  fetchPrograms,
} from '@/features/reference-data/api/api';
import type { Facility } from '@/features/reference-data/lib/types';
import { renderPage } from '@/tests/render-page';
import en from '../../../public/locales/en.json';

vi.mock('@/features/reference-data/api/api', () => ({
  fetchPrograms: vi.fn(),
  fetchFacilityTypes: vi.fn(),
  fetchGeographicLevels: vi.fn(),
  fetchFacilitiesByIds: vi.fn(),
}));

const balaka = (id: string, programId: string): ValidAssignment => ({
  id,
  programId,
  facilityTypeId: 't1',
  node: { id: 'n1', referenceId: 'f1', refDataFacility: true },
  name: 'Balaka District Hospital',
  geoLevelAffinityId: null,
});

const ngo: ValidAssignment = {
  id: 'a3',
  programId: 'p1',
  facilityTypeId: 't1',
  node: { id: 'n2', referenceId: 'o1', refDataFacility: false },
  name: 'NGO',
  geoLevelAffinityId: null,
};

function renderTable(content: ValidAssignment[], search: AssignmentsSearch = {}) {
  const api: AssignmentsApi = {
    kind: 'destinations',
    queryKey: ['validDestinations'],
    listOptions: (query) => ({
      queryKey: ['validDestinations', 'list', query],
      queryFn: async () => ({
        content,
        totalElements: content.length,
        totalPages: 1,
        number: 0,
        size: 10,
        numberOfElements: content.length,
      }),
    }),
    create: vi.fn(),
    remove: vi.fn(),
  };
  renderPage(
    <Suspense>
      <AssignmentsTable
        api={api}
        columnVisibility={{}}
        onDelete={vi.fn()}
        onPickedChange={vi.fn()}
        onSearchChange={vi.fn()}
        picked={NOTHING_PICKED}
        search={search}
      />
    </Suspense>,
  );
}

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchPrograms).mockResolvedValue([
    { id: 'p1', code: 'PRG001', name: 'Essential Meds', active: true },
    { id: 'p2', code: 'PRG002', name: 'EPI', active: true },
  ]);
  vi.mocked(fetchFacilityTypes).mockResolvedValue([
    {
      id: 't1',
      code: 'health_center',
      name: 'Health Center',
      displayOrder: 1,
      active: true,
      primaryHealthCare: true,
    },
  ]);
  vi.mocked(fetchGeographicLevels).mockResolvedValue([]);
  vi.mocked(fetchFacilitiesByIds).mockResolvedValue([
    { id: 'f1', geographicZone: { name: 'Balaka' } } as Facility,
  ]);
});

describe('AssignmentsTable', { timeout: 10_000 }, () => {
  it('shows the program and type names, and Unknown for a program the list does not have', async () => {
    renderTable([balaka('a1', 'p1'), balaka('a2', 'gone')]);

    expect(await screen.findByText('Essential Meds')).toBeVisible();
    expect(await screen.findByText('Unknown')).toBeVisible();
    expect(screen.getAllByText('Health Center')).toHaveLength(2);
  });

  it('marks an organization in place of its zone', async () => {
    renderTable([balaka('a1', 'p1'), ngo]);

    const row = (await screen.findByText('NGO')).closest('tr');
    expect(within(row as HTMLElement).getByText('Organization')).toBeVisible();
    expect(await screen.findByText('Balaka')).toBeVisible();
  });

  it('names each row after its program and type too, so the same place twice reads apart', async () => {
    renderTable([balaka('a1', 'p1'), balaka('a2', 'p2')]);

    expect(
      await screen.findByRole('checkbox', {
        name: 'Select Balaka District Hospital, Essential Meds, Health Center',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Select Balaka District Hospital, EPI, Health Center' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Actions For Balaka District Hospital, EPI, Health Center',
      }),
    ).toBeVisible();
  });

  it('says when nothing exists yet, with no way to clear filters', async () => {
    renderTable([]);

    expect(await screen.findByText('No Valid Destinations Yet')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument();
  });

  it('offers to clear the filters when they match nothing', async () => {
    renderTable([], {
      facilityId: '13037147-1769-4735-90a7-b9b310d128b8',
      programId: 'dce17f2e-af3e-40ad-8e00-3496adef44c3',
    });

    expect(await screen.findByText('Nothing Available')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeVisible();
  });
});
