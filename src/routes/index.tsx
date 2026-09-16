import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/**
 * @name HomePage
 * @description
 * This component serves as the landing page for the application. It immediately redirects users to the dashboard route.
 */
function HomePage() {
  return <Navigate to="/dashboard" />;
}
