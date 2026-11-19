import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  fetchContactDetails,
  fetchDigestConfigurations,
  fetchPendingEmail,
  fetchSubscriptions,
  resendVerification,
  saveProfileContact,
  saveProfileNames,
  saveSubscriptions,
} from '@/features/profile/api/api';
import { client } from '@/integrations/axios';
import type { UserContactDetails, UserRecord } from '@/lib/user-types';

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

const user: UserRecord = {
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

const contact: UserContactDetails = {
  referenceDataUserId: 'u1',
  phoneNumber: '123',
  allowNotify: true,
  emailDetails: { email: 'ada@example.org', emailVerified: true },
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
});

describe('fetchContactDetails', () => {
  it('reads only the contact details for the user', async () => {
    get.mockResolvedValueOnce({ data: contact });

    await fetchContactDetails('u1');
    expect(get).toHaveBeenCalledExactlyOnceWith('/userContactDetails/u1');
  });

  it('treats missing contact details as none', async () => {
    get.mockRejectedValueOnce(notFound());

    await expect(fetchContactDetails('u1')).resolves.toBeNull();
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

describe('saveProfileNames', () => {
  it('applies only the edited name to the current server user', async () => {
    const fresh = { ...user, lastName: 'Byron', roleAssignments: [{ roleId: 'r2' }] };
    get.mockResolvedValueOnce({ data: fresh });

    await saveProfileNames('u1', { firstName: 'Augusta' });

    expect(get).toHaveBeenCalledExactlyOnceWith('/users/u1');
    expect(put).toHaveBeenCalledExactlyOnceWith('/users', {
      ...fresh,
      firstName: 'Augusta',
    });
  });
});

describe('saveProfileContact', () => {
  it('writes contact details without reading or writing the user or sign-in account', async () => {
    await saveProfileContact('u1', contact);

    expect(put).toHaveBeenCalledExactlyOnceWith('/userContactDetails/u1', contact);
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
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
