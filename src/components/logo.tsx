import { appConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
};

// One flat brand-blue glyph reads on both light and dark surfaces.
export function Logo({ className }: LogoProps) {
  return (
    <img
      alt={appConfig.BRAND}
      className={cn('block h-5 w-auto shrink-0', className)}
      src="/olmis.png"
    />
  );
}
