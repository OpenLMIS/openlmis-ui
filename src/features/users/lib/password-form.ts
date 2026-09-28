import { z } from 'zod';
import { type PasswordOwner, passwordIssue } from '@/lib/password-rules';

export type PasswordMethod = 'email' | 'manual';

export function passwordFormSchema(owner: PasswordOwner) {
  return z
    .object({
      method: z.enum(['email', 'manual']),
      password: z.string(),
    })
    .superRefine(({ method, password }, context) => {
      const message = method === 'manual' ? passwordIssue(password, owner) : undefined;
      if (message) context.addIssue({ code: 'custom', path: ['password'], message });
    });
}

export type PasswordFormValues = z.input<ReturnType<typeof passwordFormSchema>>;

/** The address to send a reset link to; empty text counts as none, so it never hides the password field. */
export function resetEmail(email: string | null | undefined): string | null {
  return email?.trim() || null;
}

/** An emailed link when the user has an address, as the legacy UI does, otherwise a typed password. */
export function defaultPasswordForm(email: string | null): PasswordFormValues {
  return { method: email ? 'email' : 'manual', password: '' };
}
