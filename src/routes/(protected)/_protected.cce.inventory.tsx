import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ClipboardListIcon, RefrigeratorIcon, ShieldAlertIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ListError } from '@/components/app-shell/list-error';
import { LoadError } from '@/components/app-shell/load-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableCard, DataTableEmpty } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import {
  FacilityProgramSelector,
  FacilityProgramSelectorSkeleton,
} from '@/components/pickers/facility-program-selector/facility-program-selector';
import {
  prefetchFacilityProgramOptions,
  useFacilityProgramOptions,
} from '@/components/pickers/facility-program-selector/use-facility-program-options';
import { Skeleton } from '@/components/ui/skeleton';
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
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { exportInventoryItems } from '@/features/cce-inventory/api/api';
import { catalogItemsOptions, inventoryItemsOptions } from '@/features/cce-inventory/api/queries';
import {
  InventoryItemDialog,
  type SavedInventoryItem,
} from '@/features/cce-inventory/components/inventory-item-dialog';
import { InventoryItemView } from '@/features/cce-inventory/components/inventory-item-view';
import {
  INVENTORY_HIDEABLE_COLUMNS,
  INVENTORY_SORT_COLUMNS,
  InventoryResults,
  InventoryResultsSkeleton,
} from '@/features/cce-inventory/components/inventory-results';
import { InventoryToolbar } from '@/features/cce-inventory/components/inventory-toolbar';
import { editableGrants } from '@/features/cce-inventory/lib/grants';
import {
  CLOSED_INVENTORY_DIALOGS,
  INVENTORY_SORT,
  type InventorySearch,
  inventorySavedSearch,
  inventorySearchSchema,
  legacyInventoryHash,
  toInventoryQuery,
} from '@/features/cce-inventory/lib/search';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { legacyAvailable, openLegacy } from '@/hooks/use-back-to-legacy';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { downloadFile } from '@/lib/download-file';
import {
  type CompleteSelection,
  type FacilityProgramOptions,
  type FacilityProgramSelection,
  isCompleteSelection,
  type NamedRecord,
  recordLabel,
  sameSelection,
  validSelection,
} from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import {
  hasProgramGrant,
  type Permissions,
  type ProgramGrant,
  programGrants,
} from '@/lib/permissions';
import { type SearchChange, searchSort } from '@/lib/table-search';

const RIGHT = RIGHTS.cceInventoryView;
const EXPORT_FILENAME = 'inventory_items.csv';
const noop = () => {};

export const Route = createFileRoute('/(protected)/_protected/cce/inventory')({
  validateSearch: inventorySearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const permissions = await requirePermissions(queryClient, RIGHT);
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) return;
    if ((search.item === 'new' || search.edit) && editableGrants(permissions).length === 0) {
      throw redirect({
        to: '/cce/inventory',
        search: {
          ...search,
          item: search.item === 'new' ? undefined : search.item,
          edit: undefined,
        },
        replace: true,
      });
    }
    prefetchFacilityProgramOptions(queryClient, userId);
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    if (search.item === 'new') queryClient.prefetchQuery(catalogItemsOptions());
    const selection = {
      mode: search.mode,
      programId: search.programId,
      facilityId: search.facilityId,
    };
    if (
      isCompleteSelection(selection) &&
      hasProgramGrant(permissions, RIGHT, selection.facilityId, selection.programId)
    ) {
      queryClient.prefetchQuery(inventoryItemsOptions(toInventoryQuery(search, selection)));
    }
  },
  pendingComponent: InventoryPending,
  component: InventoryPage,
});

function InventoryHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <RefrigeratorIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('cce-inventory.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('cce-inventory.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

type ColumnView = ReturnType<typeof useCardView>['columnView'] & {
  cards: boolean;
  layout: 'cards' | 'table';
};

function useColumnView() {
  const { measure, cards, columnView, layout } = useCardView(
    INVENTORY_HIDEABLE_COLUMNS,
    'cce-inventory.column-visibility',
  );
  return { measure, columnView: { ...columnView, cards, layout } };
}

function ColumnsMenu({
  columnView,
  search,
  onSearchChange,
}: {
  columnView: ColumnView;
  search: InventorySearch;
  onSearchChange: SearchChange<InventorySearch>;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <DataTableViewOptions
        size="lg"
        layout={columnView.layout}
        columns={INVENTORY_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
        onReset={columnView.onReset}
        onVisibilityChange={columnView.onVisibilityChange}
        visibility={columnView.visibility}
        sort={{
          ...searchSort(search, INVENTORY_SORT, onSearchChange),
          columns: INVENTORY_SORT_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
        }}
      />
    </div>
  );
}

function InventoryListSkeleton({
  search,
  columnView,
}: {
  search: InventorySearch;
  columnView: ColumnView;
}) {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <div className="flex h-6 items-center">
        <div className="h-4 w-72 max-w-full">
          <Skeleton fill />
        </div>
      </div>
      <fieldset className="min-w-0" disabled>
        <InventoryToolbar
          disabled
          onFilterChange={noop}
          search={search}
          view={<ColumnsMenu columnView={columnView} onSearchChange={noop} search={search} />}
        />
      </fieldset>
      <InventoryResultsSkeleton
        cards={columnView.cards}
        columns={columnView.visibility}
        search={search}
      />
    </div>
  );
}

function InventoryPageSkeleton({
  search,
  columnView,
}: {
  search: InventorySearch;
  columnView: ColumnView;
}) {
  return (
    <>
      <FacilityProgramSelectorSkeleton />
      {isCompleteSelection(search) && (
        <InventoryListSkeleton columnView={columnView} search={search} />
      )}
    </>
  );
}

function InventoryPending() {
  const search = Route.useSearch();
  const { measure, columnView } = useColumnView();
  return (
    <Workspace>
      <InventoryHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <InventoryPageSkeleton columnView={columnView} search={search} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function InventoryPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? <InventoryContent userId={userId} /> : null;
}

function InventoryContent({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { updateSearch, closeDialog } =
    useSearchNavigation<InventorySearch>(CLOSED_INVENTORY_DIALOGS);
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const grants = useMemo(() => programGrants(permissions, RIGHT), [permissions]);
  const editable = useMemo(() => editableGrants(permissions), [permissions]);
  const { measure: measureContent, columnView } = useColumnView();
  const onSaved = ({ selection, status, name }: SavedInventoryItem) => {
    toast.success(t('cce-inventory.form.saved-title'), {
      description: t('cce-inventory.form.saved', { name }),
    });
    void navigate({ search: inventorySavedSearch(search, selection, status), replace: true });
  };

  return (
    <Workspace>
      <InventoryHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <LoadError
                description={t('facility-program.load-error-description')}
                error={error}
                reset={reset}
                title={t('facility-program.load-error-title')}
              />
            )}
            pendingFallback={<InventoryPageSkeleton columnView={columnView} search={search} />}
            resetKey={userId}
          >
            <InventoryBody
              columnView={columnView}
              grants={grants}
              onSearchChange={updateSearch}
              permissions={permissions}
              search={search}
              userId={userId}
            />
          </QueryBoundary>
        </div>
        <InventoryItemDialog
          grants={editable}
          initial={search}
          onClose={closeDialog}
          onSaved={onSaved}
          open={search.item === 'new'}
          userId={userId}
        />
        <InventoryItemView
          editing={search.edit === true}
          grants={editable}
          itemId={search.item === 'new' ? undefined : search.item}
          onClose={closeDialog}
          onEditing={(edit) => updateSearch({ edit: edit || undefined }, true, { keepState: true })}
          onStatusUpdate={
            legacyAvailable()
              ? (item) =>
                  openLegacy(
                    legacyInventoryHash(`${item.id}/statusUpdate`, search, {
                      mode: search.mode ?? 'supervised',
                      facilityId: item.facility.id,
                      programId: item.program.id,
                    }),
                  )
              : undefined
          }
        />
      </WorkspaceContent>
    </Workspace>
  );
}

type InventoryBodyProps = {
  userId: string;
  grants: readonly ProgramGrant[];
  permissions: Permissions;
  search: InventorySearch;
  columnView: ColumnView;
  onSearchChange: SearchChange<InventorySearch>;
};

function InventoryBody({
  userId,
  grants,
  permissions,
  search,
  columnView,
  onSearchChange,
}: InventoryBodyProps) {
  const queryClient = useQueryClient();
  const options = useFacilityProgramOptions(userId, grants);
  const applied = useMemo(
    () => ({ mode: search.mode, programId: search.programId, facilityId: search.facilityId }),
    [search.mode, search.programId, search.facilityId],
  );
  const valid = validSelection(applied, options);

  const onSearch = useCallback(
    (selection: CompleteSelection) => {
      if (sameSelection(selection, valid ?? applied)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.all });
      }
      onSearchChange({ ...selection, page: undefined });
    },
    [applied, valid, onSearchChange, queryClient],
  );

  return (
    <>
      <FacilityProgramSelector
        applied={applied}
        onDraftChange={noop}
        onSearch={onSearch}
        options={options}
      />
      <InventoryOutcome
        applied={applied}
        columnView={columnView}
        onSearchChange={onSearchChange}
        options={options}
        permissions={permissions}
        search={search}
        valid={valid}
      />
    </>
  );
}

type InventoryOutcomeProps = Omit<InventoryBodyProps, 'grants' | 'userId'> & {
  options: FacilityProgramOptions;
  applied: FacilityProgramSelection;
  valid: CompleteSelection | null;
};

function InventoryOutcome({
  search,
  columnView,
  onSearchChange,
  options,
  applied,
  valid,
  permissions,
}: InventoryOutcomeProps) {
  const { t } = useTranslation();
  if (!valid) {
    const refused = isCompleteSelection(applied);
    return (
      <div className="flex flex-col gap-4">
        <InventoryToolbar onFilterChange={(patch) => onSearchChange(patch, true)} search={search} />
        <DataTableCard>
          <DataTableEmpty
            description={t(
              refused ? 'cce-inventory.refused-description' : 'cce-inventory.pick-description',
            )}
            icon={refused ? <ShieldAlertIcon /> : <ClipboardListIcon />}
            title={t(refused ? 'cce-inventory.refused-title' : 'cce-inventory.pick-title')}
          />
        </DataTableCard>
      </div>
    );
  }
  return (
    <InventoryList
      canEdit={hasProgramGrant(
        permissions,
        RIGHTS.cceInventoryEdit,
        valid.facilityId,
        valid.programId,
      )}
      columnView={columnView}
      facility={options
        .facilitiesFor(valid.programId)
        .find((facility) => facility.id === valid.facilityId)}
      onSearchChange={onSearchChange}
      program={(valid.mode === 'my' ? options.myPrograms : options.supervisedPrograms).find(
        (program) => program.id === valid.programId,
      )}
      search={search}
      selection={valid}
    />
  );
}

const label = (record: NamedRecord | undefined) => (record ? recordLabel(record) : '');

type InventoryListProps = {
  search: InventorySearch;
  selection: CompleteSelection;
  facility: NamedRecord | undefined;
  program: NamedRecord | undefined;
  canEdit: boolean;
  columnView: ColumnView;
  onSearchChange: SearchChange<InventorySearch>;
};

function InventoryList({
  search,
  selection,
  facility,
  program,
  canEdit,
  columnView,
  onSearchChange,
}: InventoryListProps) {
  const { t } = useTranslation();
  const { openDialog } = useSearchNavigation<InventorySearch>(CLOSED_INVENTORY_DIALOGS);
  const query = toInventoryQuery(search, selection);
  const exporting = useSessionMutation({
    mutationFn: () => exportInventoryItems(selection.facilityId, selection.programId),
    onSuccess: (blob) => downloadFile(blob, EXPORT_FILENAME),
    onError: () =>
      toast.error(t('cce-inventory.export-error-title'), {
        description: t('cce-inventory.export-error'),
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-base">
        {t('cce-inventory.applied', { facility: label(facility), program: label(program) })}
      </h2>
      <InventoryToolbar
        exporting={exporting.isPending}
        onAdd={canEdit ? () => openDialog({ item: 'new' }) : undefined}
        onExport={() => exporting.mutate()}
        onFilterChange={(patch) => onSearchChange(patch, true)}
        search={search}
        view={
          <ColumnsMenu columnView={columnView} onSearchChange={onSearchChange} search={search} />
        }
      />
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <ListError
            description={t('cce-inventory.load-error')}
            error={error}
            reset={reset}
            title={t('cce-inventory.load-error-title')}
          />
        )}
        pendingFallback={
          <InventoryResultsSkeleton
            cards={columnView.cards}
            columns={columnView.visibility}
            search={search}
          />
        }
        resetKey={JSON.stringify(query)}
      >
        <InventoryResults
          key={`${selection.facilityId}:${selection.programId}`}
          canEdit={canEdit}
          cards={columnView.cards}
          columns={columnView.visibility}
          facilityName={label(facility)}
          onSearchChange={onSearchChange}
          search={search}
          selection={selection}
        />
      </QueryBoundary>
    </div>
  );
}
