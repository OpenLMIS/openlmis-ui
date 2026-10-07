import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FacilityProgramSelector } from '@/components/facility-program-selector/facility-program-selector';
import {
  type FacilityProgramSelection,
  facilityProgramOptions,
} from '@/lib/facility-program-selection';

const named = (id: string, name: string) => ({ id, code: id.toUpperCase(), name });

const options = facilityProgramOptions({
  homeFacilityId: 'home',
  programs: [named('fp', 'Family Planning'), named('em', 'Essential Meds')],
  facilities: [named('home', 'Comfort Health Clinic'), named('bal', 'Balaka District Hospital')],
  grants: [
    { facilityId: 'home', programId: 'fp' },
    { facilityId: 'home', programId: 'em' },
    { facilityId: 'bal', programId: 'em' },
    { facilityId: 'bal', programId: 'fp' },
  ],
});

function renderSelector(applied: FacilityProgramSelection = {}, pickerOptions = options) {
  const onSearch = vi.fn();
  const onDraftChange = vi.fn();
  const view = render(
    <FacilityProgramSelector
      applied={applied}
      onDraftChange={onDraftChange}
      onSearch={onSearch}
      options={pickerOptions}
    />,
  );
  return { onSearch, onDraftChange, ...view };
}

describe('FacilityProgramSelector', () => {
  it('starts on the home facility and searches with a program granted there', async () => {
    const user = userEvent.setup();
    const { onSearch } = renderSelector();

    expect(screen.getByRole('radio', { name: /facility-program.my-facility/ })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /facility-program.facility/ })).toHaveTextContent(
      'Comfort Health Clinic',
    );
    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Essential Meds',
      'Family Planning',
    ]);
    await user.click(screen.getByRole('option', { name: 'Family Planning' }));
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

    expect(onSearch).toHaveBeenCalledWith({ mode: 'my', programId: 'fp', facilityId: 'home' });
  });

  it('starts fresh after a search, so switching mode marks nothing as missing', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    await user.click(screen.getByRole('option', { name: 'Family Planning' }));
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));
    await user.click(screen.getByRole('radio', { name: /facility-program.supervised-facility/ }));
    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    await user.click(screen.getByRole('option', { name: 'Essential Meds' }));

    expect(screen.getByRole('combobox', { name: /facility-program.facility/ })).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.queryByText('facility-program.facility-required')).not.toBeInTheDocument();
  });

  it('picks the only program the home facility offers, so Search works at once, as legacy', async () => {
    const user = userEvent.setup();
    const { onSearch } = renderSelector(
      {},
      facilityProgramOptions({
        homeFacilityId: 'home',
        programs: [named('fp', 'Family Planning')],
        facilities: [named('home', 'Comfort Health Clinic')],
        grants: [{ facilityId: 'home', programId: 'fp' }],
      }),
    );

    expect(screen.getByRole('combobox', { name: /facility-program.program/ })).toHaveTextContent(
      'Family Planning',
    );
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

    expect(onSearch).toHaveBeenCalledWith({ mode: 'my', programId: 'fp', facilityId: 'home' });
  });

  it('asks for a program before searching, picking none of several itself', async () => {
    const user = userEvent.setup();
    const { onSearch } = renderSelector();

    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

    expect(await screen.findByText('facility-program.program-required')).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('offers supervised facilities once a program is picked, and tells the page of each change', async () => {
    const user = userEvent.setup();
    const { onSearch, onDraftChange } = renderSelector();

    await user.click(screen.getByRole('radio', { name: /facility-program.supervised-facility/ }));
    const facility = screen.getByRole('combobox', { name: /facility-program.facility/ });
    expect(facility).toBeDisabled();
    expect(onDraftChange).toHaveBeenLastCalledWith({ mode: 'supervised' });

    await user.click(screen.getByRole('combobox', { name: /facility-program.program/ }));
    await user.click(screen.getByRole('option', { name: 'Essential Meds' }));
    await waitFor(() => expect(facility).toBeEnabled());
    await user.click(facility);
    await user.click(await screen.findByRole('option', { name: /Balaka District Hospital/ }));
    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

    expect(onSearch).toHaveBeenCalledWith({
      mode: 'supervised',
      programId: 'em',
      facilityId: 'bal',
    });
  });

  it('starts from the selection last searched for', () => {
    renderSelector({ mode: 'supervised', programId: 'em', facilityId: 'bal' });

    expect(
      screen.getByRole('radio', { name: /facility-program.supervised-facility/ }),
    ).toBeChecked();
    expect(screen.getByRole('combobox', { name: /facility-program.facility/ })).toHaveValue(
      'Balaka District Hospital',
    );
  });

  it('follows a new selection from the address, such as after Back', async () => {
    const { rerender, onDraftChange, onSearch } = renderSelector();

    rerender(
      <FacilityProgramSelector
        applied={{ mode: 'supervised', programId: 'em', facilityId: 'bal' }}
        onDraftChange={onDraftChange}
        onSearch={onSearch}
        options={options}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: /facility-program.supervised-facility/ }),
      ).toBeChecked(),
    );
  });

  it('turns off my facility without a home, and starts supervised', () => {
    renderSelector({}, facilityProgramOptions({ ...sourcesWithoutHome() }));

    expect(screen.getByRole('radio', { name: /facility-program.my-facility/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      screen.getByRole('radio', { name: /facility-program.supervised-facility/ }),
    ).toBeChecked();
  });

  it('lists every supervised facility, as legacy does, however many there are', async () => {
    const user = userEvent.setup();
    const facilities = Array.from({ length: 120 }, (_, index) =>
      named(`f${String(index).padStart(3, '0')}`, `Facility ${String(index).padStart(3, '0')}`),
    );
    renderSelector(
      { mode: 'supervised', programId: 'em' },
      facilityProgramOptions({
        homeFacilityId: null,
        programs: [named('em', 'Essential Meds')],
        facilities,
        grants: facilities.map((facility) => ({ facilityId: facility.id, programId: 'em' })),
      }),
    );

    await user.click(screen.getByRole('combobox', { name: /facility-program.facility/ }));

    expect(await screen.findAllByRole('option')).toHaveLength(120);
  });

  it('moves focus to the field to fix when Search is pressed too soon', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole('button', { name: 'facility-program.search' }));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /facility-program.program/ })).toHaveFocus(),
    );
  });

  it('says so when the home facility has no program for the page', () => {
    renderSelector(
      {},
      facilityProgramOptions({
        homeFacilityId: 'home',
        programs: [named('em', 'Essential Meds')],
        facilities: [named('home', 'Comfort Health Clinic'), named('bal', 'Balaka')],
        grants: [{ facilityId: 'bal', programId: 'em' }],
      }),
    );

    expect(screen.getByText('facility-program.no-home-programs')).toBeInTheDocument();
  });
});

function sourcesWithoutHome() {
  return {
    homeFacilityId: null,
    programs: [named('em', 'Essential Meds')],
    facilities: [named('bal', 'Balaka District Hospital')],
    grants: [{ facilityId: 'bal', programId: 'em' }],
  };
}
