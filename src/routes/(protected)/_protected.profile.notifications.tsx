import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  digestConfigurationsOptions,
  profileOptions,
  subscriptionsOptions,
} from '@/features/profile/api/queries';
import { NotificationSettings } from '@/features/profile/components/notification-settings';

export const Route = createFileRoute('/(protected)/_protected/profile/notifications')({
  staticData: { crumbKey: 'profile.title' },
  loader: ({ context: { queryClient } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) return;
    queryClient.prefetchQuery(digestConfigurationsOptions());
    queryClient.prefetchQuery(subscriptionsOptions(userId));
  },
  component: NotificationSettingsPage,
});

function NotificationSettingsPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? <NotificationSettingsTab userId={userId} /> : null;
}

function NotificationSettingsTab({ userId }: { userId: string }) {
  const { data: profile } = useSuspenseQuery(profileOptions(userId));
  return <NotificationSettings hasContactDetails={profile.contact !== null} userId={userId} />;
}
