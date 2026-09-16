/* DEMO ONLY - this users page is a showcase composed of mocked widgets from `./-users/`. To remove the demo, delete the `-users/` folder, trim the richer fields on `src/features/users/lib/types.ts` + `api/api.ts`, and replace the body of `UsersPage` with the real implementation. */
import { createFileRoute } from '@tanstack/react-router';
import { usersListOptions } from '@/features/users/api/queries';
import { usersSearchSchema } from '@/features/users/lib/schemas';
import { UserStats } from '@/routes/(protected)/-users/user-stats';
import { UsersTable } from '@/routes/(protected)/-users/users-table';

export const Route = createFileRoute('/(protected)/_protected/users')({
  validateSearch: usersSearchSchema,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(usersListOptions),
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className="@container/main mx-auto flex w-full flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <UserStats />
      <UsersTable />
    </div>
  );
}
