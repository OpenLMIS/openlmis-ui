import { createFileRoute } from '@tanstack/react-router';
import {
  loadStockEventEditor,
  StockEventEditorPage,
  StockEventPending,
  stockEventSearchSchema,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/adjustments_/$programId',
)({
  validateSearch: stockEventSearchSchema,
  staticData: { crumbKey: 'stock-adjustment.editor-crumb' },
  loader: ({ context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, programId, 'adjustment'),
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
