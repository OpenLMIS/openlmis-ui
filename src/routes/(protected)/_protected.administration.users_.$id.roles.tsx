import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
  CatchBoundary,
  createFileRoute,
  type ErrorComponentProps,
  Link,
  useBlocker,
  useRouter,
} from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { CopyPlusIcon, Loader2Icon, ShieldIcon, UserXIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataTableError } from '@/components/data-table/data-table';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { rightsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  minimalFacilitiesOptions,
  programsOptions,
  rolesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import { updateUserRoles } from '@/features/users/api/api';
import { userDetailsOptions } from '@/features/users/api/queries';
import { ErrorAlert, serverMessage } from '@/features/users/components/dialog-parts';
import { DiscardChangesDialog } from '@/features/users/components/discard-changes-dialog';
import { RoleAssignmentsTableSkeleton } from '@/features/users/components/role-assignments-table';
import { RoleTabs } from '@/features/users/components/role-tabs';
import { fullName } from '@/features/users/lib/names';
import { countChanges, ROLE_TABS, type RoleRow } from '@/features/users/lib/role-assignments';
import {
  CLOSED_ROLE_DIALOGS,
  type RolesSearch,
  rolesSearchSchema,
} from '@/features/users/lib/roles-search';
import type { RoleAssignment, UserDetails } from '@/features/users/lib/types';
import { useRoleDraft } from '@/features/users/lib/use-role-draft';
import { queryKeys } from '@/lib/key-factory';
import type { SearchChange } from '@/lib/table-search';

// Their own chunk, fetched once the page has painted.
const loadRoleDialogs = () => import('@/features/users/components/role-dialogs');
const RoleDialogs = lazy(() =>
  loadRoleDialogs().then((module) => ({ default: module.RoleDialogs })),
);

export const Route = createFileRoute('/(protected)/_protected/administration/users_/$id/roles')({
  validateSearch: rolesSearchSchema,
  staticData: { crumbKey: 'users.roles' },
  loader: ({ context: { queryClient }, params }) => {
    queryClient.prefetchQuery(rolesOptions());
    queryClient.prefetchQuery(programsOptions());
    // Slow, so they start now and fill in the rows when they arrive.
    queryClient.prefetchQuery(supervisoryNodesOptions());
    queryClient.prefetchQuery(minimalFacilitiesOptions());
    // A failed preload is retried when the dialogs render, where the boundary below catches it.
    loadRoleDialogs().catch(() => undefined);
    // A user that does not exist has no roles page, so the page waits for the user.
    return queryClient.ensureQueryData(userDetailsOptions(params.id));
  },
  pendingComponent: RolesPagePending,
  errorComponent: RolesPageError,
  component: UserRolesPage,
});

/** Too narrow for a column per name, so each row lists them under the role. */
const COMPACT_BELOW = 576;

function UserRolesPage() {
  const { id: userId } = Route.useParams();
  const { data: details } = useSuspenseQuery(userDetailsOptions(userId));
  // A different user starts a fresh draft.
  return <RolesEditor details={details} key={userId} />;
}

function RolesEditor({ details }: { details: UserDetails }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { user } = details;
  const signedInUserId = useLoginData((state) => state.referenceDataUserId);
  const draft = useRoleDraft(user.roleAssignments);
  const tab = ROLE_TABS.find((item) => item.id === (search.tab ?? 'supervision')) ?? ROLE_TABS[0];
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();

  const updateSearch = useCallback(
    (update: Parameters<SearchChange<RolesSearch>>[0], replace = false) =>
      navigate({
        search: (previous) => ({
          ...previous,
          ...(typeof update === 'function' ? update(previous) : update),
        }),
        replace,
      }),
    [navigate],
  );
  // Opening marks the entry it pushes, so closing steps Back instead of stacking history.
  const openDialog = useCallback(
    (params: Partial<RolesSearch>) =>
      navigate({
        search: (previous) => ({ ...previous, ...CLOSED_ROLE_DIALOGS, ...params }),
        state: (previous) => ({ ...previous, dialogOpenedHere: true }),
      }),
    [navigate],
  );
  const closeDialog = useCallback(() => {
    if (router.state.location.state.dialogOpenedHere) router.history.back();
    else updateSearch(CLOSED_ROLE_DIALOGS, true);
  }, [router, updateSearch]);

  // The draft as it is now, for a save that finishes after later edits.
  const latestDraft = useRef(draft.draft);
  latestDraft.current = draft.draft;
  // Set once the page may be left without asking, e.g. right after a save.
  const leaving = useRef(false);
  const backToUsers = useCallback(
    () => navigate({ to: '/administration/users', search: {} }),
    [navigate],
  );

  const save = useMutation({
    mutationFn: (sent: RoleAssignment[]) => updateUserRoles(user.id, sent),
    onSuccess: (saved, sent) => {
      queryClient.setQueryData(userDetailsOptions(user.id).queryKey, (previous) =>
        previous ? { ...previous, user: saved } : previous,
      );
      const editedMeanwhile = countChanges(sent, latestDraft.current) > 0;
      draft.commit(sent, saved.roleAssignments);
      toast.success(t('users.roles.saved', { username: user.username }));
      // Your own roles decide what this app shows you.
      if (user.id === signedInUserId) {
        void queryClient.invalidateQueries({ queryKey: rightsOptions(user.id).queryKey });
      }
      // Back to the list, as legacy does, unless that would drop edits made during the save.
      if (!editedMeanwhile) {
        leaving.current = true;
        void backToUsers();
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });

  // Tabs, dialogs and paging stay on this page; only leaving it can lose the draft.
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      !leaving.current &&
      draft.changes > 0 &&
      current.pathname !== next.pathname &&
      next.pathname !== '/login',
    enableBeforeUnload: () => draft.changes > 0,
    withResolver: true,
  });

  const { add, remove } = draft;
  const rolesRegion = useRef<HTMLDivElement>(null);
  const removeRole = useCallback(
    (row: RoleRow) => {
      remove(row.assignment);
      // The row and its menu are gone, so focus moves to the list instead of the page body.
      rolesRegion.current?.focus();
      toast(t('users.roles.removed', { role: row.role ?? t('users.roles.unknown') }), {
        action: { label: t('users.roles.undo'), onClick: () => add(row.assignment) },
      });
    },
    [add, remove, t],
  );
  const viewRights = useCallback((roleId: string) => openDialog({ rights: roleId }), [openDialog]);

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ShieldIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>
            {t('users.roles.title', { name: fullName(user) || user.username })}
          </WorkspaceTitle>
          <WorkspaceDescription>
            {t('users.roles.description', { username: user.username })}
          </WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <Button onClick={() => openDialog({ dialog: 'import' })} size="lg" variant="outline">
            <CopyPlusIcon data-icon="inline-start" />
            {t('users.roles.import')}
          </Button>
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4 lg:gap-6" ref={measureContent}>
          {save.isError && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('users.roles.save-error')}
              title={t('users.roles.save-error-title')}
            />
          )}
          <div className="outline-none" ref={rolesRegion} tabIndex={-1}>
            <RoleTabs
              compact={contentWidth !== undefined && contentWidth < COMPACT_BELOW}
              draft={draft.draft}
              homeFacilityId={user.homeFacilityId}
              onAdd={() => openDialog({ dialog: 'add' })}
              onRemove={removeRole}
              onSearchChange={updateSearch}
              onViewRights={viewRights}
              saved={user.roleAssignments}
              search={search}
              tab={tab}
            />
          </div>
        </div>
        {/* A dialogs chunk that fails to load must not take the page, and the draft, with it. */}
        <CatchBoundary errorComponent={() => null} getResetKey={() => search.dialog ?? ''}>
          <Suspense fallback={null}>
            <RoleDialogs
              addType={search.dialog === 'add' ? tab.type : undefined}
              draft={draft.draft}
              hasHomeFacility={Boolean(user.homeFacilityId)}
              importOpen={search.dialog === 'import'}
              onAdd={draft.add}
              onClose={closeDialog}
              onImport={(assignments, fromUsername) => {
                const { added } = draft.merge(assignments);
                toast.success(
                  t('users.roles.import.imported', { count: added, username: fromUsername }),
                );
              }}
              rightsRoleId={search.rights}
              userId={user.id}
              username={user.username}
            />
          </Suspense>
        </CatchBoundary>
        <DiscardChangesDialog
          changes={draft.changes}
          onDiscard={() => {
            draft.discard();
            blocker.proceed?.();
          }}
          onKeepEditing={() => blocker.reset?.()}
          open={blocker.status === 'blocked'}
          username={user.username}
        />
      </WorkspaceContent>
      <WorkspaceFooter>
        {/* Leaving with unsaved changes asks first, through the blocker. */}
        <Button disabled={save.isPending} onClick={backToUsers} size="lg" variant="outline">
          {t('users.roles.cancel')}
        </Button>
        <Button
          disabled={draft.changes === 0 || save.isPending}
          onClick={() => save.mutate(draft.draft)}
          size="lg"
        >
          {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('users.roles.save')}
          {draft.changes > 0 && (
            <Badge variant="secondary">
              <span aria-hidden="true">{draft.changes}</span>
              <span className="sr-only">
                {t('users.roles.unsaved-count', { count: draft.changes })}
              </span>
            </Badge>
          )}
        </Button>
      </WorkspaceFooter>
    </Workspace>
  );
}

/** While the user loads: the page's frame with placeholders where their name and roles go. */
function RolesPagePending() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ShieldIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('users.roles')}</WorkspaceTitle>
          {/* Holds the line the user's description takes, so the header does not grow. */}
          <WorkspaceDescription>{'\u00a0'}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div aria-busy className="flex flex-col gap-4">
          <div className="h-8 w-80 max-w-full">
            <Skeleton fill />
          </div>
          <RoleAssignmentsTableSkeleton compact={false} search={{}} tab={ROLE_TABS[0]} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function RolesPageError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const notFound = isAxiosError(error) && error.response?.status === 404;

  return (
    <Workspace>
      <WorkspaceContent>
        {notFound ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserXIcon />
              </EmptyMedia>
              <EmptyTitle>{t('users.roles.not-found-title')}</EmptyTitle>
              <EmptyDescription>{t('users.roles.not-found-description')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                nativeButton={false}
                render={<Link to="/administration/users" />}
                variant="outline"
              >
                {t('users.roles.back')}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <DataTableError
            description={t('users.roles.error-description')}
            onRetry={() => {
              reset();
              void router.invalidate();
            }}
            title={t('users.roles.load-error-title')}
          />
        )}
      </WorkspaceContent>
    </Workspace>
  );
}
