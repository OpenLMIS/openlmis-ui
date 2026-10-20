import { createFileRoute, Link } from '@tanstack/react-router';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import {
  loadStockEventPrograms,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

export const Route = createFileRoute('/(protected)/_protected/stock-management/issue')({
  loader: ({ context: { queryClient } }) =>
    loadStockEventPrograms(queryClient, EVENT_KINDS.issue.right),
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
