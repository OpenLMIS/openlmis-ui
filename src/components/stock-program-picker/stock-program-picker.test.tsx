import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockProgramPicker } from '@/components/stock-program-picker/stock-program-picker';

const rows = [
  { id: 'em', label: 'Essential Meds' },
  { id: 'fp', label: 'Family Planning' },
];
const linkFor = (row: { id: string }) => <a href={`/adjustments/${row.id}`}>Make Adjustments</a>;

describe('StockProgramPicker', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 672,
    } as DOMRect);
  });

  it('shows phone cards with status and the same enabled and disabled actions', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 671,
    } as DOMRect);
    const onAction = vi.fn();
    const inventoryRows = [
      { ...rows[0], status: 'Draft', actionLabel: 'Continue' },
      { ...rows[1], actionLabel: 'Start', disabled: true },
    ];
    render(
      <StockProgramPicker
        hasHomeFacility
        statusLabel="Status"
        rows={inventoryRows}
        onAction={onAction}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Essential Meds')).toBeVisible();
    expect(within(cards[0]).getByText('Status')).toBeVisible();
    expect(within(cards[0]).getByText('Draft')).toBeVisible();
    await user.click(within(cards[0]).getByRole('button', { name: 'Continue' }));
    expect(onAction).toHaveBeenCalledWith(inventoryRows[0]);
    expect(within(cards[1]).getByText('-')).toBeVisible();
    expect(within(cards[1]).getByRole('button', { name: 'Start' })).toBeDisabled();
  });

  it("shows workflow status and each program's available action", () => {
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
