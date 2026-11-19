import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  contactDetailsOptions,
  digestConfigurationsOptions,
  subscriptionsOptions,
} from '@/features/profile/api/queries';
import {
  NotificationSettings,
  NotificationSettingsSkeleton,
} from '@/features/profile/components/notification-settings';
import { ProfileContactError } from '@/features/profile/components/profile-contact-error';

export const Route = createFileRoute('/(protected)/_protected/profile/notifications')({
  staticData: { crumbKey: 'profile.title' },
  loader: ({ context: { queryClient } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) return;
    queryClient.prefetchQuery(contactDetailsOptions(userId));
    queryClient.prefetchQuery(digestConfigurationsOptions());
    queryClient.prefetchQuery(subscriptionsOptions(userId));
  },
  component: NotificationSettingsPage,
});

function NotificationSettingsPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? (
    <QueryBoundary
      errorComponent={ProfileContactError}
      pendingFallback={<NotificationSettingsSkeleton />}
      resetKey={userId}
    >
      <NotificationSettingsTab userId={userId} />
    </QueryBoundary>
  ) : null;
}

function NotificationSettingsTab({ userId }: { userId: string }) {
  const { data: contact } = useSuspenseQuery(contactDetailsOptions(userId));
  return <NotificationSettings hasContactDetails={contact !== null} userId={userId} />;
}
