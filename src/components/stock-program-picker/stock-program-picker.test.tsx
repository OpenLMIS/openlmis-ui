import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StockProgramPicker } from '@/components/stock-program-picker/stock-program-picker';

const rows = [
  { id: 'em', label: 'Essential Meds' },
  { id: 'fp', label: 'Family Planning' },
];
const linkFor = (row: { id: string }) => <a href={`/adjustments/${row.id}`}>Make Adjustments</a>;

describe('StockProgramPicker', () => {
  it('adds statuses and row action labels while retaining the default action', () => {
    render(
      <StockProgramPicker
        actionLabel="Start"
        hasHomeFacility
        statusLabel="Status"
        linkFor={(row) => <a href={`/inventory/${row.id}`}>{row.actionLabel ?? 'Start'}</a>}
        rows={[
          { ...rows[0], status: 'Draft', actionLabel: 'Continue' },
          { ...rows[1], status: 'Not Yet Started' },
        ]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(
      within(screen.getByText('Essential Meds').closest('tr') as HTMLElement).getByRole('link', {
        name: 'Continue',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText('Family Planning').closest('tr') as HTMLElement).getByRole('link', {
        name: 'Start',
      }),
    ).toBeInTheDocument();
  });

  it('lists each program with a link to its action', () => {
    render(
      <StockProgramPicker
        actionLabel="Make Adjustments"
        hasHomeFacility
        linkFor={linkFor}
        rows={rows}
      />,
    );

    const table = screen.getByRole('table');
    expect(
      within(table).getByRole('columnheader', { name: 'stock-programs.program' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', { name: 'stock-programs.action' }),
    ).toBeInTheDocument();
    for (const row of rows) {
      const tableRow = screen.getByText(row.label).closest('tr') as HTMLElement;
      expect(within(tableRow).getByRole('link', { name: 'Make Adjustments' })).toHaveAttribute(
        'href',
        `/adjustments/${row.id}`,
      );
    }
  });

  it('explains that the home facility has no programs for this action', () => {
    render(
      <StockProgramPicker
        actionLabel="Make Adjustments"
        hasHomeFacility
        linkFor={linkFor}
        rows={[]}
      />,
    );

    expect(screen.getByText('stock-programs.no-programs')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('explains a missing home facility separately', () => {
    render(
      <StockProgramPicker
        actionLabel="Make Adjustments"
        hasHomeFacility={false}
        linkFor={linkFor}
        rows={[]}
      />,
    );

    expect(screen.getByText('facility-program.no-home')).toBeInTheDocument();
    expect(screen.queryByText('stock-programs.no-programs')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
