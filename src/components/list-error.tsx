import type { ComponentProps } from 'react';
import { LoadError } from '@/components/load-error';
import { NoAccess } from '@/components/no-access-page';
import { isForbidden } from '@/features/auth/lib/access';

export function ListError(props: ComponentProps<typeof LoadError>) {
  if (isForbidden(props.error)) return <NoAccess />;
  return <LoadError {...props} />;
}
