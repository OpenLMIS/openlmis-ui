import { createFileRoute } from '@tanstack/react-router';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { stockEventSearchSchema } from '@/features/stock-events/lib/event-search';
import { getKitUnpackReasonIds } from '@/lib/runtime-config';
import {
  loadStockEventEditor,
  reloadOnEntry,
  StockEventEditorPage,
  StockEventPending,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute('/(protected)/_protected/stock-management/unpack_/$programId')(
  {
    validateSearch: stockEventSearchSchema,
    staticData: { rights: [EVENT_KINDS.unpack.right], crumbKey: 'stock-unpack.editor-crumb' },
    shouldReload: reloadOnEntry,
    loader: ({ route, context: { queryClient }, params: { programId } }) =>
      loadStockEventEditor(queryClient, route, programId, 'unpack'),
    pendingComponent: () => (
      <StockEventPending kind="unpack" programId={Route.useParams().programId} />
    ),
    component: UnpackPage,
  },
);

function UnpackPage() {
  return (
    <StockEventEditorPage
      kind="unpack"
      kitUnpackReasonIds={getKitUnpackReasonIds()}
      data={Route.useLoaderData()}
      search={Route.useSearch()}
    />
  );
}
