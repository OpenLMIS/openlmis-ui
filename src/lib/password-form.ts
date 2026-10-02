import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { type PasswordOwner, passwordIssue } from '@/lib/password-rules';

// Messages are translation keys so they follow a language switch, resolved at render.
const errorKey = (key: ParseKeys) => key;

/** The new password, typed twice; with an owner, it may not contain their username or names. */
export const newPasswordSchema = (owner?: PasswordOwner) =>
  z
    .object({ password: z.string(), confirm: z.string() })
    .superRefine(({ password, confirm }, context) => {
      const issue = passwordIssue(password, owner);
      if (issue) context.addIssue({ code: 'custom', path: ['password'], message: issue });
      if (confirm === '') {
        context.addIssue({
          code: 'custom',
          path: ['confirm'],
          message: errorKey('profile.password.confirm-required'),
        });
      } else if (confirm !== password) {
        context.addIssue({
          code: 'custom',
          path: ['confirm'],
          message: errorKey('profile.password.mismatch'),
        });
      }
    });
