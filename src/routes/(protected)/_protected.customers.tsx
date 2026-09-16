/* DEMO ONLY - this customers page is a showcase composed of mocked widgets from `./-customers/`. To remove the demo, delete the `-customers/` folder, this route file, the `src/features/customers/` folder, the `customers` entry in `src/lib/key-factory.ts`, and the `customers.title` nav entry in `src/lib/config.ts`. */
import { createFileRoute } from '@tanstack/react-router';
import { customersListOptions } from '@/features/customers/api/queries';
import { customersSearchSchema } from '@/features/customers/lib/schemas';
import { CustomerStats } from '@/routes/(protected)/-customers/customer-stats';
import { CustomersTable } from '@/routes/(protected)/-customers/customers-table';

export const Route = createFileRoute('/(protected)/_protected/customers')({
  validateSearch: customersSearchSchema,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(customersListOptions),
  component: CustomersPage,
});

function CustomersPage() {
  return (
    <div className="@container/main mx-auto flex w-full flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <CustomerStats />
      <CustomersTable />
    </div>
  );
}
