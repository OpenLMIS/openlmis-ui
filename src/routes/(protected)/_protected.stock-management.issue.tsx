import { createFileRoute, Link } from '@tanstack/react-router';
import {
  loadStockEventPrograms,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

const copy = {
  title: 'stock-issue.title',
  nav: 'nav.stock-management.issue',
  description: 'stock-issue.page-description',
  action: 'stock-issue.make',
} as const;

export const Route = createFileRoute('/(protected)/_protected/stock-management/issue')({
  loader: ({ context: { queryClient } }) => loadStockEventPrograms(queryClient),
  pendingComponent: () => <StockEventProgramsPending copy={copy} />,
  component: ProgramsPage,
});

function ProgramsPage() {
  return (
    <StockEventProgramPicker
      {...Route.useLoaderData()}
      copy={copy}
      editorLink={(programId) => (
        <Link params={{ programId }} to="/stock-management/issue/$programId" />
      )}
    />
  );
}
