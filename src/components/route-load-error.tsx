import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { DataTableError } from '@/components/data-table/data-table';
import { NoAccessPage } from '@/components/no-access-page';
import { OfflineNotice, useOfflineFailure } from '@/components/offline-notice';
import { Workspace, WorkspaceContent } from '@/components/workspace';
import { isForbidden } from '@/features/auth/lib/access';

type RouteLoadErrorProps = ErrorComponentProps & {
  title: string;
  description: string;
  width?: 'default' | 'narrow';
};

export function RouteLoadError({ error, reset, title, description, width }: RouteLoadErrorProps) {
  const router = useRouter();
  const retry = () => {
    void router.invalidate();
    reset();
  };
  const offline = useOfflineFailure(error, retry);
  if (isForbidden(error)) return <NoAccessPage />;
  if (offline) return <OfflineNotice onRetry={retry} />;

  return (
    <Workspace width={width}>
      <WorkspaceContent>
        <DataTableError description={description} onRetry={retry} title={title} />
      </WorkspaceContent>
    </Workspace>
  );
}
