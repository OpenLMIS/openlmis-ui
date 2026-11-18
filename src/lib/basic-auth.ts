/** An HTTP Basic header encoded as UTF-8, which `btoa` alone refuses beyond Latin-1. */
export function basicAuthorization(user: string, password: string) {
  const bytes = new TextEncoder().encode(`${user}:${password}`);
  return `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))}`;
}
