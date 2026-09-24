import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableError, DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { rolesOptions } from '@/features/reference-data/api/queries';
import { ErrorAlert, RetryButton } from '@/features/users/components/dialog-parts';
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
import { type RolesSearch, TAB_RESET } from '@/features/users/lib/roles-search';
import type { RoleAssignment } from '@/features/users/lib/types';
import { useRoleLookups } from '@/features/users/lib/use-role-lookups';
import type { SearchChange } from '@/lib/table-search';

type RoleTabsProps = {
  tab: RoleTab;
  draft: RoleAssignment[];
  saved: RoleAssignment[];
  homeFacilityId: string | null | undefined;
  compact: boolean;
  search: RolesSearch;
  onSearchChange: SearchChange<RolesSearch>;
  onAdd: () => void;
  onRemove: (row: RoleRow) => void;
  onViewRights: (roleId: string) => void;
};

/** One tab per role type, each with its count; only the open tab renders its table. */
export function RoleTabs({ tab, draft, search, onSearchChange, compact, ...props }: RoleTabsProps) {
  const { t } = useTranslation();
  // Counted once the roles are known, since a role's type decides its tab.
  const { data: counts } = useQuery({
    ...rolesOptions(),
    select: (roles) => countByType(draft, new Map(roles.map((role) => [role.id, role]))),
  });

  return (
    <Tabs
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
                <div className="w-full @xl/main:w-72">
                  <DataTableSearch
                    label={t('users.roles.search-label')}
                    onValueChange={(q) => onSearchChange({ q, page: undefined }, true)}
                    placeholder={t('users.roles.search')}
                    value={search.q ?? ''}
                  />
                </div>
                <div className="ms-auto">
                  <Button onClick={props.onAdd}>
                    <PlusIcon data-icon="inline-start" />
                    {t('users.roles.add')}
                  </Button>
                </div>
              </DataTableToolbar>
              <QueryBoundary
                errorComponent={({ reset }) => (
                  <DataTableError
                    description={t('users.roles.error-description')}
                    onRetry={reset}
                    title={t('users.roles.error-title')}
                  />
                )}
                pendingFallback={
                  <RoleAssignmentsTableSkeleton compact={compact} search={search} tab={item} />
                }
                resetKey={item.id}
              >
                <TabTable
                  compact={compact}
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
  );
}

function TabTable({ draft, saved, homeFacilityId, tab, ...props }: RoleTabsProps) {
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
