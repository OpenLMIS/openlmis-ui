import { createFileRoute } from '@tanstack/react-router';
import { stockEventSearchSchema } from '@/features/stock-events/lib/event-search';
import { getKitUnpackReasonIds } from '@/lib/runtime-config';
import {
  loadStockEventEditor,
  StockEventEditorPage,
  StockEventPending,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute('/(protected)/_protected/stock-management/unpack_/$programId')(
  {
    validateSearch: stockEventSearchSchema,
    staticData: { crumbKey: 'stock-unpack.editor-crumb' },
    loader: ({ context: { queryClient }, params: { programId } }) =>
      loadStockEventEditor(queryClient, programId, 'unpack'),
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
