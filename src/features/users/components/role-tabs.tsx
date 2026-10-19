import { useQuery } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { PlusIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { ErrorAlert, RetryButton } from '@/components/dialog-parts';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Block } from '@/components/skeleton-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { rolesOptions } from '@/features/reference-data/api/queries';
import {
  RoleAssignmentsTable,
  RoleAssignmentsTableSkeleton,
} from '@/features/users/components/role-assignments-table';
import {
  assignmentKey,
  countByType,
  ROLE_TABS,
  type RoleRow,
  type RoleTab,
  toRoleRows,
} from '@/features/users/lib/role-assignments';
import {
  DEFAULT_ROLES_SORT,
  type RolesTableSearch,
  TAB_RESET,
} from '@/features/users/lib/roles-search';
import { useRoleLookups } from '@/features/users/lib/use-role-lookups';
import { useCardLayout } from '@/hooks/use-card-view';
import { type SearchChange, searchSort } from '@/lib/table-search';
import type { RoleAssignment } from '@/lib/user-types';
import { cn } from '@/lib/utils';

type RoleTabsProps = {
  tab: RoleTab;
  draft: RoleAssignment[];
  saved: RoleAssignment[];
  homeFacilityId: string | null | undefined;
  search: RolesTableSearch;
  onSearchChange: SearchChange<RolesTableSearch>;
  /** Both left out where the roles are only shown, e.g. on the user's own profile. */
  onAdd?: () => void;
  onRemove?: (row: RoleRow) => void;
};

const SORT_COLUMNS: Record<RoleTab['type'], readonly { id: string; labelKey: ParseKeys }[]> = {
  SUPERVISION: [
    { id: 'program', labelKey: 'users.roles.column.program' },
    { id: 'node', labelKey: 'users.roles.column.node' },
    { id: 'role', labelKey: 'users.roles.column.role' },
  ],
  ORDER_FULFILLMENT: [
    { id: 'facility', labelKey: 'users.roles.column.facility' },
    { id: 'role', labelKey: 'users.roles.column.role' },
  ],
  REPORTS: [{ id: 'role', labelKey: 'users.roles.column.role' }],
  GENERAL_ADMIN: [{ id: 'role', labelKey: 'users.roles.column.role' }],
};

const noop = () => {};

const SEARCH_WIDTH = 'min-w-0 flex-1 @xl/main:w-72 @xl/main:flex-none';

export function RoleTabs({ tab, draft, search, onSearchChange, ...props }: RoleTabsProps) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  // Counted once the roles are known, since a role's type decides its tab.
  const { data: counts } = useQuery({
    ...rolesOptions(),
    select: (roles) => countByType(draft, new Map(roles.map((role) => [role.id, role]))),
  });

  return (
    <div ref={measure}>
      <Tabs
        spacing="page"
        onValueChange={(value: RoleTab['id']) =>
          onSearchChange({ ...TAB_RESET, tab: value === 'supervision' ? undefined : value })
        }
        value={tab.id}
      >
        {/* A size container, so the tabs go two by two when four do not fit in a row. */}
        <div className="@container">
          <TabsList aria-label={t('users.roles.tabs-label')} wrap>
            {ROLE_TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {t(item.labelKey)}
                {counts && <Badge variant="secondary">{counts[item.type]}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {ROLE_TABS.map((item) => (
          <TabsContent key={item.id} value={item.id}>
            {item.id === tab.id && (
              <div className="flex flex-col gap-4">
                <DataTableToolbar>
                  <div className={cards ? 'w-full' : SEARCH_WIDTH}>
                    <DataTableSearch
                      label={t('users.roles.search-label')}
                      onValueChange={(q) => onSearchChange({ q, page: undefined }, true)}
                      placeholder={t('users.roles.search')}
                      value={search.q ?? ''}
                    />
                  </div>
                  {cards && (
                    <div className="ms-auto">
                      <DataTableViewOptions
                        columns={[]}
                        layout="cards"
                        onVisibilityChange={noop}
                        sort={{
                          columns: SORT_COLUMNS[item.type].map(({ id, labelKey }) => ({
                            id,
                            label: t(labelKey),
                          })),
                          ...searchSort<RolesTableSearch>(search, DEFAULT_ROLES_SORT, (patch) =>
                            onSearchChange(patch),
                          ),
                        }}
                        visibility={{}}
                      />
                    </div>
                  )}
                  {props.onAdd && (
                    <div className={cards ? undefined : 'ms-auto'}>
                      <Button onClick={props.onAdd}>
                        <PlusIcon data-icon="inline-start" />
                        {t('users.roles.add')}
                      </Button>
                    </div>
                  )}
                </DataTableToolbar>
                <QueryBoundary
                  errorComponent={({ error, reset }) => (
                    <LoadError
                      description={t('users.roles.error-description')}
                      error={error}
                      reset={reset}
                      title={t('users.roles.error-title')}
                    />
                  )}
                  pendingFallback={
                    <RoleAssignmentsTableSkeleton
                      cards={cards}
                      onRemove={props.onRemove}
                      search={search}
                      tab={item}
                    />
                  }
                  resetKey={item.id}
                >
                  <TabTable
                    cards={cards}
                    draft={draft}
                    onSearchChange={onSearchChange}
                    search={search}
                    tab={item}
                    {...props}
                  />
                </QueryBoundary>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

type RoleTabsSkeletonProps = Pick<RoleTabsProps, 'tab' | 'search'> & {
  /** Holds the places of Add Role and each row's actions, where the roles can be changed. */
  editable?: boolean;
};

/** The tabs while the user loads: the real tab list, with placeholders for the toolbar and rows. */
export function RoleTabsSkeleton({ tab, search, editable = false }: RoleTabsSkeletonProps) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div aria-busy ref={measure}>
      <Tabs spacing="page" value={tab.id}>
        <div className="@container">
          <TabsList aria-label={t('users.roles.tabs-label')} wrap>
            {ROLE_TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {t(item.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={tab.id}>
          <div className="flex flex-col gap-4">
            <DataTableToolbar>
              <div className={cards ? 'w-full' : SEARCH_WIDTH}>
                <Block className="h-8 w-full @max-2xl/main:h-9" />
              </div>
              {cards && <Block className="ms-auto h-9 w-20" />}
              {editable && (
                <Block className={cn('h-8 w-28 @max-2xl/main:h-9', !cards && 'ms-auto')} />
              )}
            </DataTableToolbar>
            <RoleAssignmentsTableSkeleton
              cards={cards}
              onRemove={editable ? noop : undefined}
              search={search}
              tab={tab}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabTable({
  draft,
  saved,
  homeFacilityId,
  tab,
  ...props
}: RoleTabsProps & { cards: boolean }) {
  const { t } = useTranslation();
  const { lookups, status, retry } = useRoleLookups();
  const savedKeys = useMemo(() => new Set(saved.map(assignmentKey)), [saved]);
  const rows = useMemo(
    () => toRoleRows(draft, tab.type, { lookups, savedKeys, homeFacilityId }),
    [draft, tab.type, lookups, savedKeys, homeFacilityId],
  );
  const failed = status.nodes === 'failed' || status.facilities === 'failed';

  return (
    <>
      {failed && (
        <ErrorAlert
          action={<RetryButton onClick={retry} />}
          description={t('users.roles.names-error-description')}
          title={t('users.roles.names-error-title')}
        />
      )}
      <RoleAssignmentsTable rows={rows} status={status} tab={tab} {...props} />
    </>
  );
}
