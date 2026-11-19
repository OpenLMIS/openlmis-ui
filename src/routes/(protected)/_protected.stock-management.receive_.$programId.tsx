import { createFileRoute } from '@tanstack/react-router';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
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
  staticData: { rights: [EVENT_KINDS.receive.right], crumbKey: 'stock-receive.editor-crumb' },
  shouldReload: reloadOnEntry,
  loader: ({ route, context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, route, programId, 'receive'),
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
