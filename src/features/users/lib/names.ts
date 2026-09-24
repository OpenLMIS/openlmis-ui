/** First and last name as the lists show them; empty when neither is set. */
export function fullName(user: { firstName?: string | null; lastName?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}
