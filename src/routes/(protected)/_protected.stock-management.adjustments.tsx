import { createFileRoute, Link } from '@tanstack/react-router';
import {
  loadStockEventPrograms,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

const copy = {
  title: 'stock-adjustment.title',
  nav: 'nav.stock-management.adjustments',
  description: 'stock-adjustment.page-description',
  action: 'stock-adjustment.make',
} as const;

export const Route = createFileRoute('/(protected)/_protected/stock-management/adjustments')({
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
        <Link params={{ programId }} to="/stock-management/adjustments/$programId" />
      )}
    />
  );
}
