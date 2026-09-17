import type { ParseKeys } from 'i18next';
import * as z from 'zod';

/** Token response returned by the OpenLMIS auth service. */
export type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  referenceDataUserId: string;
  username: string;
};

export type LoginInput = {
  username: string;
  password: string;
};

// Messages are translation keys so they follow a language switch, resolved at render.
const errorKey = (key: ParseKeys) => key;

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, errorKey('login.username-required'))
    .max(255, errorKey('login.username-max-length')),
  password: z.string().min(1, errorKey('login.password-required')),
});
