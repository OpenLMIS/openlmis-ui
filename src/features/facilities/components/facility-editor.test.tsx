import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  FACILITY_EDITOR_LOOKUPS,
  FacilityEditor,
} from '@/features/facilities/components/facility-editor';
import {
  EMPTY_FACILITY_FORM,
  type FacilityFormValues,
  type FacilityTab,
  toFacilityFormValues,
} from '@/features/facilities/lib/facility-form';
import type { Facility } from '@/features/reference-data/lib/types';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/reference-data/api/api', () => {
  const pending = () => new Promise<never>(() => {});
  return {
    fetchFacilityTypes: vi.fn(pending),
    fetchGeographicZones: vi.fn(pending),
    fetchFacilityOperators: vi.fn(pending),
    fetchPrograms: vi.fn(pending),
  };
});

const row = (id: string, name: string) => ({
  id,
  code: id.toUpperCase(),
  name,
  supportActive: true,
  supportLocallyFulfilled: false,
  supportStartDate: '2026-10-01',
  saved: false,
});

function seededClient() {
  const queryClient = new QueryClient();
  const { types, zones, operators, programs } = FACILITY_EDITOR_LOOKUPS;
  queryClient.setQueryData(types.queryKey, [
    {
      id: 't1',
      code: 'health_center',
      name: 'Health Center',
      displayOrder: 1,
      active: true,
      primaryHealthCare: true,
    },
  ]);
  queryClient.setQueryData(zones.queryKey, [
    { id: 'z1', code: 'gaza', name: 'Gaza', level: { name: 'Province' } },
  ]);
  queryClient.setQueryData(operators.queryKey, [
    { id: 'o1', code: 'moh', name: 'Ministry of Health' },
  ]);
  queryClient.setQueryData(programs.queryKey, [
    { id: 'p1', code: 'PRG001', name: 'Family Planning', active: true },
  ]);
  return queryClient;
}

function Editor({
  initialValues = EMPTY_FACILITY_FORM,
  save,
  saved,
}: {
  initialValues?: FacilityFormValues;
  save: (values: FacilityFormValues) => Promise<Facility>;
  saved?: Facility;
}) {
  const [tab, setTab] = useState<FacilityTab>('information');
  return (
    <FacilityEditor
      saved={saved}
      description="Set up a facility"
      discardDescription="Discard?"
      initialValues={initialValues}
      onCancel={vi.fn()}
      onSaved={vi.fn()}
      onTabChange={setTab}
      save={save}
      submitLabel="Create"
      tab={tab}
      title="Add Facility"
    />
  );
}

const filled: FacilityFormValues = {
  ...EMPTY_FACILITY_FORM,
  name: 'Comfort Health Clinic',
  code: 'HC01',
  typeId: 't1',
  zoneId: 'z1',
};

const duplicateCode = () =>
  new AxiosError('Bad Request', '400', undefined, undefined, {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { messageKey: 'referenceData.error.facility.code.mustBeUnique' },
  });

describe('FacilityEditor', () => {
  it('keeps what was typed on one tab while the other is open', async () => {
    const user = userEvent.setup();
    renderPage(<Editor save={vi.fn()} />, { queryClient: seededClient() });

    await user.type(
      await screen.findByRole('textbox', { name: 'facilities.form.name' }, { timeout: 3000 }),
      'Comfort',
    );
    await user.click(screen.getByRole('tab', { name: /programs/i }));
    await user.click(screen.getByRole('tab', { name: /information/i }));

    expect(screen.getByRole('textbox', { name: 'facilities.form.name' })).toHaveValue('Comfort');
  });

  it('opens the Programs tab when only a program row is wrong', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    renderPage(
      <Editor
        initialValues={{
          ...filled,
          programs: [
            {
              id: 'p1',
              code: 'PRG001',
              name: 'Family Planning',
              supportActive: true,
              supportLocallyFulfilled: false,
              supportStartDate: '',
              saved: false,
            },
          ],
        }}
        save={save}
      />,
      { queryClient: seededClient() },
    );

    await user.click(await screen.findByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /programs/i })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('flags a code the server refused on the Code field and goes back to Information', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValue(duplicateCode());
    renderPage(<Editor initialValues={filled} save={save} />, { queryClient: seededClient() });

    await user.click(await screen.findByRole('tab', { name: /programs/i }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    const code = await screen.findByRole('textbox', { name: 'facilities.form.code' });
    await waitFor(() => expect(code).toHaveAttribute('aria-invalid', 'true'));
    expect(code).toHaveAccessibleDescription('facilities.form.code-taken');
    expect(screen.getByRole('tab', { name: /information/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByText('facilities.form.save-error-title')).toBeNull();
  });

  it('lets the user type while the lists are still loading', async () => {
    const user = userEvent.setup();
    renderPage(<Editor save={vi.fn()} />);

    await user.type(
      await screen.findByRole('textbox', { name: 'facilities.form.name' }),
      'Comfort',
    );

    expect(screen.getByRole('textbox', { name: 'facilities.form.name' })).toHaveValue('Comfort');
    expect(screen.queryByRole('combobox', { name: 'facilities.form.zone' })).toBeNull();
  });

  it('creates when its fields are submitted, as Enter in one does', async () => {
    const save = vi.fn().mockReturnValue(new Promise(() => {}));
    renderPage(<Editor initialValues={filled} save={save} />, { queryClient: seededClient() });

    const name = await screen.findByRole('textbox', { name: 'facilities.form.name' });
    fireEvent.submit(name.closest('form') as HTMLFormElement);

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });

  it('keeps the focus in the table when a program row is removed', async () => {
    const user = userEvent.setup();
    renderPage(
      <Editor
        initialValues={{ ...filled, programs: [row('p1', 'Family Planning'), row('p2', 'ARV')] }}
        save={vi.fn()}
      />,
      { queryClient: seededClient() },
    );
    await user.click(await screen.findByRole('tab', { name: /programs/i }));

    const [first] = screen.getAllByRole('button', { name: 'facilities.form.remove-program' });
    await user.click(first as HTMLElement);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'facilities.form.remove-program' })).toHaveFocus(),
    );
    await user.click(screen.getByRole('button', { name: 'facilities.form.remove-program' }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'facilities.form.program' })).toHaveFocus(),
    );
  });

  it('takes no input while a save is on its way, so nothing typed then is lost', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockReturnValue(new Promise(() => {}));
    renderPage(<Editor initialValues={filled} save={save} />, { queryClient: seededClient() });

    await user.click(await screen.findByRole('button', { name: 'Create' }, { timeout: 3000 }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(screen.getByRole('tablist').closest('[inert]')).not.toBeNull();
  });

  describe('editing', () => {
    const facility: Facility = {
      id: 'f1',
      code: 'HC01',
      name: 'Comfort Health Clinic',
      active: true,
      enabled: true,
      goLiveDate: '2017-01-01',
      type: { id: 't9', code: 'retired', name: 'Retired Type' },
      geographicZone: { id: 'z1', code: 'gaza', name: 'Gaza', level: { name: 'Province' } },
      operator: null,
      extraData: {},
      supportedPrograms: [
        {
          id: 'p1',
          code: 'PRG001',
          name: 'Family Planning',
          supportActive: true,
          supportLocallyFulfilled: false,
          supportStartDate: '2026-10-01',
        },
      ],
    };

    const renderEdit = (saved: Facility) =>
      renderPage(
        <Editor initialValues={toFacilityFormValues(saved)} save={vi.fn()} saved={saved} />,
        { queryClient: seededClient() },
      );

    it('keeps the current type on offer though it is no longer active', async () => {
      renderEdit(facility);

      expect(
        await screen.findByRole('combobox', { name: 'facilities.form.type' }, { timeout: 3000 }),
      ).toHaveValue('Retired Type');
    });

    it('locks what another system manages and says why', async () => {
      renderEdit({ ...facility, extraData: { isManagedExternally: 'true' } });

      expect(
        await screen.findByRole('textbox', { name: 'facilities.form.name' }, { timeout: 3000 }),
      ).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'facilities.form.code' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'facilities.form.description' })).toBeDisabled();
      expect(screen.getByRole('switch', { name: 'facilities.form.active' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(await screen.findByRole('combobox', { name: 'facilities.form.zone' })).toBeDisabled();
      expect(screen.getByRole('switch', { name: 'facilities.form.enabled' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByText('facilities.form.managed-externally-title')).toBeInTheDocument();
    });

    it('marks the operational date required, with no clear button, as legacy asks for it', async () => {
      renderEdit(facility);

      expect(
        await screen.findByRole(
          'button',
          { name: /^facilities\.form\.go-live-date Required/ },
          { timeout: 3000 },
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'facilities.form.clear-go-live-date' }),
      ).toBeNull();
    });

    it('never offers to remove a program the facility already supports', async () => {
      const user = userEvent.setup();
      renderEdit(facility);

      await user.click(await screen.findByRole('tab', { name: /programs/i }, { timeout: 3000 }));

      expect(screen.getByText('Family Planning')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'facilities.form.remove-program' })).toBeNull();
    });
  });
});
