import { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import type { ProgramSchedule, RequisitionGroup } from '@/features/reference-data/lib/types';
import { searchRequisitionGroups } from '@/features/requisition-groups/api/api';
import { requisitionGroupsSearchOptions } from '@/features/requisition-groups/api/queries';
import {
  RequisitionGroupsListError,
  RequisitionGroupsTable,
} from '@/features/requisition-groups/components/requisition-groups-table';
import {
  CLEARED_REQUISITION_GROUP_FILTERS,
  type RequisitionGroupsListSearch,
  toRequisitionGroupsQuery,
} from '@/features/requisition-groups/lib/search';
import { renderPage } from '@/test-utils/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/features/requisition-groups/api/api', () => ({ searchRequisitionGroups: vi.fn() }));

const schedule = (name: string, id = name): ProgramSchedule => ({
  id,
  program: { id, name },
  processingSchedule: { id: 'schedule' },
  directDelivery: false,
});

const group = (name: string, schedules: ProgramSchedule[]): RequisitionGroup => ({
  id: name,
  name,
  code: 'RG',
  supervisoryNode: { id: 'node', name: 'Node' },
  memberFacilities: [],
  requisitionGroupProgramSchedules: schedules,
});

function renderTable(search: RequisitionGroupsListSearch = {}, groups?: RequisitionGroup[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, retryDelay: 0, staleTime: Infinity } },
  });
  if (groups) {
    queryClient.setQueryData(
      requisitionGroupsSearchOptions(toRequisitionGroupsQuery(search)).queryKey,
      {
        content: groups,
        totalElements: groups.length,
        totalPages: 1,
        number: 0,
        size: 10,
      },
    );
  }
  const onSearchChange = vi.fn();
  renderPage(
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <RequisitionGroupsListError error={error} reset={reset} />
      )}
      pendingFallback={null}
      resetKey={JSON.stringify(search)}
    >
      <RequisitionGroupsTable
        cards={false}
        columnVisibility={{}}
        onSearchChange={onSearchChange}
        search={search}
      />
    </QueryBoundary>,
    { queryClient, onCaughtError: () => {} },
  );
  return onSearchChange;
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

beforeEach(() => vi.resetAllMocks());

describe('RequisitionGroupsTable', () => {
  it('leaves no programs blank, shows one name, and counts schedule rows in a names popover', async () => {
    renderTable({}, [
      group('No Schedules', []),
      group('One Schedule', [schedule('Malaria')]),
      group('Many Schedules', [
        schedule('Family Planning'),
        schedule('Malaria'),
        schedule('Malaria', 'malaria-second'),
      ]),
    ]);
    const noSchedules = (await screen.findByText('No Schedules')).closest('tr') as HTMLElement;
    expect(within(noSchedules).getAllByRole('cell')[1]).toBeEmptyDOMElement();
    const one = screen.getByText('One Schedule').closest('tr') as HTMLElement;
    expect(within(one).getAllByRole('cell')[1]).toHaveTextContent('Malaria');
    expect(within(one).queryByRole('button', { name: /Programs/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '3 Programs In Many Schedules' }));
    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByText('Family Planning')).toBeVisible();
    expect(within(popover).getAllByText('Malaria')).toHaveLength(2);
  });

  it.each([
    ['zone', 'referenceData.error.geographicZone.notFound'],
    ['program', 'referenceData.error.program.notFound'],
  ] as const)(
    'shows an unknown %s code 400 as no matches with Clear Filters',
    async (filter, messageKey) => {
      const error = new AxiosError('Unknown Code');
      error.response = {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: {} } as NonNullable<typeof error.config>,
        data: { messageKey },
      };
      vi.mocked(searchRequisitionGroups).mockRejectedValue(error);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onSearchChange = renderTable({ [filter]: 'unknown', page: 3 });
      expect(await screen.findByText('No Matching Requisition Groups')).toBeVisible();
      expect(screen.queryByText('Could Not Load Requisition Groups')).not.toBeInTheDocument();
      expect(searchRequisitionGroups).toHaveBeenCalledTimes(1);
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
      await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
      expect(onSearchChange).toHaveBeenCalledWith(CLEARED_REQUISITION_GROUP_FILTERS, true);
    },
  );
});
