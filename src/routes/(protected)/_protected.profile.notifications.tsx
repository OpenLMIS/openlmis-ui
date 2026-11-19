import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  contactDetailsOptions,
  digestConfigurationsOptions,
  subscriptionsOptions,
} from '@/features/profile/api/queries';
import { NotificationSettings } from '@/features/profile/components/notification-settings';
import { userRecordOptions } from '@/features/reference-data/api/queries';

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
  return userId ? <NotificationSettingsTab userId={userId} /> : null;
}

function NotificationSettingsTab({ userId }: { userId: string }) {
  const { data: user } = useSuspenseQuery(userRecordOptions(userId));
  const { data: contact } = useSuspenseQuery(contactDetailsOptions(userId));
  return <NotificationSettings hasContactDetails={contact !== null} userId={user.id} />;
}
