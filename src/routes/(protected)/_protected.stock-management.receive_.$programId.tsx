import { createFileRoute } from '@tanstack/react-router';
import { stockEventSearchSchema } from '@/features/stock-events/lib/event-search';
import { getDefaultReceiveReasonId } from '@/lib/runtime-config';
import {
  loadStockEventEditor,
  reloadOnEntry,
  StockEventEditorPage,
  StockEventPending,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/receive_/$programId',
)({
  validateSearch: stockEventSearchSchema,
  staticData: { crumbKey: 'stock-receive.editor-crumb' },
  shouldReload: reloadOnEntry,
  loader: ({ context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, programId, 'receive'),
  pendingComponent: () => (
    <StockEventPending kind="receive" programId={Route.useParams().programId} />
  ),
  component: ReceivePage,
});

function ReceivePage() {
  return (
    <StockEventEditorPage
      kind="receive"
      defaultReasonId={getDefaultReceiveReasonId()}
      data={Route.useLoaderData()}
      search={Route.useSearch()}
    />
  );
}
