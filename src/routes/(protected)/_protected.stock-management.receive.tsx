import { createFileRoute, Link } from '@tanstack/react-router';
import {
  loadStockEventPrograms,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

const copy = {
  title: 'stock-receive.title',
  nav: 'nav.stock-management.receive',
  description: 'stock-receive.page-description',
  action: 'stock-receive.make',
} as const;

export const Route = createFileRoute('/(protected)/_protected/stock-management/receive')({
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
        <Link params={{ programId }} to="/stock-management/receive/$programId" />
      )}
    />
  );
}
