import type { ParseKeys } from 'i18next';
import { z } from 'zod';

export type PasswordMethod = 'email' | 'manual';

// The rule the auth service enforces, checked here too so the user hears it before sending.
const MIN_PASSWORD_LENGTH = 8;

const issue = (message: ParseKeys) => ({ code: 'custom' as const, path: ['password'], message });

export const passwordFormSchema = z
  .object({
    method: z.enum(['email', 'manual']),
    password: z.string(),
  })
  .superRefine(({ method, password }, context) => {
    if (method !== 'manual') return;
    if (password === '') context.addIssue(issue('users.password.required'));
    else if (password.length < MIN_PASSWORD_LENGTH)
      context.addIssue(issue('users.password.too-short'));
    else if (!/\d/.test(password)) context.addIssue(issue('users.password.needs-number'));
  });

export type PasswordFormValues = z.input<typeof passwordFormSchema>;

/** The address to send a reset link to; empty text counts as none, so it never hides the password field. */
export function resetEmail(email: string | null | undefined): string | null {
  return email?.trim() || null;
}

/** An emailed link when the user has an address, as the legacy UI does, otherwise a typed password. */
export function defaultPasswordForm(email: string | null): PasswordFormValues {
  return { method: email ? 'email' : 'manual', password: '' };
}
