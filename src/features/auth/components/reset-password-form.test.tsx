import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPassword } from '@/features/auth/api/api';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/auth/api/api', () => ({ resetPassword: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const token = '7a3c9f0e-1b2d-4c5e-8f9a-0b1c2d3e4f5a';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'cimode', keySeparator: false, nsSeparator: false });
});

beforeEach(() => {
  vi.mocked(resetPassword).mockReset();
});

const passwordInput = () => document.querySelector('#password') as HTMLInputElement;
const confirmInput = () => document.querySelector('#confirm') as HTMLInputElement;

async function submit(password: string) {
  const events = userEvent.setup();
  await events.type(passwordInput(), password);
  await events.type(confirmInput(), password);
  await events.click(screen.getByRole('button', { name: 'reset-password.submit' }));
}

describe('ResetPasswordForm', () => {
  it('shows and hides both passwords with either eye', async () => {
    renderPage(<ResetPasswordForm token={token} />);
    const [first] = await screen.findAllByRole('button', { name: 'users.password.show' });

    await userEvent.click(first);

    expect(passwordInput()).toHaveAttribute('type', 'text');
    expect(confirmInput()).toHaveAttribute('type', 'text');
    const [, second] = screen.getAllByRole('button', { name: 'users.password.hide' });
    await userEvent.click(second);
    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(confirmInput()).toHaveAttribute('type', 'password');
  });

  it('changes the password, then goes to sign in', async () => {
    vi.mocked(resetPassword).mockResolvedValue();
    const router = renderPage(<ResetPasswordForm token={token} />);
    await screen.findByRole('button', { name: 'reset-password.submit' });

    await submit('kznqG0C2vx');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(resetPassword).toHaveBeenCalledWith(token, 'kznqG0C2vx');
    expect(toast.success).toHaveBeenCalledWith('profile.password.changed-title', {
      description: 'profile.password.changed',
    });
  });

  it('holds a password that breaks the rules', async () => {
    renderPage(<ResetPasswordForm token={token} />);
    await screen.findByRole('button', { name: 'reset-password.submit' });

    await submit('abcdefgh');

    expect(await screen.findByText('users.password.error.number')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('replaces the form with a way to a new link once the link has expired', async () => {
    vi.mocked(resetPassword).mockRejectedValue(
      httpError(400, { messageKey: 'auth.error.token.expired' }),
    );
    renderPage(<ResetPasswordForm token={token} />);
    await screen.findByRole('button', { name: 'reset-password.submit' });

    await submit('kznqG0C2vx');

    expect(
      await screen.findByRole('heading', { name: 'reset-password.expired-title' }),
    ).toHaveFocus();
    expect(screen.getByRole('button', { name: 'reset-password.request-new-link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(passwordInput()).toBeNull();
  });

  it('says a malformed link does not work before anything is typed', async () => {
    renderPage(<ResetPasswordForm token="not-a-token" />);

    expect(await screen.findByText('reset-password.invalid-title')).toBeInTheDocument();
    expect(passwordInput()).toBeNull();
  });
});
