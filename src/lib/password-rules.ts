import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';

/** Whose password it is; the server refuses one that contains any of these. */
export type PasswordOwner = {
  username: string;
  firstName?: string | null;
  lastName?: string | null;
};

/** The fixed rules the auth service checks, in the order it reports them; strength is left to the server. */
export const PASSWORD_RULES = ['length', 'characters', 'number', 'names'] as const;

export type PasswordRule = (typeof PASSWORD_RULES)[number];

/** The rules that apply; the names only when it is known whose password it is. */
export function passwordRules(owner?: PasswordOwner): readonly PasswordRule[] {
  return owner ? PASSWORD_RULES : PASSWORD_RULES.filter((rule) => rule !== 'names');
}

export function passwordChecks(
  password: string,
  owner?: PasswordOwner,
): Record<PasswordRule, boolean> {
  const lower = password.toLowerCase();
  const names = [owner?.username, owner?.firstName, owner?.lastName]
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

/** What is wrong with the password, as a translation key: missing, or the first rule it misses. */
export function passwordIssue(password: string, owner?: PasswordOwner): ParseKeys | undefined {
  if (password === '') return 'users.password.required';
  const checks = passwordChecks(password, owner);
  const unmet = passwordRules(owner).find((rule) => !checks[rule]);
  return unmet && RULE_ERRORS[unmet];
}

// The server words only the strength check by key; its other rules come back as English text.
const SERVER_ERRORS: Record<string, ParseKeys> = {
  'users.passwordReset.tooWeak': 'users.password.error.too-weak',
};

export function passwordErrorKey(error: unknown): ParseKeys | undefined {
  if (!isAxiosError(error)) return undefined;
  const key = (error.response?.data as { messageKey?: unknown } | undefined)?.messageKey;
  return typeof key === 'string' ? SERVER_ERRORS[key] : undefined;
}
