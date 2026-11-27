export function frameableUrl(raw: string | null | undefined, appOrigin: string) {
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  if (url.username || url.password || url.origin === appOrigin) return undefined;
  return url;
}
