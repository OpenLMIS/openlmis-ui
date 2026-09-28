import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  Outlet,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { UserRoundIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataTableError } from '@/components/data-table/data-table';
import { NoAccessPage } from '@/components/no-access-page';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { isForbidden } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { pendingEmailOptions, profileOptions } from '@/features/profile/api/queries';
import { ChangePasswordDialog } from '@/features/profile/components/change-password-dialog';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';
import { facilityOptions } from '@/features/reference-data/api/queries';

const profileSearchSchema = z.object({
  /** The open dialog; only Change Password so far. */
  dialog: z.enum(['password']).optional().catch(undefined),
});

export const Route = createFileRoute('/(protected)/_protected/profile')({
  validateSearch: profileSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) return;
    queryClient.prefetchQuery(pendingEmailOptions(userId));
    // The page is about this record, so it waits for it.
    const { user } = await queryClient.ensureQueryData(profileOptions(userId));
    if (user.homeFacilityId) queryClient.prefetchQuery(facilityOptions(user.homeFacilityId));
  },
  pendingComponent: ProfilePending,
  errorComponent: ProfileError,
  component: ProfileLayout,
});

function ProfileLayout() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  // Signing out clears the cache before leaving, so the page must not load a profile for no one.
  return userId ? <ProfileDialogs userId={userId} /> : null;
}

function ProfileDialogs({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigate({ from: Route.fullPath });
  const { dialog } = Route.useSearch();
  const { data: profile } = useSuspenseQuery(profileOptions(userId));
  const { logout } = useAuthActions();

  const closeDialog = () => {
    if (router.state.location.state.dialogOpenedHere) router.history.back();
    else
      void navigate({ search: (previous) => ({ ...previous, dialog: undefined }), replace: true });
  };

  // The new password is used at once, as the legacy UI does; the dialog asked about unsaved work first.
  const signOut = async () => {
    toast.success(t('profile.password.changed-title'), {
      description: t('profile.password.changed'),
    });
    await logout();
    await navigate({ to: '/login' });
  };

  return (
    <ProfileWorkspace username={profile.user.username}>
      <Outlet />
      <ChangePasswordDialog
        onChanged={signOut}
        onClose={closeDialog}
        open={dialog === 'password'}
        user={profile.user}
      />
    </ProfileWorkspace>
  );
}

/** While the profile loads: the page's frame, with placeholders for the tabs and the first card. */
function ProfilePending() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <UserRoundIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('profile.title')}</WorkspaceTitle>
          {/* Holds the line the description takes, so the header does not grow. */}
          <WorkspaceDescription>{'\u00a0'}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div aria-busy className="flex flex-col gap-4">
          <div className="h-8 w-96 max-w-full">
            <Skeleton fill />
          </div>
          <div className="h-32 w-full">
            <Skeleton fill />
          </div>
          <div className="h-80 w-full">
            <Skeleton fill />
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function ProfileError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  if (isForbidden(error)) return <NoAccessPage />;

  return (
    <Workspace>
      <WorkspaceContent>
        <DataTableError
          description={t('profile.error-description')}
          onRetry={() => {
            reset();
            void router.invalidate();
          }}
          title={t('profile.error-title')}
        />
      </WorkspaceContent>
    </Workspace>
  );
}
