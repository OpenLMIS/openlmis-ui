import { createFileRoute } from '@tanstack/react-router';
import { getDefaultIssueReasonId } from '@/lib/runtime-config';
import {
  loadStockEventEditor,
  StockEventEditorPage,
  StockEventPending,
  stockEventSearchSchema,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute('/(protected)/_protected/stock-management/issue_/$programId')({
  validateSearch: stockEventSearchSchema,
  staticData: { crumbKey: 'stock-issue.editor-crumb' },
  loader: ({ context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, programId, 'issue'),
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
