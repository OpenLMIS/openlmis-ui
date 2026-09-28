/** Lower case without accents, so "deposito" finds "Depósito". */
export const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/** First and last name as one, leaving out whichever is missing. */
export function fullName(user: { firstName?: string | null; lastName?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}
