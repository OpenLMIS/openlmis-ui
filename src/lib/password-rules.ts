import type { ParseKeys } from 'i18next';

// The auth service's rules, checked here too so the user hears them before sending.
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

/** The first rule the password breaks, as a translation key; the server also rejects weak ones. */
export function passwordIssue(
  password: string,
  userData: readonly (string | null | undefined)[] = [],
): ParseKeys | undefined {
  if (password === '') return 'password.required';
  if (/\s/.test(password)) return 'password.no-spaces';
  if (password.length < MIN_LENGTH) return 'password.too-short';
  if (password.length > MAX_LENGTH) return 'password.too-long';
  if (!/^[a-zA-Z0-9]+$/.test(password)) return 'password.letters-digits';
  if (!/\d/.test(password)) return 'password.needs-number';
  const lower = password.toLowerCase();
  if (userData.some((value) => value && lower.includes(value.toLowerCase()))) {
    return 'password.no-user-data';
  }
  return undefined;
}
