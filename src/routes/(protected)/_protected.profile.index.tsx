import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { useLoginData } from '@/features/auth/store/login-data';
import { contactDetailsOptions } from '@/features/profile/api/queries';
import {
  BasicInformation,
  BasicInformationSkeleton,
} from '@/features/profile/components/basic-information';
import { ProfileContactError } from '@/features/profile/components/profile-contact-error';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { invalidateUsersAdminQueries } from '@/lib/user-queries';

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
  return userId ? (
    <QueryBoundary
      errorComponent={ProfileContactError}
      pendingFallback={<BasicInformationSkeleton />}
      resetKey={userId}
    >
      <BasicInformationTab userId={userId} />
    </QueryBoundary>
  ) : null;
}

function BasicInformationTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: user } = useSuspenseQuery(userRecordOptions(userId));
  const { data: contact } = useSuspenseQuery(contactDetailsOptions(userId));

  return (
    <BasicInformation
      key={userId}
      onSaved={() => void invalidateUsersAdminQueries(queryClient, userId)}
      profile={{ user, contact }}
    />
  );
}
