import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ClipboardListIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableCard, DataTableEmpty } from '@/components/data-table/data-table';
import {
  FacilityProgramSelector,
  FacilityProgramSelectorSkeleton,
  SelectorSkeletonField,
} from '@/components/pickers/facility-program-selector/facility-program-selector';
import {
  prefetchFacilityProgramOptions,
  useFacilityProgramOptions,
} from '@/components/pickers/facility-program-selector/use-facility-program-options';
import { Field, FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { permissionsOptions } from '@/features/auth/api/queries';
import { requirePermissions } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  facilityOptions,
  minimalFacilitiesOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import {
  createRequisitionActionAttempt,
  initiateRequisition,
} from '@/features/requisitions/api/api';
import { periodsForInitiateOptions } from '@/features/requisitions/api/queries';
import {
  InitiatePeriodsSkeleton,
  InitiatePeriodsTable,
} from '@/features/requisitions/components/initiate-periods-table';
import { type InitiateRow, initiateRows } from '@/features/requisitions/lib/initiate';
import { initiateFailureMessage } from '@/features/requisitions/lib/initiate-failure';
import {
  type InitiateSearch,
  initiateSearchSchema,
} from '@/features/requisitions/lib/initiate-search';
import type { InitiateQuery } from '@/features/requisitions/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import {
  type CompleteSelection,
  type FacilityProgramSelection,
  facilityProgramOptions,
  isCompleteSelection,
  sameSelection,
  validSelection,
} from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import { requireOnline } from '@/lib/local-data';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';
import { randomId } from '@/lib/random-id';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope } from '@/lib/session-scope';

const ENTRY_RIGHTS = [
  RIGHTS.requisitionCreate,
  RIGHTS.requisitionDelete,
  RIGHTS.requisitionAuthorize,
];
const PICKER_RIGHTS = [RIGHTS.requisitionCreate, RIGHTS.requisitionAuthorize];
const canSearch = (permissions: Permissions, selection: CompleteSelection) =>
  PICKER_RIGHTS.some((right) =>
    hasProgramGrant(permissions, right, selection.facilityId, selection.programId),
  );
const toQuery = (selection: CompleteSelection, emergency?: boolean): InitiateQuery => ({
  facilityId: selection.facilityId,
  programId: selection.programId,
  emergency: emergency ?? false,
});

export const Route = createFileRoute('/(protected)/_protected/requisitions/initiate')({
  validateSearch: initiateSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const permissions = await requirePermissions(queryClient, ENTRY_RIGHTS);
    const emergency = search.emergency;
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) return;
    prefetchFacilityProgramOptions(queryClient, userId);
    const user = queryClient.getQueryData(userRecordOptions(userId).queryKey);
    const programs = queryClient.getQueryData(userProgramsOptions(userId).queryKey);
    const facilities = queryClient.getQueryData(minimalFacilitiesOptions().queryKey);
    if (
      user &&
      programs &&
      facilities &&
      isCompleteSelection(search) &&
      canSearch(permissions, search)
    ) {
      const options = facilityProgramOptions({
        homeFacilityId: user.homeFacilityId,
        programs,
        facilities,
        grants: permissions.grants.filter((grant) => PICKER_RIGHTS.includes(grant.right)),
      });
      const valid = validSelection(search, options);
      if (valid) {
        queryClient.prefetchQuery(periodsForInitiateOptions(toQuery(valid, emergency)));
        queryClient.prefetchQuery(facilityOptions(valid.facilityId));
      }
    }
  },
  pendingComponent: InitiatePending,
  component: InitiatePage,
});
function Header() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardListIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('requisitions.initiate.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('requisitions.initiate.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function PickerSkeleton() {
  const { t } = useTranslation();
  return (
    <FacilityProgramSelectorSkeleton>
      <SelectorSkeletonField label={t('requisitions.initiate.type')} />
    </FacilityProgramSelectorSkeleton>
  );
}
function InitiatePending() {
  const search = Route.useSearch();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <Workspace>
      <Header />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <PickerSkeleton />
          {isCompleteSelection(search) && <InitiatePeriodsSkeleton cards={cards} />}
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
function InitiatePage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  const { t } = useTranslation();
  return (
    <Workspace>
      <Header />
      <WorkspaceContent>
        <QueryBoundary
          resetKey={userId ?? ''}
          pendingFallback={<PickerSkeleton />}
          errorComponent={({ error, reset }) => (
            <ListError
              error={error}
              reset={reset}
              title={t('facility-program.load-error-title')}
              description={t('facility-program.load-error-description')}
            />
          )}
        >
          {userId && <InitiateBody userId={userId} />}
        </QueryBoundary>
      </WorkspaceContent>
    </Workspace>
  );
}
function InitiateBody({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const grants = useMemo(
    () => permissions.grants.filter((grant) => PICKER_RIGHTS.includes(grant.right)),
    [permissions],
  );
  const options = useFacilityProgramOptions(userId, grants);
  const applied = useMemo(
    () => ({ mode: search.mode, facilityId: search.facilityId, programId: search.programId }),
    [search.mode, search.facilityId, search.programId],
  );
  const valid = validSelection(applied, options);
  const [draft, setDraft] = useState<FacilityProgramSelection | null>(null);
  const [emergency, setEmergency] = useState(search.emergency ?? false);
  const [over, setOver] = useState(search);
  if (over !== search) {
    setOver(search);
    setEmergency(search.emergency ?? false);
    setDraft(null);
  }
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const changed =
    (draft !== null && valid !== null && !sameSelection(draft, valid)) ||
    emergency !== (search.emergency ?? false);
  const onSearch = useCallback(
    (selection: CompleteSelection) => {
      if (sameSelection(selection, applied) && emergency === (search.emergency ?? false)) {
        void queryClient.invalidateQueries({
          queryKey: periodsForInitiateOptions(toQuery(selection, emergency)).queryKey,
        });
      }
      void navigate({ search: { ...selection, emergency: emergency || undefined } });
    },
    [applied, emergency, navigate, queryClient, search.emergency],
  );
  const typeField = useMemo(
    () => (
      <Field>
        <FieldLabel id="requisition-type-label">{t('requisitions.initiate.type')}</FieldLabel>
        <RadioGroup
          aria-labelledby="requisition-type-label"
          variant="segmented"
          size="lg"
          value={emergency ? 'emergency' : 'regular'}
          onValueChange={(value) => setEmergency(value === 'emergency')}
        >
          <RadioGroupItem variant="segmented" value="regular">
            {t('requisitions.requisition.regular')}
          </RadioGroupItem>
          <RadioGroupItem variant="segmented" value="emergency">
            {t('requisitions.requisition.emergency')}
          </RadioGroupItem>
        </RadioGroup>
      </Field>
    ),
    [t, emergency],
  );
  return (
    <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <FacilityProgramSelector
        applied={applied}
        options={options}
        onDraftChange={setDraft}
        onSearch={onSearch}
      >
        {typeField}
      </FacilityProgramSelector>
      {valid && canSearch(permissions, valid) && !changed ? (
        <QueryBoundary
          resetKey={JSON.stringify(search)}
          pendingFallback={<InitiatePeriodsSkeleton cards={cards} />}
          errorComponent={PeriodsError}
        >
          <Periods
            key={JSON.stringify(search)}
            query={toQuery(valid, search.emergency)}
            search={search}
            cards={cards}
            canCreate={hasProgramGrant(
              permissions,
              RIGHTS.requisitionCreate,
              valid.facilityId,
              valid.programId,
            )}
          />
        </QueryBoundary>
      ) : (
        <DataTableCard>
          <DataTableEmpty
            icon={<ClipboardListIcon />}
            title={t('requisitions.initiate.search-title')}
            description={t('requisitions.initiate.select-required')}
          />
        </DataTableCard>
      )}
    </div>
  );
}
function PeriodsError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <ListError
      error={error}
      reset={reset}
      title={t(
        isAxiosError(error) &&
          error.response?.data?.messageKey === 'requisition.error.facilityDoesNotSupportProgram'
          ? 'requisitions.initiate.error.not-supported'
          : 'requisitions.initiate.load-failed',
      )}
      description={
        initiateFailureMessage(error, t) ?? t('requisitions.initiate.load-failed-description')
      }
    />
  );
}
function Periods({
  query,
  search,
  cards,
  canCreate,
}: {
  query: InitiateQuery;
  search: InitiateSearch;
  cards: boolean;
  canCreate: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [periods, facility] = useSuspenseQueries({
    queries: [periodsForInitiateOptions(query), facilityOptions(query.facilityId)],
  });
  const rows = useMemo(
    () =>
      initiateRows(
        periods.data,
        query.emergency,
        canCreate,
        facility.data.supportedPrograms?.find((program) => program.id === query.programId)
          ?.supportStartDate,
      ),
    [periods.data, query.emergency, canCreate, facility.data, query.programId],
  );
  const [attempt] = useState(createRequisitionActionAttempt);
  const unresolved = useRef(false);
  const reconciling = useRef(false);
  const posting = useRef(false);
  const [clicked, setClicked] = useState<string>();
  const refresh = async () => {
    await queryClient.fetchQuery({ ...periodsForInitiateOptions(query), retry: false });
    assertSessionScope(attempt.sessionScope);
    unresolved.current = false;
    attempt.key = randomId();
  };
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: async () => {
      requireOnline();
      if (unresolved.current) {
        reconciling.current = true;
        await refresh();
        return null;
      }
      return initiateRequisition(query, attempt);
    },
    onSuccess: async (record) => {
      if (!record) {
        toast.info(t('requisitions.initiate.refreshed'), {
          description: t('requisitions.initiate.refreshed-description'),
        });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.requisitions.all });
      assertSessionScope(attempt.sessionScope);
      await router.navigate({
        to: '/requisitions/view/$requisitionId',
        params: { requisitionId: record.id },
        state: { requisitionReturn: { to: '/requisitions/initiate', search } },
      });
    },
    onError: async (error) => {
      if (reconciling.current) {
        toast.error(t('requisitions.initiate.load-failed'), {
          description: t('requisitions.initiate.load-failed-description'),
        });
        return;
      }
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (!status || status === 409 || status >= 500) {
        unresolved.current = true;
        try {
          await refresh();
        } catch {
          assertSessionScope(attempt.sessionScope);
        }
      } else {
        attempt.key = randomId();
      }
      assertSessionScope(attempt.sessionScope);
      toast.error(t('requisitions.initiate.initiate-failed'), {
        description:
          initiateFailureMessage(error, t) ??
          t('requisitions.initiate.initiate-failed-description'),
      });
    },
    onSettled: () => {
      reconciling.current = false;
      posting.current = false;
      setClicked(undefined);
    },
  });
  const onStart = (row: InitiateRow) => {
    if (posting.current) return;
    try {
      requireOnline();
    } catch {
      toast.info(t('offline.title'), {
        description: t('requisitions.initiate.offline-description'),
      });
      return;
    }
    posting.current = true;
    setClicked(row.requisitionId ?? row.id);
    mutation.mutate();
  };
  const openLink = useCallback(
    (id: string) => (
      <Link
        to="/requisitions/view/$requisitionId"
        params={{ requisitionId: id }}
        state={{ requisitionReturn: { to: '/requisitions/initiate', search } }}
      />
    ),
    [search],
  );
  return (
    <InitiatePeriodsTable
      rows={rows}
      cards={cards}
      onStart={onStart}
      openLink={openLink}
      disabled={mutation.isPending}
      pending={clicked}
    />
  );
}
