import { appConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
};

// Renders both variants so the theme swap happens purely via CSS - avoids the
// hydration flicker you'd get from reading `resolvedTheme` at mount time.
export function Logo({ className }: LogoProps) {
  return (
    <>
      <img
        alt={appConfig.BRAND}
        className={cn('block h-6 w-auto dark:hidden', className)}
        src="/logo.svg"
      />
      <img
        alt={appConfig.BRAND}
        className={cn('hidden h-6 w-auto dark:block', className)}
        src="/dark_logo.svg"
      />
    </>
  );
}
