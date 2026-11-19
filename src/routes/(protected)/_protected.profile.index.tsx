import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useLoginData } from '@/features/auth/store/login-data';
import { contactDetailsOptions } from '@/features/profile/api/queries';
import { BasicInformation } from '@/features/profile/components/basic-information';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { queryKeys } from '@/lib/key-factory';

export const Route = createFileRoute('/(protected)/_protected/profile/')({
  staticData: { crumbKey: 'profile.title' },
  loader: ({ context: { queryClient } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    if (userId) queryClient.prefetchQuery(contactDetailsOptions(userId));
  },
  component: BasicInformationPage,
});

function BasicInformationPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? <BasicInformationTab userId={userId} /> : null;
}

function BasicInformationTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: user } = useSuspenseQuery(userRecordOptions(userId));
  const { data: contact } = useSuspenseQuery(contactDetailsOptions(userId));

  return (
    <BasicInformation
      key={userId}
      onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.users.list().slice(0, 2) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
      }}
      profile={{ user, contact }}
    />
  );
}
