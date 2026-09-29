import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { rolesOptions } from '@/features/reference-data/api/queries';
import { RoleAssignmentsTable } from '@/features/users/components/role-assignments-table';
import { ROLE_TABS, type RoleRow, type RoleTab } from '@/features/users/lib/role-assignments';

const [supervision, , reports] = ROLE_TABS;

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'cimode', keySeparator: false, nsSeparator: false });
});

const row: RoleRow = {
  id: 'r1',
  assignment: { roleId: 'r1' },
  role: 'Report Viewer',
  program: undefined,
  node: undefined,
  nodeFacility: undefined,
  facility: undefined,
  isHomeFacility: false,
  isIgnored: false,
  isUnsaved: false,
};

function renderTable(rows: RoleRow[], editable: boolean, tab: RoleTab = reports) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(rolesOptions().queryKey, [
    {
      id: 'r1',
      name: 'Report Viewer',
      rights: [{ id: 'x1', name: 'REPORTS_VIEW', type: 'REPORTS' }],
    },
  ]);
  render(
    <QueryClientProvider client={queryClient}>
      <RoleAssignmentsTable
        compact={false}
        onAdd={editable ? vi.fn() : undefined}
        onRemove={editable ? vi.fn() : undefined}
        onSearchChange={vi.fn()}
        rows={rows}
        search={{}}
        status={{ nodes: 'ready', facilities: 'ready' }}
        tab={tab}
      />
    </QueryClientProvider>,
  );
}

describe('RoleAssignmentsTable', () => {
  it("shows a role's rights from the button beside its name, without a dialog", async () => {
    renderTable([row], false);
    expect(screen.queryByRole('button', { name: 'Report Viewer' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'role-rights.title' }));

    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByText('role-rights.title')).toBeInTheDocument();
    expect(within(popover).getByText('Reports View')).toBeInTheDocument();
  });

  it('offers no row actions for roles that are shown, not edited', () => {
    renderTable([row], false);

    expect(screen.queryByRole('button', { name: /users.roles.actions-for/ })).toBeNull();
  });

  it('lists the program and the node before the role', () => {
    renderTable(
      [{ ...row, program: 'Family Planning', node: 'FP approval point' }],
      false,
      supervision,
    );

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'users.roles.column.program',
      'users.roles.column.node',
      'users.roles.column.role',
    ]);
  });

  it('lists only the role on tabs with nothing else to show, as legacy does', () => {
    renderTable([row], false);

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'users.roles.column.role',
    ]);
  });

  it('offers Remove when the roles can be edited', async () => {
    renderTable([row], true);

    await userEvent.click(screen.getByRole('button', { name: /users.roles.actions-for/ }));

    expect(screen.getByRole('menuitem', { name: 'users.roles.remove' })).toBeInTheDocument();
  });

  it('points to an administrator, not an Add button, when a shown tab is empty', () => {
    renderTable([], false);

    expect(screen.getByText('users.roles.empty-read-only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'users.roles.add' })).toBeNull();
  });
});
