import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  WorkspaceFooterPortal,
  WorkspaceFooterScope,
  WorkspaceTabs,
} from '@/components/workspace-tabs';

const TABS = [
  { to: '/profile', label: 'Basic' },
  { to: '/profile/roles', label: 'Roles' },
] as const;

function renderAt(path: string, page: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => page }),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
}

describe('WorkspaceTabs', () => {
  it('selects the tab the address points at, each tab a link', async () => {
    renderAt(
      '/profile/roles/',
      <WorkspaceTabs label="Sections" tabs={TABS}>
        page
      </WorkspaceTabs>,
    );

    expect(await screen.findByRole('tab', { name: 'Roles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Basic' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
  });

  it('falls back to the first tab for an address it does not list', async () => {
    renderAt(
      '/elsewhere',
      <WorkspaceTabs label="Sections" tabs={TABS}>
        page
      </WorkspaceTabs>,
    );

    expect(await screen.findByRole('tab', { name: 'Basic' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('WorkspaceFooterPortal', () => {
  it('puts a tab footer after the page, outside it', async () => {
    renderAt(
      '/',
      <WorkspaceFooterScope>
        <main>
          <WorkspaceFooterPortal>
            <button type="button">Save</button>
          </WorkspaceFooterPortal>
        </main>
      </WorkspaceFooterScope>,
    );

    const save = await screen.findByRole('button', { name: 'Save' });
    expect(screen.getByRole('main')).not.toContainElement(save);
  });
});
