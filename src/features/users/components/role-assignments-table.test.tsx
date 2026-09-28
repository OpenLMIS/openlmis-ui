import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoleAssignmentsTable } from '@/features/users/components/role-assignments-table';
import { ROLE_TABS, type RoleRow } from '@/features/users/lib/role-assignments';

const reports = ROLE_TABS[2];

const row: RoleRow = {
  id: 'r1',
  assignment: { roleId: 'r1' },
  role: 'Report Viewer',
  description: 'Sees reports',
  program: undefined,
  node: undefined,
  nodeFacility: undefined,
  facility: undefined,
  isHomeFacility: false,
  isIgnored: false,
  isUnsaved: false,
};

function renderTable(rows: RoleRow[], editable: boolean) {
  render(
    <RoleAssignmentsTable
      compact={false}
      onAdd={editable ? vi.fn() : undefined}
      onRemove={editable ? vi.fn() : undefined}
      onSearchChange={vi.fn()}
      onViewRights={vi.fn()}
      rows={rows}
      search={{}}
      status={{ nodes: 'ready', facilities: 'ready' }}
      tab={reports}
    />,
  );
}

describe('RoleAssignmentsTable', () => {
  it('offers only View Rights for roles that are shown, not edited', async () => {
    renderTable([row], false);

    await userEvent.click(screen.getByRole('button', { name: /users.roles.actions-for/ }));

    expect(screen.getByRole('menuitem', { name: 'users.roles.view-rights' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'users.roles.remove' })).toBeNull();
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
