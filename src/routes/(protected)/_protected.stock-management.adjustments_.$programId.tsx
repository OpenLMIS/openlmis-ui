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
import {
  loadStockEventEditor,
  StockEventPending,
  stockEventSearchSchema,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/adjustments_/$programId',
)({
  validateSearch: stockEventSearchSchema,
  staticData: { crumbKey: 'stock-adjustment.editor-crumb' },
  loader: ({ context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, programId, { destinations: false }),
  pendingComponent: StockEventPending,
  component: AdjustmentPage,
});

function AdjustmentPage() {
  const { t } = useTranslation();
  const { homeFacility, program, canViewStock } = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<EventSearch>({});
  const navigate = Route.useNavigate();
  const username = useLoginData((state) => state.username) ?? '';
  return (
    <EventEditor
      kind="adjustment"
      key={`${homeFacility.id}/${program.id}`}
      facilityId={homeFacility.id}
      facilityTypeId={homeFacility.type.id}
      programId={program.id}
      username={username}
      canViewStock={canViewStock}
      search={search}
      onSearchChange={updateSearch}
      onSubmitted={() =>
        navigate({
          to: '/stock-management/stock-on-hand',
          search: { mode: 'my', facilityId: homeFacility.id, programId: program.id },
        })
      }
    >
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ClipboardPenLineIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>
            {t('stock-adjustment.editor-title', {
              code: homeFacility.code,
              facility: recordLabel(homeFacility),
              program: recordLabel(program),
            })}
          </WorkspaceTitle>
          <WorkspaceDescription>{t('stock-adjustment.editor-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
    </EventEditor>
  );
}
