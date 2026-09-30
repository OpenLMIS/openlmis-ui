import { LoadError } from '@/components/load-error';
import { NoAccess } from '@/components/no-access-page';
import { isForbidden } from '@/features/auth/lib/access';

type ListErrorProps = {
  error: unknown;
  reset: () => void;
  title: string;
  description: string;
};

export function ListError(props: ListErrorProps) {
  if (isForbidden(props.error)) return <NoAccess />;
  return <LoadError {...props} />;
}
