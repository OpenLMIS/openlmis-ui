import { createFileRoute, Link } from '@tanstack/react-router';
import {
  loadStockEventPrograms,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

export const Route = createFileRoute('/(protected)/_protected/stock-management/receive')({
  loader: ({ context: { queryClient } }) => loadStockEventPrograms(queryClient),
  pendingComponent: () => <StockEventProgramsPending kind="receive" />,
  component: ProgramsPage,
});

function ProgramsPage() {
  return (
    <StockEventProgramPicker
      {...Route.useLoaderData()}
      kind="receive"
      editorLink={(programId) => (
        <Link params={{ programId }} to="/stock-management/receive/$programId" />
      )}
    />
  );
}
