import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/(protected)/_protected/stock-management/device-events')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/offline-events', search, replace: true });
  },
});
