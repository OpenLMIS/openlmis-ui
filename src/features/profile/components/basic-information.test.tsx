import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contactDetailsOptions } from '@/features/profile/api/queries';
import {
  BasicInformation,
  BasicInformationSkeleton,
} from '@/features/profile/components/basic-information';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';
import type { Profile } from '@/features/profile/lib/types';
import { fetchFacility } from '@/features/reference-data/api/api';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { client } from '@/integrations/axios';
import { userRecordKey } from '@/lib/key-factory';

vi.mock('@/features/reference-data/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reference-data/api/api')>()),
  fetchFacility: vi.fn(),
}));

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

function FromCache() {
  const { data: user } = useSuspenseQuery(userRecordOptions('u1'));
  const { data: contact } = useSuspenseQuery(contactDetailsOptions('u1'));
  return <BasicInformation onSaved={vi.fn()} profile={{ user, contact }} />;
}

beforeEach(() => {
  vi.spyOn(client, 'get').mockResolvedValue({ data: null });
  vi.spyOn(client, 'put').mockResolvedValue({ data: undefined });
});

function openProfile(queryClient: QueryClient, content: React.ReactNode) {
  const root = createRootRoute({
    component: () => <ProfileWorkspace username="ada">{content}</ProfileWorkspace>,
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
}

describe('BasicInformation', () => {
  it('refreshes the server user after the name saves and the contact write fails', async () => {
    const updated = { ...profile.user, firstName: 'Augusta', roleAssignments: [{ roleId: 'r2' }] };
    vi.mocked(client.get).mockImplementation(async (url) => ({
      data:
        url === '/users/u1'
          ? vi.mocked(client.put).mock.calls.length
            ? updated
            : profile.user
          : null,
    }));
    vi.mocked(client.put)
      .mockResolvedValueOnce({ data: undefined })
      .mockRejectedValueOnce(new Error('contact details refused'));
    const queryClient = new QueryClient();
    queryClient.setQueryData(userRecordKey('u1'), profile.user);
    const onSaved = vi.fn();
    openProfile(queryClient, <BasicInformation onSaved={onSaved} profile={profile} />);

    const firstName = await screen.findByRole('textbox', { name: /users.form.first-name/ });
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Augusta');
    await userEvent.type(screen.getByRole('textbox', { name: 'users.form.phone-number' }), '123');
    await userEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await screen.findByText('profile.save-error-title');
    expect(queryClient.getQueryData(userRecordKey('u1'))).toEqual(updated);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'users.form.phone-number' })).toHaveValue('123');
  });

  it('keeps the confirmed name on the form when refreshing the shared user fails', async () => {
    vi.mocked(client.get).mockImplementation(async (url) => {
      if (url !== '/users/u1') return { data: null };
      if (vi.mocked(client.put).mock.calls.length) throw new Error('refetch failed');
      return { data: profile.user };
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(contactDetailsOptions('u1').queryKey, profile.contact);
    queryClient.setQueryData(userRecordKey('u1'), profile.user);
    openProfile(queryClient, <FromCache />);

    const firstName = await screen.findByRole('textbox', { name: /users.form.first-name/ });
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Augusta');
    await userEvent.click(screen.getByRole('button', { name: 'profile.save' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'profile.save' })).toBeDisabled(),
    );
    expect(firstName).toHaveValue('Augusta');
    expect(queryClient.getQueryData(userRecordKey('u1'))).toEqual(profile.user);
    expect(queryClient.getQueryState(userRecordKey('u1'))?.isInvalidated).toBe(true);
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
