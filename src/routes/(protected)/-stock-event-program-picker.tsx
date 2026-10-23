import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { ClipboardPenLineIcon } from 'lucide-react';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadError } from '@/components/load-error';
import { NoAccess } from '@/components/no-access-page';
import { QueryBoundary } from '@/components/query-boundary';
import {
  StockProgramPicker,
  StockProgramPickerSkeleton,
} from '@/components/stock-program-picker/stock-program-picker';
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
import { useLoginData } from '@/features/auth/store/login-data';
import {
  homeFacilityOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { PendingDeviceWork } from '@/features/stock-events/components/pending-device-work';
import {
  type ConfiguredEventKind,
  EVENT_KINDS,
  homeStockDataset,
} from '@/features/stock-events/lib/event-kinds';
import {
  HOME_STOCK_ACCEPTANCE,
  homeStockProvider,
} from '@/features/stock-events/lib/home-stock-provider';
import {
  type ProgramReadiness,
  programReadiness,
} from '@/features/stock-events/lib/program-readiness';
import { useDownloadedScopes } from '@/hooks/use-downloaded-scopes';
import { type NamedRecord, recordLabel } from '@/lib/facility-program-selection';
import { useOnline } from '@/lib/online';
import { type Permissions, type ProgramGrant, programGrants } from '@/lib/permissions';
import { homeStockPrograms } from '@/lib/stock-programs';

export async function loadStockEventPrograms(
  queryClient: QueryClient,
  right: string,
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
  facilityTypeId?: string;
};
export function StockEventProgramPicker(props: PickerProps) {
  const { userId, permissions } = props;
  const { t } = useTranslation();
  const copy = pickerCopy(props);
  return (
    <Workspace width="narrow">
      <ProgramsHeader userId={userId} copy={copy} />
      <WorkspaceContent>
        {'kind' in props && (
          <PendingDeviceWork
            match={(event) => event.kind === props.kind}
            message={{
              online: 'offline-events.program-pending-online',
              offline: 'offline-events.program-pending-offline',
              values: { kind: props.kind },
            }}
          />
        )}
        <QueryBoundary
          errorComponent={ProgramsError}
          pendingFallback={
            <StockProgramPickerSkeleton
              actionLabel={t(copy.action)}
              statusLabel={copy.status ? t(copy.status) : undefined}
              actionsLabel={copy.actions ? t(copy.actions) : undefined}
            />
          }
          resetKey={userId}
        >
          <EventPrograms
            userId={userId}
            permissions={permissions}
            right={'kind' in props ? EVENT_KINDS[props.kind].right : props.right}
            renderTable={
              'kind' in props
                ? (table) => (
                    <ProgramsTable
                      {...table}
                      kind={props.kind}
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
    facilityTypeId: homeFacility.type.id,
    programs: homeStockPrograms({ homeFacility, ...sources }),
  });
}

function ProgramsTable({
  hasHomeFacility,
  programs,
  action,
  editorLink,
  kind,
  facilityId,
}: ProgramsTableProps & {
  kind: ConfiguredEventKind;
  action: PickerCopy['action'];
  editorLink: (programId: string) => ReactElement;
}) {
  const { t } = useTranslation();
  const online = useOnline();
  const provider = useMemo(() => homeStockProvider(), []);
  const scopes = useMemo(
    () =>
      programs.map((program) => ({
        id: program.id,
        name: recordLabel(program),
        key: [facilityId ?? '', program.id],
      })),
    [programs, facilityId],
  );
  const datasets = EVENT_KINDS[kind].download;
  const homeStock = homeStockDataset(EVENT_KINDS[kind]);
  const downloaded = useDownloadedScopes(provider, scopes, {
    enabled: !online && !!homeStock,
    accepts: HOME_STOCK_ACCEPTANCE[homeStock?.minimumFormat ?? 4],
  });
  return (
    <StockProgramPicker
      actionLabel={t(action)}
      hasHomeFacility={hasHomeFacility}
      linkFor={(row) => editorLink(row.id)}
      rows={programs.map((program) => {
        const readiness = programReadiness({
          programId: program.id,
          datasets,
          states: { 'home-stock': downloaded },
        });
        const disabled = !online && readiness.state !== 'ready';
        const missing =
          !online && readiness.state === 'not-downloaded' ? readiness.reason : undefined;
        return {
          id: program.id,
          label: recordLabel(program),
          disabled,
          disabledReason: missing && t('stock-programs.not-downloaded'),
          disabledDescription: missing && t(NOT_DOWNLOADED_DESCRIPTIONS[missing]),
        };
      })}
    />
  );
}

const NOT_DOWNLOADED_DESCRIPTIONS = {
  'no-stock-card-right': 'stock-programs.no-stock-card-right-description',
  'older-download': 'stock-programs.older-download-description',
  'not-downloaded': 'stock-programs.offline-description',
} satisfies Record<Extract<ProgramReadiness, { state: 'not-downloaded' }>['reason'], ParseKeys>;

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
          statusLabel={copy.status ? t(copy.status) : undefined}
          actionsLabel={copy.actions ? t(copy.actions) : undefined}
        />
      </WorkspaceContent>
    </Workspace>
  );
}
