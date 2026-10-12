import { createFileRoute, Link } from '@tanstack/react-router';
import {
  loadStockEventPrograms,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

export const Route = createFileRoute('/(protected)/_protected/stock-management/issue')({
  loader: ({ context: { queryClient } }) => loadStockEventPrograms(queryClient),
  pendingComponent: () => <StockEventProgramsPending kind="issue" />,
  component: ProgramsPage,
});

function ProgramsPage() {
  return (
    <StockEventProgramPicker
      {...Route.useLoaderData()}
      kind="issue"
      editorLink={(programId) => (
        <Link params={{ programId }} to="/stock-management/issue/$programId" />
      )}
    />
  );
}
