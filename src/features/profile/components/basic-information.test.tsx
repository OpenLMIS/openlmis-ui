import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fetchProfile, saveProfile } from '@/features/profile/api/api';
import { profileOptions } from '@/features/profile/api/queries';
import {
  BasicInformation,
  BasicInformationSkeleton,
} from '@/features/profile/components/basic-information';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';
import type { Profile } from '@/features/profile/lib/types';
import { fetchFacility } from '@/features/reference-data/api/api';

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

/** As the route renders it: the profile read from the cache, so a save's refresh reaches the form. */
function FromCache() {
  const { data } = useSuspenseQuery(profileOptions('u1'));
  return <BasicInformation onSaved={vi.fn()} profile={data} />;
}

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
    await waitFor(() => expect(fetchProfile).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('keeps what was saved on screen when the refresh after a save fails', async () => {
    vi.mocked(saveProfile).mockReset().mockResolvedValue();
    vi.mocked(fetchProfile).mockRejectedValue(new Error('offline'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(profileOptions('u1').queryKey, profile);
    const root = createRootRoute({
      component: () => (
        <ProfileWorkspace username="ada">
          <FromCache />
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
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Augusta');
    await userEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await waitFor(() =>
      expect(queryClient.getQueryData(profileOptions('u1').queryKey)?.user.firstName).toBe(
        'Augusta',
      ),
    );
    expect(fetchProfile).toHaveBeenCalled();
    expect(firstName).toHaveValue('Augusta');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'profile.save' })).toBeDisabled(),
    );
  });

  it('shows the saved email as verified beside its label, read with the field, and a hint once it is changed', async () => {
    const queryClient = new QueryClient();
    const verified: Profile = {
      ...profile,
      contact: {
        referenceDataUserId: 'u1',
        allowNotify: true,
        emailDetails: { email: 'ada@example.org', emailVerified: true },
      },
    };
    const root = createRootRoute({
      component: () => (
        <ProfileWorkspace username="ada">
          <BasicInformation onSaved={vi.fn()} profile={verified} />
        </ProfileWorkspace>
      ),
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider
          router={createRouter({
            routeTree: root,
            history: createMemoryHistory({ initialEntries: ['/profile'] }),
          })}
        />
      </QueryClientProvider>,
    );

    const email = await screen.findByRole('textbox', { name: 'users.email' });
    expect(screen.getByText('users.form.email-verified')).toBeInTheDocument();
    expect(email).toHaveAccessibleDescription('users.form.email-verified');

    await userEvent.type(email, 'x');

    expect(screen.queryByText('users.form.email-verified')).toBeNull();
    expect(email).toHaveAccessibleDescription('profile.email.change-hint');
  });

  it('names a home facility without a name by its code alone', async () => {
    vi.mocked(fetchFacility).mockResolvedValue({
      id: 'f1',
      code: 'HC01',
      name: null,
      active: true,
      enabled: true,
      type: { id: 't1', code: 'health_center', name: 'Health Center' },
      geographicZone: { id: 'z1', code: 'gaza', name: 'Gaza', level: { name: 'Province' } },
    });
    const withHome: Profile = { ...profile, user: { ...profile.user, homeFacilityId: 'f1' } };
    const queryClient = new QueryClient();
    const router = createRouter({
      routeTree: createRootRoute({
        component: () => <BasicInformation onSaved={vi.fn()} profile={withHome} />,
      }),
      history: createMemoryHistory({ initialEntries: ['/profile'] }),
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('HC01')).toBeInTheDocument();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('holds every row of the form under its real label while the profile loads', () => {
    render(<BasicInformationSkeleton />);

    for (const label of [
      'users.username',
      'users.form.job-title',
      'users.form.home-facility',
      'users.form.first-name',
      'users.form.last-name',
      'users.email',
      'users.form.phone-number',
      'users.form.allow-notify',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
