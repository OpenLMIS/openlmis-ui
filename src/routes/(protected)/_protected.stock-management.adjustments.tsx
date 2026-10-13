import { createFileRoute, Link } from '@tanstack/react-router';
import {
  loadStockEventPrograms,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

export const Route = createFileRoute('/(protected)/_protected/stock-management/adjustments')({
  loader: ({ context: { queryClient } }) => loadStockEventPrograms(queryClient),
  pendingComponent: () => <StockEventProgramsPending kind="adjustment" />,
  component: ProgramsPage,
});

function ProgramsPage() {
  return (
    <StockEventProgramPicker
      {...Route.useLoaderData()}
      kind="adjustment"
      editorLink={(programId) => (
        <Link params={{ programId }} to="/stock-management/adjustments/$programId" />
      )}
    />
  );
}
