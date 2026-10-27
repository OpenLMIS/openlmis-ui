import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchFacility } from '@/features/reference-data/api/api';
import type { Facility, RequisitionGroup } from '@/features/reference-data/lib/types';
import {
  createRequisitionGroup,
  updateRequisitionGroup,
} from '@/features/requisition-groups/api/api';
import {
  REQUISITION_GROUP_LOOKUPS,
  RequisitionGroupEditor,
} from '@/features/requisition-groups/components/requisition-group-editor';
import type { RequisitionGroupEditorSearch } from '@/features/requisition-groups/lib/members';
import { queryKeys } from '@/lib/key-factory';
import type { SearchChange } from '@/lib/table-search';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('@/features/requisition-groups/api/api', () => ({
  createRequisitionGroup: vi.fn(),
  updateRequisitionGroup: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchSupervisoryNodes: vi.fn(async () => []),
  fetchPrograms: vi.fn(async () => []),
  fetchProcessingSchedules: vi.fn(async () => []),
  fetchMinimalFacilities: vi.fn(async () => []),
  fetchFacility: vi.fn(),
}));
const member = (id: string, name = id) => ({
  id,
  name,
  code: id.toUpperCase(),
  enabled: true,
  active: true,
  type: { name: 'Clinic' },
  geographicZone: { name: 'Gaza' },
});
const pickedFacility: Facility = {
  id: 'f2',
  code: 'F2',
  name: 'Second Facility',
  active: true,
  enabled: false,
  type: { id: 'hospital', code: 'H', name: 'Hospital' },
  geographicZone: { id: 'maputo', code: 'M', name: 'Maputo', level: { name: 'District' } },
};
const group: RequisitionGroup = {
  id: 'rg',
  name: 'Group',
  code: 'RG',
  supervisoryNode: { id: 'n1', name: 'Node' },
  requisitionGroupProgramSchedules: [
    {
      id: 'saved-row',
      program: { id: 'p1', name: 'Family Planning' },
      processingSchedule: { id: 's1', name: 'Quarterly' },
      directDelivery: false,
      dropOffFacility: { id: 'f1' },
    },
  ],
  memberFacilities: [member('f1', 'First Facility')],
};
function seededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(REQUISITION_GROUP_LOOKUPS.nodes.queryKey, [
    { id: 'n1', code: 'N1', name: 'Node' },
  ]);
  client.setQueryData(REQUISITION_GROUP_LOOKUPS.programs.queryKey, [
    { id: 'p1', code: 'P1', active: true, name: 'Family Planning' },
    { id: 'p2', code: 'P2', active: true, name: 'ARV' },
  ]);
  client.setQueryData(REQUISITION_GROUP_LOOKUPS.schedules.queryKey, [
    { id: 's1', code: 'Q', name: 'Quarterly' },
  ]);
  client.setQueryData(REQUISITION_GROUP_LOOKUPS.facilities.queryKey, [
    member('f1', 'First Facility'),
    member('f2', 'Second Facility'),
  ]);
  return client;
}
function Editor({
  saved,
  readOnly = false,
  initialSearch = {},
}: {
  saved?: RequisitionGroup;
  readOnly?: boolean;
  initialSearch?: RequisitionGroupEditorSearch;
}) {
  const [search, setSearch] = useState(initialSearch);
  const change: SearchChange<RequisitionGroupEditorSearch> = (update) =>
    setSearch((previous) => ({
      ...previous,
      ...(typeof update === 'function' ? update(previous) : update),
    }));
  return (
    <RequisitionGroupEditor
      saved={saved}
      readOnly={readOnly}
      title="Editor"
      description="Edit A Group."
      search={search}
      onSearchChange={change}
      onCancel={vi.fn()}
      onSaved={vi.fn()}
    />
  );
}
const renderEditor = (props: Parameters<typeof Editor>[0] = {}, queryClient = seededClient()) =>
  renderPage(<Editor {...props} />, { queryClient });
const click = async (name: string) =>
  userEvent.setup().click(await screen.findByRole('button', { name }));
async function pick(dialog: HTMLElement, field: string, option: string) {
  await userEvent
    .setup()
    .click(within(dialog).getByRole('combobox', { name: `requisition-groups.form.${field}` }));
  await userEvent.setup().click(await screen.findByRole('option', { name: new RegExp(option) }));
}
async function addProgram(name = 'ARV') {
  await click('requisition-groups.form.add-program');
  const dialog = await screen.findByRole('dialog');
  await pick(dialog, 'program', name);
  await pick(dialog, 'schedule', 'Quarterly');
  await userEvent
    .setup()
    .click(within(dialog).getByRole('button', { name: 'requisition-groups.form.add' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
  vi.mocked(createRequisitionGroup).mockResolvedValue(group);
  vi.mocked(updateRequisitionGroup).mockResolvedValue(group);
});
describe('RequisitionGroupEditor', () => {
  it('keeps the current tab and focuses the required general field', async () => {
    renderEditor({ initialSearch: { tab: 'facilities' } });
    await click('requisition-groups.form.save');
    expect(await screen.findByText('requisition-groups.form.name-required')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'requisition-groups.form.name' })).toHaveFocus(),
    );
    expect(screen.getByRole('tab', { name: /requisition-groups.form.facilities/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(createRequisitionGroup).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'requisition-groups.form.name' }), {
      target: { value: ' New Group ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'requisition-groups.form.code' }), {
      target: { value: ' NEW ' },
    });
    await pick(document.body, 'node', 'Node');
    await click('requisition-groups.form.save');
    await waitFor(() =>
      expect(createRequisitionGroup).toHaveBeenCalledWith({
        name: 'New Group',
        code: 'NEW',
        supervisoryNode: { id: 'n1' },
        memberFacilities: [],
        requisitionGroupProgramSchedules: [],
      }),
    );
  });
  it('validates the add dialog, excludes listed programs and moves focus after removal', async () => {
    localStorage.setItem(
      'requisition-group-programs.column-visibility',
      JSON.stringify({ dropOffFacility: true }),
    );
    renderEditor({ saved: group });
    const dropOff = await screen.findByRole('columnheader', {
      name: 'requisition-groups.form.drop-off',
    });
    expect(
      within(dropOff.closest('table') as HTMLElement).getByText('First Facility'),
    ).toBeVisible();
    await click('requisition-groups.form.add-program');
    const dialog = await screen.findByRole('dialog');
    await userEvent
      .setup()
      .click(within(dialog).getByRole('button', { name: 'requisition-groups.form.add' }));
    expect(
      await within(dialog).findByText('requisition-groups.form.program-required'),
    ).toBeVisible();
    expect(within(dialog).getByText('requisition-groups.form.schedule-required')).toBeVisible();
    await userEvent
      .setup()
      .click(within(dialog).getByRole('combobox', { name: 'requisition-groups.form.program' }));
    expect(screen.queryByRole('option', { name: 'Family Planning' })).toBeNull();
    await userEvent.setup().click(await screen.findByRole('option', { name: 'ARV' }));
    await pick(dialog, 'schedule', 'Quarterly');
    await userEvent
      .setup()
      .click(within(dialog).getByRole('button', { name: 'requisition-groups.form.add' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const buttons = screen.getAllByRole('button', {
      name: 'requisition-groups.form.remove-program',
    });
    await userEvent.setup().click(buttons[0] as HTMLElement);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'requisition-groups.form.remove-program' }),
      ).toHaveFocus(),
    );
    await click('requisition-groups.form.remove-program');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'requisition-groups.form.add-program' }),
      ).toHaveFocus(),
    );
    expect(screen.getByText('requisition-groups.form.no-programs')).toBeVisible();
  });
  it('excludes members, keeps a failed facility read open and appends the full facility on retry', async () => {
    let resolveFacility!: (value: Facility) => void;
    vi.mocked(fetchFacility)
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFacility = resolve;
          }),
      );
    renderEditor({ saved: group, initialSearch: { tab: 'facilities' } });
    await click('requisition-groups.form.add-facility');
    const dialog = await screen.findByRole('dialog');
    await userEvent
      .setup()
      .click(within(dialog).getByRole('combobox', { name: 'requisition-groups.form.facility' }));
    expect(screen.queryByRole('option', { name: /First Facility/ })).toBeNull();
    await userEvent.setup().click(await screen.findByRole('option', { name: /Second Facility/ }));
    await userEvent
      .setup()
      .click(within(dialog).getByRole('button', { name: 'requisition-groups.form.add' }));
    expect(
      await within(dialog).findByText('requisition-groups.form.facility-error-title'),
    ).toBeVisible();
    await userEvent
      .setup()
      .click(within(dialog).getByRole('button', { name: 'requisition-groups.form.add' }));
    await waitFor(() => expect(fetchFacility).toHaveBeenCalledTimes(2));
    expect(
      within(dialog).getByRole('button', { name: 'requisition-groups.form.cancel' }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('combobox', { name: 'requisition-groups.form.facility' }),
    ).toBeDisabled();
    resolveFacility(pickedFacility);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fetchFacility).toHaveBeenCalledWith('f2');
    const addedRow = screen.getByText('Second Facility').closest('tr') as HTMLElement;
    expect(within(addedRow).getByText('Hospital')).toBeVisible();
    expect(within(addedRow).getByText('Maputo')).toBeVisible();
    expect(within(addedRow).getByText('requisition-groups.form.no')).toBeVisible();
    await click('requisition-groups.form.save');
    await waitFor(() =>
      expect(updateRequisitionGroup).toHaveBeenCalledWith(
        'rg',
        expect.objectContaining({
          memberFacilities: [
            { id: 'f1', code: 'F1' },
            { id: 'f2', code: 'F2' },
          ],
        }),
      ),
    );
  });
  it('ignores a facility read that completes after the session changes', async () => {
    let resolve!: (facility: Facility) => void;
    vi.mocked(fetchFacility).mockImplementation(
      () =>
        new Promise<Facility>((done) => {
          resolve = done;
        }),
    );
    renderEditor({ saved: group, initialSearch: { tab: 'facilities' } });
    await click('requisition-groups.form.add-facility');
    const dialog = await screen.findByRole('dialog');
    await pick(dialog, 'facility', 'Second Facility');
    await userEvent
      .setup()
      .click(within(dialog).getByRole('button', { name: 'requisition-groups.form.add' }));
    await waitFor(() => expect(fetchFacility).toHaveBeenCalledWith('f2'));
    const previous = useLoginData.getState().referenceDataUserId;
    try {
      await act(async () => {
        useLoginData.setState({ referenceDataUserId: 'another-user' });
        resolve(pickedFacility);
      });
      expect(screen.getByRole('dialog')).toBeVisible();
      expect(screen.queryByRole('cell', { name: 'Second Facility' })).toBeNull();
      expect(screen.queryByText('requisition-groups.form.facility-error-title')).toBeNull();
    } finally {
      act(() => useLoginData.setState({ referenceDataUserId: previous }));
    }
  });
  it('keeps both edited collections through tab, filter, sort and page changes, reusing a saved row without drop-off', async () => {
    vi.mocked(fetchFacility).mockResolvedValue(pickedFacility);
    const members = Array.from({ length: 12 }, (_, i) => member(`m${i}`, `Member ${i}`));
    renderEditor({ saved: { ...group, memberFacilities: members } });
    await click('requisition-groups.form.remove-program');
    await addProgram('Family Planning');
    await addProgram();
    await userEvent
      .setup()
      .click(await screen.findByRole('tab', { name: /requisition-groups.form.facilities/ }));
    await userEvent.setup().click(
      screen.getAllByRole('button', {
        name: 'requisition-groups.form.remove-facility',
      })[0] as HTMLElement,
    );
    await click('requisition-groups.form.add-facility');
    const facilityDialog = await screen.findByRole('dialog');
    await pick(facilityDialog, 'facility', 'Second Facility');
    await userEvent
      .setup()
      .click(within(facilityDialog).getByRole('button', { name: 'requisition-groups.form.add' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent
      .setup()
      .type(
        screen.getByRole('textbox', { name: 'requisition-groups.form.member-search' }),
        'Member',
      );
    await waitFor(() => expect(screen.queryByText('Second Facility')).toBeNull());
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'requisition-groups.form.facility-name' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next Page' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    await userEvent
      .setup()
      .click(screen.getByRole('tab', { name: /requisition-groups.form.programs/ }));
    await click('requisition-groups.form.save');
    await waitFor(() => expect(updateRequisitionGroup).toHaveBeenCalled());
    const body = vi.mocked(updateRequisitionGroup).mock.calls[0]?.[1];
    expect(body?.memberFacilities).toHaveLength(12);
    expect(body?.memberFacilities).toContainEqual({ id: 'f2', code: 'F2' });
    expect(body?.memberFacilities).not.toContainEqual({ id: 'm0', code: 'M0' });
    expect(body?.requisitionGroupProgramSchedules).toEqual([
      {
        id: 'saved-row',
        program: { id: 'p1' },
        processingSchedule: { id: 's1' },
        directDelivery: false,
      },
      { program: { id: 'p2' }, processingSchedule: { id: 's1' }, directDelivery: false },
    ]);
  });
  it('sends empty arrays after removing every row and keeps the draft with the refused server message', async () => {
    const error = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { message: 'Code Is Already Used' },
    });
    vi.mocked(updateRequisitionGroup).mockRejectedValue(error);
    renderEditor({ saved: group });
    await click('requisition-groups.form.remove-program');
    await userEvent
      .setup()
      .click(screen.getByRole('tab', { name: /requisition-groups.form.facilities/ }));
    await click('requisition-groups.form.remove-facility');
    fireEvent.change(screen.getByRole('textbox', { name: 'requisition-groups.form.name' }), {
      target: { value: 'Changed' },
    });
    await click('requisition-groups.form.save');
    expect(await screen.findByText('Code Is Already Used')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'requisition-groups.form.name' })).toHaveValue(
      'Changed',
    );
    expect(updateRequisitionGroup).toHaveBeenCalledWith(
      'rg',
      expect.objectContaining({ memberFacilities: [], requisitionGroupProgramSchedules: [] }),
    );
    expect(screen.getByText('requisition-groups.form.no-facilities')).toBeVisible();
  });
  it('keeps the draft inert and Cancel disabled until the save succeeds', async () => {
    let resolveSave!: (value: RequisitionGroup) => void;
    vi.mocked(updateRequisitionGroup).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const queryClient = seededClient();
    const listKey = queryKeys.requisitionGroups.list({ page: 0, size: 10 });
    queryClient.setQueryData(listKey, { content: [group] });
    queryClient.setQueryData(queryKeys.requisitionGroups.detail(group.id), group);
    renderEditor({ saved: group }, queryClient);
    await click('requisition-groups.form.save');
    await waitFor(() => expect(updateRequisitionGroup).toHaveBeenCalled());
    expect(screen.getByRole('tablist').closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'requisition-groups.form.cancel' })).toBeDisabled();
    resolveSave(group);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'requisition-groups.form.cancel' }),
      ).not.toBeDisabled(),
    );
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryData(queryKeys.requisitionGroups.detail(group.id))).toBeUndefined();
  });
  it('disables the legacy view fields without required marks and keeps member filtering and paging available', async () => {
    localStorage.setItem(
      'requisition-group-programs.column-visibility',
      JSON.stringify({ dropOffFacility: true }),
    );
    renderEditor({
      saved: {
        ...group,
        memberFacilities: Array.from({ length: 12 }, (_, i) => member(`m${i}`, `Member ${i}`)),
      },
      readOnly: true,
    });
    for (const label of ['view-code', 'view-name', 'node']) {
      const input = await screen.findByRole(label === 'node' ? 'combobox' : 'textbox', {
        name: `requisition-groups.form.${label}`,
      });
      expect(input).toBeDisabled();
      expect(input).not.toHaveAttribute('aria-required', 'true');
    }
    expect(screen.queryByRole('button', { name: 'requisition-groups.form.save' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'requisition-groups.form.add-program' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'requisition-groups.form.remove-program' }),
    ).toBeNull();
    const dropOff = screen.getByRole('columnheader', { name: 'requisition-groups.form.drop-off' });
    expect(
      within(dropOff.closest('table') as HTMLElement).getByText('First Facility'),
    ).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole('tab', { name: /requisition-groups.form.facilities/ }));
    expect(
      screen.queryByRole('button', { name: 'requisition-groups.form.add-facility' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'requisition-groups.form.remove-facility' }),
    ).toBeNull();
    expect(screen.queryByText('requisition-groups.actions')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next Page' }));
    await userEvent
      .setup()
      .type(
        screen.getByRole('textbox', { name: 'requisition-groups.form.member-search' }),
        'absent',
      );
    expect(await screen.findByText('requisition-groups.form.no-matches')).toBeVisible();
    await click('requisition-groups.form.clear-filter');
    fireEvent.submit(document.getElementById('requisition-group-form') as HTMLElement);
    expect(updateRequisitionGroup).not.toHaveBeenCalled();
    expect(createRequisitionGroup).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
