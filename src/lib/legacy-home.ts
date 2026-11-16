export function legacyHome(base: string): string {
  const configured = import.meta.env.VITE_LEGACY_UI_URL?.trim();
  if (configured) return `${configured.replace(/\/+$/, '')}/`;
  const path = base.replace(/\/+$/, '');
  return path.slice(0, path.lastIndexOf('/') + 1) || '/';
}
