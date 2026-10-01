const HOME = '/home';

// Browsers drop tabs and newlines from a URL and read `\` as `/`, so `/\t/x` is another site.
const isUnsafe = (target: string) =>
  [...target].some((char) => char === '\\' || char.charCodeAt(0) < 0x20);

/** Where to go after signing in: a page inside the app, never another site or the sign-in page. */
export function safeRedirect(target: string | undefined): string {
  if (!target?.startsWith('/') || target.startsWith('//') || isUnsafe(target)) return HOME;
  const path = target.split(/[?#]/, 1)[0];
  return path === '/login' ? HOME : target;
}

/** The sign-in page's search for a signed-out visit, bringing the user back once they sign in. */
export function loginSearch({ pathname, href }: { pathname: string; href: string }) {
  return pathname === HOME ? {} : { redirect: href };
}

/** The signed-out pages, where nothing asks the user to sign in again. */
export const isSignInPage = (pathname: string) =>
  pathname === '/login' ||
  pathname === '/forgot-password' ||
  pathname.startsWith('/reset-password/');
