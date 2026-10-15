import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { type ErrorComponentProps, Link } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { ClipboardPenLineIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import { LoadError } from '@/components/load-error';
import { NoAccess } from '@/components/no-access-page';
import { QueryBoundary } from '@/components/query-boundary';
import {
  StockProgramPicker,
  StockProgramPickerSkeleton,
} from '@/components/stock-program-picker/stock-program-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { ForbiddenError, isForbidden, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  homeFacilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { useDeviceEvents } from '@/features/stock-events/hooks/use-device-events';
import { type ConfiguredEventKind, EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import { useAdjustmentReadiness } from '@/hooks/use-adjustment-readiness';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { type NamedRecord, recordLabel } from '@/lib/facility-program-selection';
import { useDownloadStatus } from '@/lib/offline-download-status';
import { type Permissions, type ProgramGrant, programGrants } from '@/lib/permissions';
import { homeStockPrograms } from '@/lib/stock-programs';

export async function loadStockEventPrograms(
  queryClient: QueryClient,
  right: string = RIGHTS.stockAdjust,
): Promise<{ userId: string; permissions: Permissions }> {
  const userId = useLoginData.getState().referenceDataUserId;
  const permissions = await requirePermissions(queryClient, right);
  if (!userId || useLoginData.getState().referenceDataUserId !== userId) {
    throw new ForbiddenError(right);
  }
  queryClient.prefetchQuery(userProgramsOptions(userId));
  queryClient.prefetchQuery(userRecordOptions(userId)).then(() => {
    const user = queryClient.getQueryData(userRecordOptions(userId).queryKey);
    if (user?.homeFacilityId && useLoginData.getState().referenceDataUserId === userId) {
      queryClient.prefetchQuery(homeFacilityOptions(user.homeFacilityId));
    }
  });
  return { userId, permissions };
}
function ProgramsHeader({ userId, copy }: { userId?: string; copy: PickerCopy }) {
  const { t } = useTranslation();
  const { data: user } = useQuery({ ...userRecordOptions(userId ?? ''), enabled: Boolean(userId) });
  const homeId = user?.homeFacilityId;
  const { data: home } = useQuery({
    ...homeFacilityOptions(homeId ?? ''),
    enabled: Boolean(homeId),
  });
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardPenLineIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {home ? (
            t(copy.title, { facility: recordLabel(home) })
          ) : copy.nav ? (
            t(copy.nav)
          ) : (
            <span className="block h-5 w-64 max-w-full @xl/main:w-96">
              <Skeleton fill />
            </span>
          )}
        </WorkspaceTitle>
        <WorkspaceDescription>{t(copy.description)}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

type PickerCopy = {
  title: ParseKeys;
  description: ParseKeys;
  action: ParseKeys;
  nav?: ParseKeys;
  status?: ParseKeys;
  actions?: ParseKeys;
};
type PickerSource = { kind: ConfiguredEventKind } | { copy: PickerCopy };
function pickerCopy(source: PickerSource): PickerCopy {
  if ('copy' in source) return source.copy;
  const copy = EVENT_KINDS[source.kind].copy;
  return {
    title: copy.pickerTitle,
    description: copy.pageDescription,
    action: copy.make,
    status: EVENT_KINDS[source.kind].download ? 'offline.download.readiness' : undefined,
  };
}
type PickerProps = {
  userId: string;
  permissions: Permissions;
} & (
  | { kind: ConfiguredEventKind; editorLink: (programId: string) => ReactElement }
  | {
      copy: PickerCopy;
      right: string;
      children: (table: ProgramsTableProps) => ReactNode;
    }
);

export type ProgramsTableProps = {
  hasHomeFacility: boolean;
  programs: readonly NamedRecord[];
  facilityId?: string;
};
export function StockEventProgramPicker(props: PickerProps) {
  const { userId, permissions } = props;
  const { t } = useTranslation();
  const copy = pickerCopy(props);
  return (
    <Workspace width="narrow">
      <ProgramsHeader userId={userId} copy={copy} />
      <WorkspaceContent>
        {'kind' in props && <PendingDeviceWork kind={props.kind} />}
        <QueryBoundary
          errorComponent={ProgramsError}
          pendingFallback={
            <StockProgramPickerSkeleton
              actionLabel={t(copy.action)}
              statusLabel={
                copy.status === 'offline.download.readiness' ? (
                  <ReadinessLabel />
                ) : copy.status ? (
                  t(copy.status)
                ) : undefined
              }
              actionsLabel={copy.actions ? t(copy.actions) : undefined}
            />
          }
          resetKey={userId}
        >
          <EventPrograms
            userId={userId}
            permissions={permissions}
            right={'kind' in props ? RIGHTS.stockAdjust : props.right}
            renderTable={
              'kind' in props
                ? (table) =>
                    EVENT_KINDS[props.kind].download ? (
                      <DownloadedProgramsTable
                        {...table}
                        action={copy.action}
                        editorLink={props.editorLink}
                      />
                    ) : (
                      <ProgramsTable
                        {...table}
                        action={copy.action}
                        editorLink={props.editorLink}
                      />
                    )
                : props.children
            }
          />
        </QueryBoundary>
      </WorkspaceContent>
    </Workspace>
  );
}

function PendingDeviceWork({ kind }: { kind: ConfiguredEventKind }) {
  const { t } = useTranslation();
  const { events } = useDeviceEvents();
  const count =
    events?.filter(
      (event) =>
        event.kind === kind &&
        (['queued', 'sending', 'uncertain'].includes(event.status) ||
          (event.status === 'refused' && !event.error?.resolvedAt)),
    ).length ?? 0;
  if (!count) return null;
  return (
    <Alert role="note">
      <AlertDescription>
        {t('device-events.program-pending', { count })}{' '}
        <Link to="/stock-management/device-events" className="underline underline-offset-4">
          {t('device-events.review')}
        </Link>
      </AlertDescription>
    </Alert>
  );
}

type ProgramSources = {
  userId: string;
  permissions: Permissions;
  right: string;
  renderTable: (table: ProgramsTableProps) => ReactNode;
};
function EventPrograms({ userId, permissions, right, renderTable }: ProgramSources) {
  const [user, programs] = useSuspenseQueries({
    queries: [userRecordOptions(userId), userProgramsOptions(userId)],
  });
  if (!user.data.homeFacilityId) return renderTable({ hasHomeFacility: false, programs: [] });
  return (
    <HomePrograms
      renderTable={renderTable}
      grants={programGrants(permissions, right)}
      homeId={user.data.homeFacilityId}
      programs={programs.data}
    />
  );
}

function HomePrograms({
  homeId,
  renderTable,
  ...sources
}: {
  homeId: string;
  programs: readonly NamedRecord[];
  grants: readonly ProgramGrant[];
  renderTable: ProgramSources['renderTable'];
}) {
  const { data: homeFacility } = useSuspenseQuery(homeFacilityOptions(homeId));
  return renderTable({
    hasHomeFacility: true,
    facilityId: homeId,
    programs: homeStockPrograms({ homeFacility, ...sources }),
  });
}

function ProgramsTable({
  hasHomeFacility,
  programs,
  action,
  editorLink,
}: ProgramsTableProps & {
  action: PickerCopy['action'];
  editorLink: (programId: string) => ReactElement;
}) {
  const { t } = useTranslation();
  return (
    <StockProgramPicker
      actionLabel={t(action)}
      hasHomeFacility={hasHomeFacility}
      linkFor={(row) => editorLink(row.id)}
      rows={programs.map((program) => ({ id: program.id, label: recordLabel(program) }))}
    />
  );
}

function DownloadedProgramsTable({
  hasHomeFacility,
  programs,
  facilityId,
  action,
  editorLink,
}: ProgramsTableProps & {
  action: PickerCopy['action'];
  editorLink: (programId: string) => ReactElement;
}) {
  const { t, i18n } = useTranslation();
  const bundles = useAdjustmentReadiness(facilityId);
  const download = useDownloadStatus();
  const timeZone = useDeploymentTimeZone();
  return (
    <StockProgramPicker
      actionLabel={t(action)}
      hasHomeFacility={hasHomeFacility}
      statusLabel={<ReadinessLabel />}
      linkFor={(row) => editorLink(row.id)}
      rows={programs.map((program) => {
        const bundle = bundles.find((bundle) => bundle.programId === program.id);
        return {
          id: program.id,
          label: recordLabel(program),
          status:
            download.phase === 'running' &&
            download.incompletePrograms.some((item) => item.id === program.id) ? (
              t('offline.download.downloading')
            ) : bundle ? (
              <div className="flex flex-col gap-1">
                <span>
                  {t(bundle.stale ? 'offline.download.needs-refresh' : 'offline.download.ready')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('offline.download.downloaded-at', {
                    date: formatTimestamp(new Date(bundle.fetchedAt).toISOString(), i18n.language, {
                      time: true,
                      timeZone,
                    }),
                  })}
                </span>
              </div>
            ) : (
              t('offline.download.not-downloaded')
            ),
        };
      })}
    />
  );
}

function ProgramsError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  if (isForbidden(error)) return <NoAccess />;
  return (
    <LoadError
      description={t('stock-programs.load-error')}
      error={error}
      reset={reset}
      title={t('stock-programs.load-error-title')}
    />
  );
}

export function StockEventProgramsPending(source: PickerSource) {
  const { t } = useTranslation();
  const copy = pickerCopy(source);
  return (
    <Workspace width="narrow">
      <ProgramsHeader copy={copy} />
      <WorkspaceContent>
        <StockProgramPickerSkeleton
          actionLabel={t(copy.action)}
          statusLabel={
            copy.status === 'offline.download.readiness' ? (
              <ReadinessLabel />
            ) : copy.status ? (
              t(copy.status)
            ) : undefined
          }
          actionsLabel={copy.actions ? t(copy.actions) : undefined}
        />
      </WorkspaceContent>
    </Workspace>
  );
}

function ReadinessLabel() {
  const { t } = useTranslation();
  return (
    <>
      <span className="@xl/main:hidden">{t('offline.download.short-readiness')}</span>
      <span className="hidden @xl/main:inline">{t('offline.download.readiness')}</span>
    </>
  );
}
