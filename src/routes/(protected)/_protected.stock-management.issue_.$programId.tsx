import { createFileRoute } from '@tanstack/react-router';
import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { stockEventSearchSchema } from '@/features/stock-events/lib/event-search';
import { getDefaultIssueReasonId } from '@/lib/runtime-config';
import {
  loadStockEventEditor,
  reloadOnEntry,
  StockEventEditorPage,
  StockEventPending,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute('/(protected)/_protected/stock-management/issue_/$programId')({
  validateSearch: stockEventSearchSchema,
  staticData: { rights: [EVENT_KINDS.issue.right], crumbKey: 'stock-issue.editor-crumb' },
  shouldReload: reloadOnEntry,
  loader: ({ route, context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, route, programId, 'issue'),
  pendingComponent: () => (
    <StockEventPending kind="issue" programId={Route.useParams().programId} />
  ),
  component: IssuePage,
});

function IssuePage() {
  return (
    <StockEventEditorPage
      kind="issue"
      defaultReasonId={getDefaultIssueReasonId()}
      data={Route.useLoaderData()}
      search={Route.useSearch()}
    />
  );
}
