import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import * as z from 'zod';
import { isOfflineError } from '@/lib/http';

// Messages are translation keys so they follow a language switch, resolved at render.
const errorKey = (key: ParseKeys) => key;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, errorKey('forgot-password.email-required'))
    .pipe(z.email(errorKey('forgot-password.email-invalid'))),
});

export function passwordResetErrorKey(error: unknown): ParseKeys {
  if (isOfflineError(error)) return 'session.cannot-connect';
  if (isAxiosError(error) && error.response?.status === 429) {
    return 'forgot-password.too-many-attempts';
  }
  return 'forgot-password.error';
}

export const isResetToken = (token: string) => z.guid().safeParse(token).success;

export type LinkProblem = 'invalid' | 'expired';

const LINK_PROBLEMS: Record<string, LinkProblem> = {
  'auth.error.token.invalid': 'invalid',
  'auth.error.token.expired': 'expired',
};

/** Why the server refused the link itself, as opposed to a failure the form can retry. */
export function linkProblem(error: unknown): LinkProblem | undefined {
  const key = isAxiosError<{ messageKey?: string }>(error) && error.response?.data?.messageKey;
  return key ? LINK_PROBLEMS[key] : undefined;
}
