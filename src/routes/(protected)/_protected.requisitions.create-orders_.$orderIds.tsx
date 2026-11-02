import { createFileRoute } from '@tanstack/react-router';
import { requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/lib/rights';

export const Route = createFileRoute(
  '/(protected)/_protected/requisitions/create-orders_/$orderIds',
)({
  loader: ({ context: { queryClient } }) => requirePermissions(queryClient, RIGHTS.orderCreate),
  component: () => null,
});
