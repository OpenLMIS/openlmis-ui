import { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

type TableOptions = {
  queryClient?: QueryClient;
  search?: AssignmentsSearch;
  columnVisibility?: Record<string, boolean>;
  totalElements?: number;
  totalPages?: number;
};

function renderTable(
  content: ValidAssignment[],
  {
    queryClient = new QueryClient(),
    search = {},
    columnVisibility = {},
    totalElements,
    totalPages = 1,
  }: TableOptions = {},
) {
  const onDelete = vi.fn();
  const onPickedChange = vi.fn();
  const onSearchChange = vi.fn();
  const api: AssignmentsApi = {
    kind: 'destinations',
    queryKey: ['validDestinations'],
    listOptions: (query) => ({
      queryKey: ['validDestinations', 'list', query],
      queryFn: async () => ({
        content,
        totalElements: totalElements ?? content.length,
        totalPages,
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
        columnVisibility={columnVisibility}
        onDelete={onDelete}
        onPickedChange={onPickedChange}
        onSearchChange={onSearchChange}
        picked={NOTHING_PICKED}
        search={search}
      />
    </Suspense>,
    { queryClient },
  );
  return { onDelete, onPickedChange, onSearchChange };
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

    expect(await screen.findByText('Essential Meds', {}, { timeout: 5000 })).toBeVisible();
    expect(await screen.findByText('Unknown', {}, { timeout: 5000 })).toBeVisible();
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
        name: 'Select Balaka District Hospital for Health Center in Essential Meds',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('checkbox', {
        name: 'Select Balaka District Hospital for Health Center in EPI',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Actions For Balaka District Hospital for Health Center in EPI',
      }),
    ).toBeVisible();
  });

  it('names a picked or deleted row in full, with the filter its rows came from', async () => {
    const { onDelete, onPickedChange } = renderTable([balaka('a2', 'p2')]);
    const user = userEvent.setup();
    const name = 'Balaka District Hospital for Health Center in EPI';

    await user.click(await screen.findByRole('checkbox', { name: `Select ${name}` }));
    expect(onPickedChange).toHaveBeenCalledWith(new Map([['a2', name]]), '|');

    await user.click(screen.getByRole('button', { name: `Actions For ${name}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith({ id: 'a2', name }, '|');
  });

  it('names a row by its place alone until the program and type names arrive', async () => {
    vi.mocked(fetchFacilityTypes).mockReturnValue(new Promise(() => {}));
    renderTable([balaka('a1', 'p1')]);

    expect(
      await screen.findByRole('checkbox', { name: 'Select Balaka District Hospital' }),
    ).toBeVisible();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('says Unknown rather than leaving cells blank when the names cannot be loaded', async () => {
    vi.mocked(fetchPrograms).mockRejectedValue(new Error('offline'));
    vi.mocked(fetchFacilityTypes).mockRejectedValue(new Error('offline'));
    renderTable([balaka('a1', 'p1')], {
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    });

    expect(await screen.findAllByText('Unknown')).toHaveLength(2);
  });

  it('shows the program and type under the name when their columns are hidden', async () => {
    renderTable([balaka('a1', 'p1')], {
      columnVisibility: { program: false, facilityType: false },
    });

    expect(await screen.findByText('Essential Meds · Health Center')).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Program' })).not.toBeInTheDocument();
  });

  it('leaves the zone out when the facilities cannot be loaded', async () => {
    vi.mocked(fetchFacilitiesByIds).mockRejectedValue(new Error('offline'));
    renderTable([balaka('a1', 'p1')]);

    const row = (await screen.findByText('Balaka District Hospital')).closest('tr');
    expect(await within(row as HTMLElement).findByText('-')).toBeVisible();
  });

  it('moves back to the last page when the page asked for is past the end', async () => {
    const { onSearchChange } = renderTable([], {
      search: { page: 5 },
      totalElements: 15,
      totalPages: 2,
    });

    await vi.waitFor(() => expect(onSearchChange).toHaveBeenCalledWith({ page: 2 }, true));
  });

  it('says when nothing exists yet, with no way to clear filters', async () => {
    renderTable([]);

    expect(await screen.findByText('No Valid Destinations Yet')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument();
  });

  it('offers to clear the filters when they match nothing', async () => {
    renderTable([], {
      search: {
        facilityId: '13037147-1769-4735-90a7-b9b310d128b8',
        programId: 'dce17f2e-af3e-40ad-8e00-3496adef44c3',
      },
    });

    expect(await screen.findByText('Nothing Available')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeVisible();
  });
});
