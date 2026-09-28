import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  fetchDigestConfigurations,
  fetchPendingEmail,
  fetchProfile,
  fetchSubscriptions,
  resendVerification,
  saveProfile,
  saveSubscriptions,
} from '@/features/profile/api/api';
import type { ContactDetails, Profile, ProfileUser } from '@/features/profile/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const put = vi.mocked(client.put);

const notFound = () =>
  new AxiosError('Not Found', '404', undefined, undefined, {
    status: 404,
    statusText: 'Not Found',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const user: ProfileUser = {
  id: 'u1',
  username: 'ada',
  firstName: 'Ada',
  lastName: 'Lovelace',
  active: true,
  jobTitle: 'Analyst',
  timezone: 'UTC',
  homeFacilityId: 'f1',
  extraData: { theme: 'dark' },
  roleAssignments: [{ roleId: 'r1', programId: 'p1' }],
};

const contact: ContactDetails = {
  referenceDataUserId: 'u1',
  phoneNumber: '123',
  allowNotify: true,
  emailDetails: { email: 'ada@example.org', emailVerified: true },
};

const profile: Profile = { user, contact };

const values = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.org',
  phoneNumber: '123',
  allowNotify: true,
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
});

describe('fetchProfile', () => {
  it('loads the user and their contact details', async () => {
    get.mockResolvedValueOnce({ data: user }).mockResolvedValueOnce({ data: contact });

    await expect(fetchProfile('u1')).resolves.toEqual(profile);
    expect(get).toHaveBeenCalledWith('/users/u1');
    expect(get).toHaveBeenCalledWith('/userContactDetails/u1');
  });

  it('treats missing contact details as none', async () => {
    get.mockResolvedValueOnce({ data: user }).mockRejectedValueOnce(notFound());

    await expect(fetchProfile('u1')).resolves.toEqual({ user, contact: null });
  });

  it('never reads the sign-in account, which the page does not show', async () => {
    get.mockResolvedValueOnce({ data: user }).mockResolvedValueOnce({ data: contact });

    await fetchProfile('u1');

    expect(get).not.toHaveBeenCalledWith('/users/auth/u1');
  });
});

describe('fetchPendingEmail', () => {
  it('returns the address waiting to be verified', async () => {
    get.mockResolvedValueOnce({ data: { emailAddress: 'new@example.org', token: 't' } });

    await expect(fetchPendingEmail('u1')).resolves.toBe('new@example.org');
    expect(get).toHaveBeenCalledWith('/userContactDetails/u1/verifications');
  });

  it('returns none for an empty answer or missing contact details', async () => {
    get.mockResolvedValueOnce({ data: '' }).mockRejectedValueOnce(notFound());

    await expect(fetchPendingEmail('u1')).resolves.toBeNull();
    await expect(fetchPendingEmail('u1')).resolves.toBeNull();
  });
});

describe('saveProfile', () => {
  it('changes only the names, on the user as it is now, keeping every other field', async () => {
    const fresh = { ...user, roleAssignments: [{ roleId: 'r2' }] };
    get.mockResolvedValueOnce({ data: fresh });

    await saveProfile(profile, { ...values, firstName: ' Augusta ', lastName: 'King' });

    expect(get).toHaveBeenCalledWith('/users/u1');
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/users', {
      ...fresh,
      firstName: 'Augusta',
      lastName: 'King',
    });
  });

  it('saves the contact details alone when only they changed', async () => {
    await saveProfile(profile, { ...values, phoneNumber: ' 456 ', allowNotify: false });

    expect(get).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledWith('/userContactDetails/u1', {
      referenceDataUserId: 'u1',
      phoneNumber: '456',
      allowNotify: false,
      emailDetails: { email: 'ada@example.org', emailVerified: true },
    });
  });

  it('sends a new email with the stored verified flag, since the server verifies it', async () => {
    await saveProfile(profile, { ...values, email: 'new@example.org' });

    expect(put).toHaveBeenCalledWith(
      '/userContactDetails/u1',
      expect.objectContaining({
        emailDetails: { email: 'new@example.org', emailVerified: true },
      }),
    );
  });

  it('saves the user before the contact details, and stops when the user fails', async () => {
    get.mockResolvedValueOnce({ data: user });
    put.mockRejectedValueOnce(new Error('refused'));

    await expect(
      saveProfile(profile, { ...values, firstName: 'Augusta', phoneNumber: '456' }),
    ).rejects.toThrow('refused');
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/users', expect.anything());
  });

  it('creates contact details for a user who has none', async () => {
    await saveProfile(
      { user, contact: null },
      { ...values, email: '', phoneNumber: '1', allowNotify: false },
    );

    expect(put).toHaveBeenCalledWith('/userContactDetails/u1', {
      referenceDataUserId: 'u1',
      phoneNumber: '1',
      allowNotify: false,
      emailDetails: { email: null, emailVerified: false },
    });
  });

  it('never touches the sign-in account', async () => {
    get.mockResolvedValueOnce({ data: user });

    await saveProfile(profile, { ...values, firstName: 'Augusta', phoneNumber: '456' });

    expect(post).not.toHaveBeenCalled();
  });

  it('sends nothing when nothing changed', async () => {
    await saveProfile(profile, values);

    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});

describe('resendVerification', () => {
  it('asks for the verification email again', async () => {
    await resendVerification('u1');

    expect(post).toHaveBeenCalledWith('/userContactDetails/u1/verifications');
  });
});

describe('changePassword', () => {
  it('sets the new password for the username', async () => {
    await changePassword('ada', 'secret123');

    expect(post).toHaveBeenCalledWith('/users/auth/passwordReset', {
      username: 'ada',
      newPassword: 'secret123',
    });
  });
});

describe('fetchDigestConfigurations', () => {
  it('lists every configuration', async () => {
    const configuration = { id: 'd1', tag: 'requisition-actionRequired' };
    get.mockResolvedValueOnce({ data: { content: [configuration] } });

    await expect(fetchDigestConfigurations()).resolves.toEqual([configuration]);
    expect(get).toHaveBeenCalledWith('/digestConfiguration');
  });
});

describe('fetchSubscriptions', () => {
  it("lists the user's subscriptions, and none without contact details", async () => {
    const subscription = {
      digestConfiguration: { id: 'd1' },
      preferredChannel: 'EMAIL',
      useDigest: false,
    };
    get.mockResolvedValueOnce({ data: [subscription] }).mockRejectedValueOnce(notFound());

    await expect(fetchSubscriptions('u1')).resolves.toEqual([subscription]);
    await expect(fetchSubscriptions('u1')).resolves.toEqual([]);
    expect(get).toHaveBeenCalledWith('/users/u1/subscriptions');
  });
});

describe('saveSubscriptions', () => {
  it('replaces every subscription at once', async () => {
    const subscriptions = [
      { digestConfiguration: { id: 'd1' }, preferredChannel: 'EMAIL' as const, useDigest: false },
    ];

    await saveSubscriptions('u1', subscriptions);

    expect(post).toHaveBeenCalledWith('/users/u1/subscriptions', subscriptions);
  });
});
