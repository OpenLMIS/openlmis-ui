import { createFileRoute, redirect } from '@tanstack/react-router';
import { rejectionReasonsListSearchSchema } from '@/features/rejection-reasons/lib/search';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/rejection-reasons_/$id',
)({
  validateSearch: rejectionReasonsListSearchSchema,
  preload: false,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: '/administration/rejection-reasons',
      search: { ...search, reason: params.id },
      replace: true,
    });
  },
});
