import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  Outlet,
  useLocation,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataTableError } from '@/components/data-table/data-table';
import { NoAccessPage } from '@/components/no-access-page';
import { Workspace, WorkspaceContent } from '@/components/workspace';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { isForbidden } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { pendingEmailOptions, profileOptions } from '@/features/profile/api/queries';
import { BasicInformationSkeleton } from '@/features/profile/components/basic-information';
import { ChangePasswordDialog } from '@/features/profile/components/change-password-dialog';
import { NotificationSettingsSkeleton } from '@/features/profile/components/notification-settings';
import { ProfileWorkspace } from '@/features/profile/components/profile-workspace';
import { facilityOptions } from '@/features/reference-data/api/queries';
import { RoleTabsSkeleton } from '@/features/users/components/role-tabs';
import { ROLE_TABS } from '@/features/users/lib/role-assignments';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const profileSearchSchema = z.object({
  /** The open dialog; only Change Password so far. */
  dialog: z.enum(['password']).optional().catch(undefined),
});

type ProfileSearch = z.infer<typeof profileSearchSchema>;

const CLOSED_DIALOGS = { dialog: undefined } satisfies Partial<ProfileSearch>;

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
  const navigate = useNavigate();
  const { dialog } = Route.useSearch();
  const { data: profile } = useSuspenseQuery(profileOptions(userId));
  const { logout } = useAuthActions();

  const { closeDialog } = useSearchNavigation<ProfileSearch>(CLOSED_DIALOGS);

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

/** While the profile loads: the page with its real tabs, and the open tab's own placeholders. */
function ProfilePending() {
  const { pathname, search } = useLocation();
  const path = pathname.replace(/\/$/, '');
  const roleTab = ROLE_TABS.find((item) => item.id === search.tab) ?? ROLE_TABS[0];

  return (
    <ProfileWorkspace>
      {path === '/profile/roles' ? (
        <RoleTabsSkeleton compact={false} search={{}} tab={roleTab} />
      ) : path === '/profile/notifications' ? (
        <NotificationSettingsSkeleton />
      ) : (
        <BasicInformationSkeleton />
      )}
    </ProfileWorkspace>
  );
}

function ProfileError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  if (isForbidden(error)) return <NoAccessPage />;

  return (
    <Workspace width="narrow">
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
