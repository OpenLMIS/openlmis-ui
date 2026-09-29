import { useState } from 'react';
import { DEFAULT_LOGO_URL, useAppName, useLogoUrl } from '@/lib/app-configuration';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  src?: string;
  alt?: string;
};

export function Logo({ className, src, alt }: LogoProps) {
  const configuredName = useAppName();
  const configuredUrl = useLogoUrl();
  const appName = alt ?? configuredName;
  const logoUrl = src ?? configuredUrl;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <img
      alt={appName}
      className={cn('block h-5 w-auto shrink-0', className)}
      onError={() => setFailedUrl(logoUrl)}
      src={failedUrl === logoUrl ? DEFAULT_LOGO_URL : logoUrl}
    />
  );
}
