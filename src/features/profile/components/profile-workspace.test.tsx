import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';

function renderAt(path: string, page: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => page }),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('ProfileWorkspace', () => {
  it('keeps the tabs usable while the profile loads, holding the places of its name and Change Password', async () => {
    renderAt('/profile/roles', <ProfileWorkspace>content</ProfileWorkspace>);

    expect(await screen.findByRole('tab', { name: 'profile.tabs.roles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'profile.tabs.basic' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(
      screen.queryByRole('button', { name: 'profile.password.title' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('profile.description')).not.toBeInTheDocument();
  });

  it('names the user and offers Change Password once the profile is there', async () => {
    renderAt('/profile', <ProfileWorkspace username="ada">content</ProfileWorkspace>);

    expect(
      await screen.findByRole('button', { name: 'profile.password.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('profile.description')).toBeInTheDocument();
  });
});
