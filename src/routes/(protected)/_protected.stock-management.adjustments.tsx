import { createFileRoute, Link } from '@tanstack/react-router';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import {
  loadStockEventPrograms,
  StockEventProgramPicker,
  StockEventProgramsPending,
} from '@/routes/(protected)/-stock-event-program-picker';

export const Route = createFileRoute('/(protected)/_protected/stock-management/adjustments')({
  staticData: { rights: [EVENT_KINDS.adjustment.right] },
  loader: ({ route, context: { queryClient } }) => loadStockEventPrograms(queryClient, route),
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
