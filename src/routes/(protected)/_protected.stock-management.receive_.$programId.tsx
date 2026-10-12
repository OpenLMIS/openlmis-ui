import { createFileRoute } from '@tanstack/react-router';
import { ClipboardPenLineIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { useLoginData } from '@/features/auth/store/login-data';
import { EventEditor, type EventSearch } from '@/features/stock-events/components/event-editor';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { recordLabel } from '@/lib/facility-program-selection';
import { getDefaultReceiveReasonId } from '@/lib/runtime-config';
import {
  loadStockEventEditor,
  StockEventPending,
  stockEventSearchSchema,
  useStockEventPrint,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/receive_/$programId',
)({
  validateSearch: stockEventSearchSchema,
  staticData: { crumbKey: 'stock-receive.editor-crumb' },
  loader: ({ context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, programId, 'receive'),
  pendingComponent: () => (
    <StockEventPending kind="receive" programId={Route.useParams().programId} />
  ),
  component: ReceivePage,
});

function ReceivePage() {
  const { t } = useTranslation();
  const { userId, homeFacility, program, canViewStock, canManageLots } = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<EventSearch>({});
  const username = useLoginData((state) => state.username) ?? '';
  const print = useStockEventPrint({
    kind: 'receive',
    userId,
    facilityId: homeFacility.id,
    programId: program.id,
  });
  return (
    <>
      <EventEditor
        kind="receive"
        defaultReasonId={getDefaultReceiveReasonId()}
        key={`${homeFacility.id}/${program.id}`}
        facilityId={homeFacility.id}
        facilityTypeId={homeFacility.type.id}
        programId={program.id}
        username={username}
        canViewStock={canViewStock}
        canManageLots={canManageLots}
        search={search}
        onSearchChange={updateSearch}
        onSubmitted={print.onSubmitted}
      >
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <ClipboardPenLineIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>
              {t('stock-receive.editor-title', {
                code: homeFacility.code,
                facility: recordLabel(homeFacility),
                program: recordLabel(program),
              })}
            </WorkspaceTitle>
            <WorkspaceDescription>{t('stock-receive.editor-description')}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
      </EventEditor>
      {print.dialog}
    </>
  );
}
