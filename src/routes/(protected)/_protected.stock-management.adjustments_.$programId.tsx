import { createFileRoute } from '@tanstack/react-router';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { stockEventSearchSchema } from '@/features/stock-events/lib/event-search';
import {
  loadStockEventEditor,
  reloadOnEntry,
  StockEventEditorPage,
  StockEventPending,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/adjustments_/$programId',
)({
  validateSearch: stockEventSearchSchema,
  staticData: { rights: [EVENT_KINDS.adjustment.right], crumbKey: 'stock-adjustment.editor-crumb' },
  shouldReload: reloadOnEntry,
  loader: ({ route, context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, route, programId, 'adjustment'),
  pendingComponent: () => (
    <StockEventPending kind="adjustment" programId={Route.useParams().programId} />
  ),
  component: AdjustmentPage,
});

function AdjustmentPage() {
  return (
    <StockEventEditorPage
      kind="adjustment"
      data={Route.useLoaderData()}
      search={Route.useSearch()}
    />
  );
}
