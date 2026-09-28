import { z } from 'zod';
import { passwordIssue } from '@/lib/password-rules';

/** The new password, typed twice; it may not contain the user's username or names. */
export const changePasswordSchema = (userData: readonly string[]) =>
  z
    .object({ password: z.string(), confirm: z.string() })
    .superRefine(({ password, confirm }, context) => {
      const issue = passwordIssue(password, userData);
      if (issue) context.addIssue({ code: 'custom', path: ['password'], message: issue });
      if (confirm === '') {
        context.addIssue({
          code: 'custom',
          path: ['confirm'],
          message: 'profile.password.confirm-required',
        });
      } else if (confirm !== password) {
        context.addIssue({
          code: 'custom',
          path: ['confirm'],
          message: 'profile.password.mismatch',
        });
      }
    });
