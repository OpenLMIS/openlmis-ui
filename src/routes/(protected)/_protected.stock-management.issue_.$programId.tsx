import { createFileRoute } from '@tanstack/react-router';
import { ClipboardPenLineIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchStockEventReport } from '@/features/stock-events/api/api';
import { EventEditor, type EventSearch } from '@/features/stock-events/components/event-editor';
import { PrintEventDialog } from '@/features/stock-events/components/print-event-dialog';
import { usePrintReport } from '@/hooks/use-print-report';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { recordLabel } from '@/lib/facility-program-selection';
import { openReport } from '@/lib/open-report';
import { getDefaultIssueReasonId } from '@/lib/runtime-config';
import {
  loadStockEventEditor,
  StockEventPending,
  stockEventSearchSchema,
} from '@/routes/(protected)/-stock-event-editor';

export const Route = createFileRoute('/(protected)/_protected/stock-management/issue_/$programId')({
  validateSearch: stockEventSearchSchema,
  staticData: { crumbKey: 'stock-issue.editor-crumb' },
  loader: ({ context: { queryClient }, params: { programId } }) =>
    loadStockEventEditor(queryClient, programId, { destinations: true }),
  pendingComponent: () => <StockEventPending width="wide" />,
  component: IssuePage,
});

function IssuePage() {
  const { t } = useTranslation();
  const { userId, homeFacility, program, canViewStock } = Route.useLoaderData();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<EventSearch>({});
  const navigate = Route.useNavigate();
  const username = useLoginData((state) => state.username) ?? '';
  const [eventId, setEventId] = useState<string | null>(null);
  const landing = () =>
    navigate({
      to: '/stock-management/stock-on-hand',
      search: { mode: 'my', facilityId: homeFacility.id, programId: program.id },
    });
  const print = usePrintReport({
    userId,
    right: RIGHTS.stockCardsView,
    facilityId: homeFacility.id,
    programId: program.id,
    request: (lang) => fetchStockEventReport(eventId ?? '', { showInDoses: true, lang }),
    onReport: () => openReport(`stock_event_${eventId}.pdf`, t('stock-issue.print-loading')),
    successTitle: t('stock-issue.printed-title'),
    successDescription: t('stock-issue.printed'),
    errorTitle: t('stock-issue.print-error-title'),
    errorDescription: t('stock-issue.print-error'),
    refusedDescription: t('stock-issue.print-refused'),
  });
  return (
    <>
      <EventEditor
        kind="issue"
        defaultReasonId={getDefaultIssueReasonId()}
        key={`${homeFacility.id}/${program.id}`}
        facilityId={homeFacility.id}
        facilityTypeId={homeFacility.type.id}
        programId={program.id}
        username={username}
        canViewStock={canViewStock}
        search={search}
        onSearchChange={updateSearch}
        onSubmitted={setEventId}
      >
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <ClipboardPenLineIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>
              {t('stock-issue.editor-title', {
                code: homeFacility.code,
                facility: recordLabel(homeFacility),
                program: recordLabel(program),
              })}
            </WorkspaceTitle>
            <WorkspaceDescription>{t('stock-issue.editor-description')}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
      </EventEditor>
      <PrintEventDialog
        open={eventId !== null}
        onSkip={() => {
          void landing();
        }}
        onPrint={() => {
          print.print();
          void landing();
        }}
      />
    </>
  );
}
