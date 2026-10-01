import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
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
} from '@/features/facilities/lib/facility-form';
import type { Facility } from '@/features/reference-data/lib/types';
import { renderPage } from '@/tests/render-page';

function seededClient() {
  const queryClient = new QueryClient();
  const [types, zones, operators, programs] = FACILITY_EDITOR_LOOKUPS;
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
}: {
  initialValues?: FacilityFormValues;
  save: (values: FacilityFormValues) => Promise<Facility>;
}) {
  const [tab, setTab] = useState<FacilityTab>('information');
  return (
    <FacilityEditor
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
      await screen.findByRole('textbox', { name: 'facilities.form.name' }),
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
});
