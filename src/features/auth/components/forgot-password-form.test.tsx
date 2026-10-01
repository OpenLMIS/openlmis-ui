import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPasswordReset } from '@/features/auth/api/api';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { httpError } from '@/tests/http-error';
import { renderWithLogin } from '@/tests/render-with-login';

vi.mock('@/features/auth/api/api', () => ({ requestPasswordReset: vi.fn() }));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'cimode', keySeparator: false, nsSeparator: false });
});

beforeEach(() => {
  vi.mocked(requestPasswordReset).mockReset();
});

async function submit(email: string) {
  renderWithLogin(<ForgotPasswordForm />);
  const events = userEvent.setup();
  await events.type(await screen.findByRole('textbox', { name: /forgot-password.email/ }), email);
  await events.click(screen.getByRole('button', { name: 'forgot-password.submit' }));
}

describe('ForgotPasswordForm', () => {
  it('asks for the address before sending anything', async () => {
    renderWithLogin(<ForgotPasswordForm />);
    await userEvent.click(await screen.findByRole('button', { name: 'forgot-password.submit' }));

    expect(await screen.findByText('forgot-password.email-required')).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('sends the address without its spaces, then says what happens next', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue();
    await submit(' ada@example.org ');

    expect(await screen.findByText('forgot-password.sent-title')).toBeInTheDocument();
    expect(requestPasswordReset).toHaveBeenCalledWith('ada@example.org');
    expect(screen.getByRole('button', { name: 'forgot-password.back-to-sign-in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('says why it failed and keeps the address to try again', async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(httpError(429));
    await submit('ada@example.org');

    expect(await screen.findByText('forgot-password.too-many-attempts')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /forgot-password.email/ })).toHaveValue(
      'ada@example.org',
    );
  });
});
