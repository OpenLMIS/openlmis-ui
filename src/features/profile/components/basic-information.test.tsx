import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { saveProfile } from '@/features/profile/api/api';
import { profileOptions } from '@/features/profile/api/queries';
import { BasicInformation } from '@/features/profile/components/basic-information';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';
import type { Profile } from '@/features/profile/lib/types';

vi.mock('@/features/profile/api/api', () => ({
  saveProfile: vi.fn(),
  fetchProfile: vi.fn(),
  fetchPendingEmail: vi.fn().mockResolvedValue(null),
  resendVerification: vi.fn(),
}));
vi.mock('@/features/reference-data/api/api', () => ({ fetchFacility: vi.fn() }));

const profile: Profile = {
  user: {
    id: 'u1',
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    active: true,
    roleAssignments: [],
  },
  contact: null,
};

describe('BasicInformation', () => {
  it('refreshes the profile after a save that failed part way, since part of it may be stored', async () => {
    vi.mocked(saveProfile).mockRejectedValue(new Error('contact details refused'));
    const queryClient = new QueryClient();
    queryClient.setQueryData(profileOptions('u1').queryKey, profile);
    const onSaved = vi.fn();
    const root = createRootRoute({
      component: () => (
        <ProfileWorkspace username="ada">
          <BasicInformation onSaved={onSaved} profile={profile} />
        </ProfileWorkspace>
      ),
    });
    const router = createRouter({
      routeTree: root,
      history: createMemoryHistory({ initialEntries: ['/profile'] }),
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const firstName = await screen.findByRole('textbox', { name: /users.form.first-name/ });
    await userEvent.type(firstName, 'x');
    await userEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(queryClient.getQueryState(profileOptions('u1').queryKey)?.isInvalidated).toBe(true),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
