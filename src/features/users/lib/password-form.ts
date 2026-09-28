import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { User } from '@/features/users/lib/types';

export type PasswordMethod = 'email' | 'manual';

export type PasswordOwner = Pick<User, 'username' | 'firstName' | 'lastName'>;

/** The fixed rules the auth service checks, in the order it reports them; strength is left to the server. */
export const PASSWORD_RULES = ['length', 'characters', 'number', 'names'] as const;

export type PasswordRule = (typeof PASSWORD_RULES)[number];

export function passwordChecks(
  password: string,
  owner: PasswordOwner,
): Record<PasswordRule, boolean> {
  const lower = password.toLowerCase();
  const names = [owner.username, owner.firstName, owner.lastName]
    .map((name) => name?.trim().toLowerCase())
    .filter(Boolean);
  return {
    length: password.length >= 8 && password.length <= 72,
    characters: /^[a-zA-Z0-9]+$/.test(password),
    number: /\d/.test(password),
    names: password !== '' && names.every((name) => !lower.includes(name)),
  };
}

const RULE_ERRORS: Record<PasswordRule, ParseKeys> = {
  length: 'users.password.error.length',
  characters: 'users.password.error.characters',
  number: 'users.password.error.number',
  names: 'users.password.error.names',
};

const issue = (message: ParseKeys) => ({ code: 'custom' as const, path: ['password'], message });

export function passwordFormSchema(owner: PasswordOwner) {
  return z
    .object({
      method: z.enum(['email', 'manual']),
      password: z.string(),
    })
    .superRefine(({ method, password }, context) => {
      if (method !== 'manual') return;
      if (password === '') {
        context.addIssue(issue('users.password.required'));
        return;
      }
      const checks = passwordChecks(password, owner);
      const unmet = PASSWORD_RULES.find((rule) => !checks[rule]);
      if (unmet) context.addIssue(issue(RULE_ERRORS[unmet]));
    });
}

export type PasswordFormValues = z.input<ReturnType<typeof passwordFormSchema>>;

// The server words only the strength check by key; its other rules come back as English text.
const SERVER_ERRORS: Record<string, ParseKeys> = {
  'users.passwordReset.tooWeak': 'users.password.error.too-weak',
};

export function passwordErrorKey(error: unknown): ParseKeys | undefined {
  if (!isAxiosError(error)) return undefined;
  const key = (error.response?.data as { messageKey?: unknown } | undefined)?.messageKey;
  return typeof key === 'string' ? SERVER_ERRORS[key] : undefined;
}

/** The address to send a reset link to; empty text counts as none, so it never hides the password field. */
export function resetEmail(email: string | null | undefined): string | null {
  return email?.trim() || null;
}

/** An emailed link when the user has an address, as the legacy UI does, otherwise a typed password. */
export function defaultPasswordForm(email: string | null): PasswordFormValues {
  return { method: email ? 'email' : 'manual', password: '' };
}
