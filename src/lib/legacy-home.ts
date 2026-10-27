export function legacyHome(base: string): string {
  const path = base.replace(/\/+$/, '');
  return path.slice(0, path.lastIndexOf('/') + 1) || '/';
}
