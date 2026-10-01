import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/(protected)/_protected/administration/products_/$id/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/administration/products/$id/general',
      params,
      replace: true,
    });
  },
});
