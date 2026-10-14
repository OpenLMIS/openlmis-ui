import { type QueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ClipboardPenLineIcon } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  facilityOptions,
  facilityOrderableFulfillsOptions,
  reasonsOptions,
  userProgramsOptions,
  userRecordOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import { fetchStockEventReport } from '@/features/stock-events/api/api';
import {
  eventApprovedProductsOptions,
  eventStockCardsOptions,
} from '@/features/stock-events/api/queries';
import { EventEditor, type EventSearch } from '@/features/stock-events/components/event-editor';
import {
  EventLineTableSkeleton,
  eventHideableColumns,
} from '@/features/stock-events/components/event-line-table';
import { PrintEventDialog } from '@/features/stock-events/components/print-event-dialog';
import { ProductLotPickerSkeleton } from '@/features/stock-events/components/product-lot-picker';
import {
  type ConfiguredEventKind,
  counterpartyOptions,
  EVENT_KINDS,
  type EventPrintCopy,
} from '@/features/stock-events/lib/event-kinds';
import { useCardView } from '@/hooks/use-card-view';
import { usePrintReport } from '@/hooks/use-print-report';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { type NamedRecord, recordLabel } from '@/lib/facility-program-selection';
import { openReport } from '@/lib/open-report';
import { hasProgramGrant } from '@/lib/permissions';
import { tableSearchSchema, textFilterSchema } from '@/lib/table-search';

export const stockEventSearchSchema = tableSearchSchema(['id'])
  .pick({ page: true, size: true })
  .extend({
    keyword: textFilterSchema,
  })
  .transform((search) => ({
    ...search,
    page: search.page === 1 ? undefined : search.page,
    size: search.size === 10 ? undefined : search.size,
  }));

export async function loadStockEventEditor(
  queryClient: QueryClient,
  programId: string,
  kind: ConfiguredEventKind,
) {
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) {
    throw new ForbiddenError(RIGHTS.stockAdjust);
  }
  const [permissions, user] = await Promise.all([
    requirePermissions(queryClient, RIGHTS.stockAdjust),
    queryClient.ensureQueryData(userRecordOptions(userId)),
  ]);
  const homeId = user.homeFacilityId;
  if (!homeId || !hasProgramGrant(permissions, RIGHTS.stockAdjust, homeId, programId)) {
    throw new ForbiddenError(RIGHTS.stockAdjust);
  }
  const homeFacility = await queryClient.ensureQueryData(facilityOptions(homeId));
  const program = homeFacility.supportedPrograms?.find((program) => program.id === programId);
  if (!program) {
    throw new ForbiddenError(RIGHTS.stockAdjust);
  }
  queryClient.prefetchQuery(userProgramsOptions(userId));
  const canViewStock = hasProgramGrant(permissions, RIGHTS.stockCardsView, homeId, programId);
  if (canViewStock) {
    const { counterparty, products } = EVENT_KINDS[kind];
    const filter = { facilityId: homeId, programId };
    if (counterparty !== 'none')
      queryClient.prefetchQuery(counterpartyOptions(counterparty, filter));
    if (products.from === 'stock-cards') queryClient.prefetchQuery(eventStockCardsOptions(filter));
    if (products.from === 'approved-products') {
      queryClient.prefetchQuery(eventApprovedProductsOptions(filter, '', 0));
      queryClient.prefetchQuery(facilityOrderableFulfillsOptions(filter));
    }
    if (EVENT_KINDS[kind].contents.type === 'kit') queryClient.prefetchQuery(reasonsOptions());
    if (EVENT_KINDS[kind].reasons !== null)
      queryClient.prefetchQuery(
        validReasonsOptions({ program: programId, facilityType: homeFacility.type.id }),
      );
  }
  const canManageLots = permissions.rights.has(RIGHTS.lotsManage);
  return { userId, homeFacility, program, canViewStock, canManageLots };
}

function StockEventHeader({
  kind,
  facility,
  program,
}: {
  kind: ConfiguredEventKind;
  facility: NamedRecord | undefined;
  program: NamedRecord | undefined;
}) {
  const { t } = useTranslation();
  const { copy } = EVENT_KINDS[kind];
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardPenLineIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {facility && program ? (
            t(copy.editorTitle, {
              code: facility.code,
              facility: recordLabel(facility),
              program: recordLabel(program),
            })
          ) : (
            <span className="block h-10 w-64 max-w-full @xl/main:h-5 @xl/main:w-3xl">
              <Skeleton fill />
            </span>
          )}
        </WorkspaceTitle>
        <WorkspaceDescription>{t(copy.editorDescription)}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

export function StockEventPending({
  kind,
  programId,
}: {
  kind: ConfiguredEventKind;
  programId: string;
}) {
  const { t } = useTranslation();
  const config = EVENT_KINDS[kind];
  const unit = useQuantityUnit();
  const { measure, cards, columnView, layout } = useCardView(
    eventHideableColumns(kind),
    config.columnChoicesKey,
  );
  const userId = useLoginData((state) => state.referenceDataUserId);
  const { data: user } = useQuery({ ...userRecordOptions(userId ?? ''), enabled: false });
  const { data: home } = useQuery({
    ...facilityOptions(user?.homeFacilityId ?? ''),
    enabled: false,
  });
  const program = home?.supportedPrograms?.find((item) => item.id === programId);
  const visibility = {
    ...(cards ? columnView.visibility : {}),
    lotCode: false,
    expiry: false,
    vvm: false,
    total: unit.unit === 'PACKS' && (!cards || columnView.visibility.total !== false),
  };
  return (
    <>
      <Workspace width={config.width}>
        <StockEventHeader kind={kind} facility={home} program={program} />
        <WorkspaceContent>
          <div className="flex min-w-0 flex-col gap-4" aria-busy="true" ref={measure}>
            <ProductLotPickerSkeleton kind={kind} programId={programId} />
            <DataTableToolbar>
              <fieldset className="w-full @2xl/main:me-auto @2xl/main:w-72" disabled>
                <DataTableSearch
                  size="lg"
                  value=""
                  placeholder={t('stock-events.keywords')}
                  onValueChange={() => {}}
                />
              </fieldset>
              {unit.canSwitch && (
                <div className="min-w-0 flex-1 @2xl/main:flex-none">
                  <QuantityUnitToggle unit={unit.unit} onUnitChange={() => {}} disabled />
                </div>
              )}
              <div className={unit.canSwitch ? 'shrink-0' : 'flex-1 @2xl/main:flex-none'}>
                <DataTableViewOptions
                  size="lg"
                  disabled
                  layout={layout}
                  columns={eventHideableColumns(kind)
                    .filter(
                      ({ id }) =>
                        (!cards || id !== 'productCode') &&
                        id !== 'expiry' &&
                        (id !== 'total' || unit.unit === 'PACKS'),
                    )
                    .map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
                  visibility={visibility}
                  onVisibilityChange={() => {}}
                />
              </div>
            </DataTableToolbar>
            <EventLineTableSkeleton
              cards={cards}
              kind={kind}
              unit={unit.unit}
              columnVisibility={visibility}
            />
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width={config.width}>
        <Button disabled size="lg" variant="outline">
          {t('stock-events.clear')}
        </Button>
        <Button disabled size="lg">
          {t('stock-events.submit')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}

function useStockEventPrint({
  copy,
  userId,
  facilityId,
  programId,
}: {
  copy: EventPrintCopy;
  userId: string;
  facilityId: string;
  programId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [eventId, setEventId] = useState<string | null>(null);
  const landing = () =>
    navigate({
      to: '/stock-management/stock-on-hand',
      search: { mode: 'my', facilityId, programId },
    });
  const print = usePrintReport({
    userId,
    right: RIGHTS.stockCardsView,
    facilityId,
    programId,
    request: (lang) => fetchStockEventReport(eventId ?? '', { showInDoses: true, lang }),
    onReport: () => openReport(`stock_event_${eventId}.pdf`, t(copy.loading)),
    successTitle: t(copy.printedTitle),
    successDescription: t(copy.printed),
    errorTitle: t(copy.errorTitle),
    errorDescription: t(copy.error),
    refusedDescription: t(copy.refused),
  });
  return {
    onSubmitted: setEventId,
    dialog: (
      <PrintEventDialog
        copy={copy}
        open={eventId !== null}
        onSkip={() => {
          void landing();
        }}
        onPrint={() => {
          print.print();
          void landing();
        }}
      />
    ),
  };
}

type StockEventEditorPageProps = {
  kind: ConfiguredEventKind;
  defaultReasonId?: string;
  kitUnpackReasonIds?: ComponentProps<typeof EventEditor>['kitUnpackReasonIds'];
  data: Awaited<ReturnType<typeof loadStockEventEditor>>;
  search: EventSearch;
};

export function StockEventEditorPage(props: StockEventEditorPageProps) {
  const navigate = useNavigate();
  const { homeFacility, program } = props.data;
  const copy = EVENT_KINDS[props.kind].print;
  return copy ? (
    <PrintableStockEventEditor {...props} copy={copy} />
  ) : (
    <StockEventEditorContent
      {...props}
      onSubmitted={() =>
        navigate({
          to: '/stock-management/stock-on-hand',
          search: { mode: 'my', facilityId: homeFacility.id, programId: program.id },
        })
      }
    />
  );
}

function PrintableStockEventEditor({
  copy,
  ...props
}: StockEventEditorPageProps & { copy: EventPrintCopy }) {
  const { userId, homeFacility, program } = props.data;
  const print = useStockEventPrint({
    copy,
    userId,
    facilityId: homeFacility.id,
    programId: program.id,
  });
  return (
    <>
      <StockEventEditorContent {...props} onSubmitted={print.onSubmitted} />
      {print.dialog}
    </>
  );
}

function StockEventEditorContent({
  kind,
  defaultReasonId,
  kitUnpackReasonIds,
  data: { homeFacility, program, canViewStock, canManageLots },
  search,
  onSubmitted,
}: StockEventEditorPageProps & {
  onSubmitted: ComponentProps<typeof EventEditor>['onSubmitted'];
}) {
  const { updateSearch } = useSearchNavigation<EventSearch>({});
  const username = useLoginData((state) => state.username) ?? '';
  return (
    <EventEditor
      kind={kind}
      defaultReasonId={defaultReasonId}
      kitUnpackReasonIds={kitUnpackReasonIds}
      key={`${homeFacility.id}/${program.id}`}
      facilityId={homeFacility.id}
      facilityTypeId={homeFacility.type.id}
      programId={program.id}
      username={username}
      canViewStock={canViewStock}
      canManageLots={canManageLots}
      search={search}
      onSearchChange={updateSearch}
      onSubmitted={onSubmitted}
    >
      <StockEventHeader kind={kind} facility={homeFacility} program={program} />
    </EventEditor>
  );
}
