import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPasswordReset, resetPassword } from '@/features/auth/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { post: vi.fn() } }));

const post = vi.mocked(client.post);

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: '' });
});

describe('requestPasswordReset', () => {
  it('sends the address as a query parameter, with no token', async () => {
    await requestPasswordReset('ada+lab@example.org');

    expect(post).toHaveBeenCalledWith('/users/auth/forgotPassword', undefined, {
      params: { email: 'ada+lab@example.org' },
      anonymous: true,
    });
  });
});

describe('resetPassword', () => {
  it('sends the token and the new password, with no token of the session', async () => {
    await resetPassword('7a3c9f0e-1b2d-4c5e-8f9a-0b1c2d3e4f5a', 'kznqG0C2vx');

    expect(post).toHaveBeenCalledWith(
      '/users/auth/changePassword',
      { token: '7a3c9f0e-1b2d-4c5e-8f9a-0b1c2d3e4f5a', newPassword: 'kznqG0C2vx' },
      { anonymous: true },
    );
  });
});
