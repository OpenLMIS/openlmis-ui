import { type QueryClient, useQuery } from '@tanstack/react-query';
import { ClipboardPenLineIcon } from 'lucide-react';
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
  userProgramsOptions,
  userRecordOptions,
  validDestinationsOptions,
  validReasonsOptions,
} from '@/features/reference-data/api/queries';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import {
  EventLineTableSkeleton,
  eventHideableColumns,
} from '@/features/stock-events/components/event-line-table';
import { ProductLotPickerSkeleton } from '@/features/stock-events/components/product-lot-picker';
import { type ConfiguredEventKind, EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { recordLabel } from '@/lib/facility-program-selection';
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
    if (EVENT_KINDS[kind].counterparty === 'destination')
      queryClient.prefetchQuery(validDestinationsOptions({ facilityId: homeId, programId }));
    queryClient.prefetchQuery(eventStockCardsOptions({ facilityId: homeId, programId }));
    queryClient.prefetchQuery(
      validReasonsOptions({ program: programId, facilityType: homeFacility.type.id }),
    );
  }
  return { userId, homeFacility, program, canViewStock };
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
  const userId = useLoginData((state) => state.referenceDataUserId);
  const { data: user } = useQuery({ ...userRecordOptions(userId ?? ''), enabled: false });
  const { data: home } = useQuery({
    ...facilityOptions(user?.homeFacilityId ?? ''),
    enabled: false,
  });
  const program = home?.supportedPrograms?.find((item) => item.id === programId);
  const prefix = kind === 'issue' ? 'stock-issue' : 'stock-adjustment';
  const visibility = { lotCode: false, expiry: false, vvm: false, total: unit.unit === 'PACKS' };
  return (
    <>
      <Workspace width={config.width}>
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <ClipboardPenLineIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>
              {home && program ? (
                t(`${prefix}.editor-title`, {
                  code: home.code,
                  facility: recordLabel(home),
                  program: recordLabel(program),
                })
              ) : (
                <span className="block h-10 w-64 max-w-full @xl/main:h-5 @xl/main:w-3xl">
                  <Skeleton fill />
                </span>
              )}
            </WorkspaceTitle>
            <WorkspaceDescription>{t(`${prefix}.editor-description`)}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div className="flex min-w-0 flex-col gap-4" aria-busy="true">
            <ProductLotPickerSkeleton />
            <DataTableToolbar>
              <fieldset className="w-full @xl/main:w-72" disabled>
                <DataTableSearch
                  value=""
                  placeholder={t('stock-events.keywords')}
                  onValueChange={() => {}}
                />
              </fieldset>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 @xl/main:ms-auto @xl/main:w-auto">
                {unit.canSwitch && (
                  <QuantityUnitToggle unit={unit.unit} onUnitChange={() => {}} disabled />
                )}
                <div className="shrink-0">
                  <DataTableViewOptions
                    disabled
                    columns={eventHideableColumns(kind)
                      .filter(
                        ({ id }) => id !== 'expiry' && (id !== 'total' || unit.unit === 'PACKS'),
                      )
                      .map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
                    visibility={visibility}
                    onVisibilityChange={() => {}}
                  />
                </div>
              </div>
            </DataTableToolbar>
            <EventLineTableSkeleton kind={kind} unit={unit.unit} columnVisibility={visibility} />
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
