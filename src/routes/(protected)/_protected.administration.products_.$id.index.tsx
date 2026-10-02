import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/(protected)/_protected/administration/products_/$id/')({
  beforeLoad: ({ params, location }) => {
    throw redirect({
      to: '/administration/products/$id/general',
      params,
      state: location.state,
      replace: true,
    });
  },
});
