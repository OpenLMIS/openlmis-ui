import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
  CatchBoundary,
  createFileRoute,
  type ErrorComponentProps,
  Link,
  useRouter,
} from '@tanstack/react-router';
import { CopyPlusIcon, Loader2Icon, ShieldIcon, UserXIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { RouteLoadError } from '@/components/route-load-error';
import { Block } from '@/components/skeleton-block';
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
import { refreshIfSignedIn } from '@/features/auth/api/queries';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  minimalFacilitiesOptions,
  programsOptions,
  rolesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import { updateUserRoles } from '@/features/users/api/api';
import { userDetailsOptions } from '@/features/users/api/queries';
import { RoleTabs, RoleTabsSkeleton } from '@/features/users/components/role-tabs';
import { countChanges, ROLE_TABS, type RoleRow } from '@/features/users/lib/role-assignments';
import {
  CLOSED_ROLE_DIALOGS,
  type RolesSearch,
  rolesSearchSchema,
} from '@/features/users/lib/roles-search';
import type { UserDetails } from '@/features/users/lib/types';
import { useRoleDraft } from '@/features/users/lib/use-role-draft';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { fullName } from '@/lib/text';
import type { RoleAssignment } from '@/lib/user-types';

// Their own chunk, fetched once the page has painted.
const loadRoleDialogs = () => import('@/features/users/components/role-dialogs');
const RoleDialogs = lazy(() =>
  loadRoleDialogs().then((module) => ({ default: module.RoleDialogs })),
);

export const Route = createFileRoute('/(protected)/_protected/administration/users_/$id/roles')({
  validateSearch: rolesSearchSchema,
  staticData: { crumbKey: 'users.roles' },
  loader: async ({ context: { queryClient }, params }) => {
    queryClient.prefetchQuery(rolesOptions());
    queryClient.prefetchQuery(programsOptions());
    // Slow, so they start now and fill in the rows when they arrive.
    queryClient.prefetchQuery(supervisoryNodesOptions());
    queryClient.prefetchQuery(minimalFacilitiesOptions());
    // A failed preload is retried when the dialogs render, where the boundary below catches it.
    loadRoleDialogs().catch(() => undefined);
    // The page waits for the right it needs and for the user, which must exist; both at once.
    const [, details] = await Promise.all([
      requireRight(queryClient, RIGHTS.usersManage),
      queryClient.ensureQueryData(userDetailsOptions(params.id)),
    ]);
    return details;
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
  const draft = useRoleDraft(user.roleAssignments);
  const tab = ROLE_TABS.find((item) => item.id === (search.tab ?? 'supervision')) ?? ROLE_TABS[0];
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();

  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<RolesSearch>(CLOSED_ROLE_DIALOGS);

  // The draft as it is now, for a save that finishes after later edits.
  const latestDraft = useRef(draft.draft);
  useEffect(() => {
    latestDraft.current = draft.draft;
  });
  // Set once the page may be left without asking, e.g. right after a save.
  const leaving = useRef(false);
  // The list as it was when this page was opened from it, with its page, sort and filters.
  const [listSearch] = useState(() => router.state.location.state.usersListSearch ?? {});
  const backToUsers = useCallback(
    () => navigate({ to: '/administration/users', search: listSearch }),
    [navigate, listSearch],
  );

  const save = useMutation({
    mutationFn: (sent: RoleAssignment[]) => updateUserRoles(user.id, sent),
    onSuccess: (saved, sent) => {
      queryClient.setQueryData(userDetailsOptions(user.id).queryKey, (previous) =>
        previous ? { ...previous, user: saved } : previous,
      );
      const editedMeanwhile = countChanges(sent, latestDraft.current) > 0;
      draft.commit(sent, saved.roleAssignments);
      toast.success(t('users.roles.saved-title'), {
        description: t('users.roles.saved', { username: user.username }),
      });
      refreshIfSignedIn(queryClient, user.id);
      // A sign out asked for during the save goes ahead, now that nothing is left to lose.
      if (!editedMeanwhile && guard.leaveIfAsked()) return;
      // Back to the list, as legacy does, unless that would drop edits made during the save.
      if (!editedMeanwhile) {
        leaving.current = true;
        void backToUsers();
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roles.all }),
      ]),
  });

  // Tabs, dialogs and paging stay on this page; only leaving it, or signing out, can lose the draft.
  const guard = useDiscardGuard(draft.changes > 0, { allowLeave: () => leaving.current });

  const { add, remove } = draft;
  const rolesRegion = useRef<HTMLDivElement>(null);
  // Their Undo edits this page's draft, so they go when the page does.
  const removalToasts = useRef(new Set<string | number>());
  useEffect(() => {
    const toasts = removalToasts.current;
    return () => {
      for (const id of toasts) toast.dismiss(id);
    };
  }, []);
  const removeRole = useCallback(
    (row: RoleRow) => {
      remove(row.assignment);
      // The row and its menu are gone, so focus moves to the list instead of the page body.
      rolesRegion.current?.focus();
      const id = toast(t('users.roles.removed-title'), {
        description: t('users.roles.removed', { role: row.role ?? t('users.roles.unknown') }),
        action: { label: t('users.roles.undo'), onClick: () => add(row.assignment) },
        // Twice the usual time, so Undo can be reached by keyboard too.
        duration: 8000,
      });
      removalToasts.current.add(id);
    },
    [add, remove, t],
  );

  return (
    <>
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
                  toast.success(t('users.roles.import.imported-title'), {
                    description: t('users.roles.import.imported', {
                      count: added,
                      username: fromUsername,
                    }),
                  });
                }}
                userId={user.id}
                username={user.username}
              />
            </Suspense>
          </CatchBoundary>
          <DiscardChangesDialog
            description={t('users.roles.discard-description', {
              count: draft.changes,
              username: user.username,
            })}
            {...guard.dialog}
          />
        </WorkspaceContent>
      </Workspace>
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
    </>
  );
}

/** While the user loads: the page's frame with placeholders where their name and roles go. */
function RolesPagePending() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const tab = ROLE_TABS.find((item) => item.id === search.tab) ?? ROLE_TABS[0];
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ShieldIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('users.roles')}</WorkspaceTitle>
          <WorkspaceDescription>
            <Block className="h-5 w-56 py-0.5" />
          </WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <Block className="h-9 w-36" />
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <RoleTabsSkeleton compact={false} editable search={search} tab={tab} />
      </WorkspaceContent>
    </Workspace>
  );
}

function RolesPageError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (!isNotFound(props.error)) {
    return (
      <RouteLoadError
        {...props}
        description={t('users.roles.error-description')}
        title={t('users.roles.load-error-title')}
      />
    );
  }

  return (
    <Workspace>
      <WorkspaceContent>
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
      </WorkspaceContent>
    </Workspace>
  );
}
