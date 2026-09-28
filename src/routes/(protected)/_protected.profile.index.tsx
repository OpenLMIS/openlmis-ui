import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useLoginData } from '@/features/auth/store/login-data';
import { firstNameOptions } from '@/features/home/api/queries';
import { profileOptions } from '@/features/profile/api/queries';
import { BasicInformation } from '@/features/profile/components/basic-information';
import { queryKeys } from '@/lib/key-factory';

export const Route = createFileRoute('/(protected)/_protected/profile/')({
  staticData: { crumbKey: 'profile.title' },
  component: BasicInformationPage,
});

function BasicInformationPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? <BasicInformationTab userId={userId} /> : null;
}

function BasicInformationTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileOptions(userId));

  return (
    // A different user, such as one who signed in through the legacy UI meanwhile, starts a fresh form.
    <BasicInformation
      key={userId}
      onSaved={() => {
        // Home greets the user by name, and an administrator's list shows it.
        void queryClient.invalidateQueries({ queryKey: firstNameOptions(userId).queryKey });
        void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      }}
      profile={profile}
    />
  );
}
