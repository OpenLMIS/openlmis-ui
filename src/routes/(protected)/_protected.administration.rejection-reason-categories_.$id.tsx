import { createFileRoute, redirect } from '@tanstack/react-router';
import { categoriesListSearchSchema } from '@/features/rejection-reasons/lib/search';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/rejection-reason-categories_/$id',
)({
  validateSearch: categoriesListSearchSchema,
  preload: false,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: '/administration/rejection-reason-categories',
      search: { ...search, category: params.id },
      replace: true,
    });
  },
});
