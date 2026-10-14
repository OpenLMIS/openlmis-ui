import { revalidateLogic, useStore } from '@tanstack/react-form';
import {
  type QueryClient,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import {
  BuildingIcon,
  Loader2Icon,
  NetworkIcon,
  PlusIcon,
  SearchXIcon,
  Trash2Icon,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import {
  ErrorAlert,
  FieldSkeleton,
  LookupBoundary,
  serverMessage,
} from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  facilityOptions,
  minimalFacilitiesOptions,
  processingSchedulesOptions,
  programsOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import {
  createRequisitionGroup,
  updateRequisitionGroup,
} from '@/features/requisition-groups/api/api';
import {
  DEFAULT_MEMBER_SORT,
  memberPage,
  type RequisitionGroupEditorSearch,
} from '@/features/requisition-groups/lib/members';
import {
  addProgramSchema,
  availablePrograms,
  type RequisitionGroupFormValues,
  requisitionGroupFormSchema,
  tabWithFirstError,
  toFormValues,
  toRequisitionGroupBody,
} from '@/features/requisition-groups/lib/requisition-group-form';
import type {
  MemberFacility,
  ProgramSchedule,
  RequisitionGroup,
} from '@/features/requisition-groups/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { useStoredState } from '@/hooks/use-stored-state';
import { queryKeys } from '@/lib/key-factory';
import { getSessionScope } from '@/lib/session-scope';
import { type SearchChange, useTableSearchState } from '@/lib/table-search';

export const REQUISITION_GROUP_LOOKUPS = {
  nodes: supervisoryNodesOptions(),
  programs: programsOptions(),
  schedules: processingSchedulesOptions(),
  facilities: minimalFacilitiesOptions(),
};
export function prefetchRequisitionGroupLookups(queryClient: QueryClient) {
  queryClient.prefetchQuery(REQUISITION_GROUP_LOOKUPS.nodes);
  queryClient.prefetchQuery(REQUISITION_GROUP_LOOKUPS.programs);
  queryClient.prefetchQuery(REQUISITION_GROUP_LOOKUPS.schedules);
  queryClient.prefetchQuery(REQUISITION_GROUP_LOOKUPS.facilities);
}
const FORM_ID = 'requisition-group-form';
function useGroupForm(
  initialValues: RequisitionGroupFormValues,
  onSubmit: (values: RequisitionGroupFormValues) => Promise<unknown>,
  onInvalid: (fields: string[]) => void,
) {
  return useAppForm({
    defaultValues: initialValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: requisitionGroupFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
    onSubmitInvalid: ({ formApi }) =>
      onInvalid(
        Object.entries(formApi.state.fieldMeta)
          .filter(([, meta]) => (meta?.errors.length ?? 0) > 0)
          .map(([name]) => name),
      ),
  });
}
type GroupForm = ReturnType<typeof useGroupForm>;
type EditorProps = {
  saved?: RequisitionGroup;
  id?: string;
  readOnly?: boolean;
  title: string;
  description: string;
  search: RequisitionGroupEditorSearch;
  onSearchChange: SearchChange<RequisitionGroupEditorSearch>;
  onCancel: () => void;
  onSaved?: (saved: RequisitionGroup) => void;
};
export function RequisitionGroupEditor({
  saved,
  id = saved?.id,
  readOnly = false,
  title,
  description,
  search,
  onSearchChange,
  onCancel,
  onSaved,
}: EditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const page = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const [initialValues] = useState(() => toFormValues(saved));
  const mutation = useSessionMutation({
    mutationFn: (values: RequisitionGroupFormValues) => {
      const body = toRequisitionGroupBody(values, saved, id);
      return saved && id ? updateRequisitionGroup(id, body) : createRequisitionGroup(body);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.requisitionGroups.all });
      leaving.current = true;
      onSaved?.(result);
    },
  });
  const form = useGroupForm(
    initialValues,
    async (values) => {
      if (readOnly) return;
      await mutation.mutateAsync(values).catch(() => undefined);
    },
    (fields) => {
      const tab = tabWithFirstError(fields);
      if (tab) onSearchChange({ tab: tab === 'facilities' ? tab : undefined }, true);
      requestAnimationFrame(() =>
        page.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not([hidden])')?.focus(),
      );
    },
  );
  return (
    <>
      <Workspace width="narrow">
        <EditorHeader title={title} description={description} />
        <WorkspaceContent>
          <div className="flex flex-col gap-6" inert={mutation.isPending} ref={page}>
            {mutation.isError && (
              <ErrorAlert
                title={t('requisition-groups.form.save-error-title')}
                description={
                  serverMessage(mutation.error) ?? t('requisition-groups.form.save-error')
                }
              />
            )}
            <form
              id={FORM_ID}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!readOnly) void form.handleSubmit();
              }}
            >
              <GeneralFields form={form} readOnly={readOnly} saved={saved} />
            </form>
            <Tabs
              spacing="page"
              value={search.tab ?? 'programs'}
              onValueChange={(value) =>
                onSearchChange({ tab: value === 'facilities' ? 'facilities' : undefined }, false, {
                  resetScroll: false,
                })
              }
            >
              <EditorTabs />
              <TabsContent keepMounted value="programs">
                <ProgramSchedulesFields form={form} readOnly={readOnly} />
              </TabsContent>
              <TabsContent keepMounted value="facilities">
                <MembersFields
                  form={form}
                  readOnly={readOnly}
                  search={search}
                  onSearchChange={onSearchChange}
                />
              </TabsContent>
            </Tabs>
          </div>
          {!readOnly && (
            <EditorDiscardGuard
              form={form}
              pending={mutation.isPending}
              allowLeave={() => leaving.current}
            />
          )}
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled={mutation.isPending} size="lg" variant="outline" onClick={onCancel}>
          {t('requisition-groups.form.cancel')}
        </Button>
        {!readOnly && (
          <Button disabled={mutation.isPending} form={FORM_ID} size="lg" type="submit">
            {mutation.isPending && (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            )}
            {t('requisition-groups.form.save')}
          </Button>
        )}
      </WorkspaceFooter>
    </>
  );
}
function EditorDiscardGuard({
  form,
  pending,
  allowLeave,
}: {
  form: GroupForm;
  pending: boolean;
  allowLeave: () => boolean;
}) {
  const { t } = useTranslation();
  const changed = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useDiscardGuard(changed, { pending, allowLeave });
  return (
    <DiscardChangesDialog
      description={t('requisition-groups.form.discard-description')}
      {...guard.dialog}
    />
  );
}
function EditorHeader({ title, description }: { title?: string; description: string }) {
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <NetworkIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {title ?? (
            <span aria-hidden="true" className="block h-5 w-64 max-w-full">
              <Skeleton fill />
            </span>
          )}
        </WorkspaceTitle>
        <WorkspaceDescription>{description}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function EditorTabs() {
  const { t } = useTranslation();
  return (
    <TabsList aria-label={t('requisition-groups.form.tabs-label')} wrap="md">
      <TabsTrigger value="programs">{t('requisition-groups.form.programs')}</TabsTrigger>
      <TabsTrigger value="facilities">{t('requisition-groups.form.facilities')}</TabsTrigger>
    </TabsList>
  );
}
function LookupField(props: { label: string; required?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <LookupBoundary
      errorTitle={t('requisition-groups.form.load-error-title')}
      errorDescription={t('requisition-groups.form.load-error-description')}
      {...props}
    />
  );
}
function GeneralFields({
  form,
  readOnly,
  saved,
}: {
  form: GroupForm;
  readOnly: boolean;
  saved?: RequisitionGroup;
}) {
  const { t } = useTranslation();
  const fields = readOnly ? (['code', 'name'] as const) : (['name', 'code'] as const);
  return (
    <FieldGroup>
      <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
        {fields.map((name) => (
          <form.AppField key={name} name={name}>
            {(field) => (
              <field.TextField
                autoComplete="off"
                dir={name === 'code' ? 'ltr' : 'auto'}
                disabled={readOnly}
                label={t(
                  readOnly
                    ? name === 'code'
                      ? 'requisition-groups.form.view-code'
                      : 'requisition-groups.form.view-name'
                    : name === 'code'
                      ? 'requisition-groups.form.code'
                      : 'requisition-groups.form.name',
                )}
                required={!readOnly}
              />
            )}
          </form.AppField>
        ))}
        <LookupField label={t('requisition-groups.form.node')} required={!readOnly}>
          {readOnly ? (
            <NodeControl form={form} readOnly nodes={saved ? [saved.supervisoryNode] : []} />
          ) : (
            <NodeField form={form} saved={saved} />
          )}
        </LookupField>
      </div>
    </FieldGroup>
  );
}
function NodeField({ form, saved }: { form: GroupForm; saved?: RequisitionGroup }) {
  const { data } = useSuspenseQuery(REQUISITION_GROUP_LOOKUPS.nodes);
  const nodes =
    saved && !data.some((node) => node.id === saved.supervisoryNode.id)
      ? [...data, saved.supervisoryNode]
      : data;
  return <NodeControl form={form} readOnly={false} nodes={nodes} />;
}
function NodeControl({
  form,
  readOnly,
  nodes,
}: {
  form: GroupForm;
  readOnly: boolean;
  nodes: RequisitionGroup['supervisoryNode'][];
}) {
  const { t } = useTranslation();
  return (
    <form.AppField name="nodeId">
      {(field) => (
        <field.ComboboxField
          items={nodes.map((node) => ({
            value: node.id,
            label: node.name,
            description: node.code,
          }))}
          label={t('requisition-groups.form.node')}
          placeholder={t('requisition-groups.form.pick-node')}
          clearLabel={t('requisition-groups.form.clear-node')}
          emptyMessage={t('requisition-groups.form.no-options')}
          disabled={readOnly}
          required={!readOnly}
        />
      )}
    </form.AppField>
  );
}
const PROGRAM_COLUMNS = [
  { id: 'directDelivery', labelKey: 'requisition-groups.form.direct-delivery', hideBelow: '3xl' },
  { id: 'dropOffFacility', labelKey: 'requisition-groups.form.drop-off', hideBelow: 'xl' },
] as const;
const MEMBER_COLUMNS = [
  { id: 'type', labelKey: 'requisition-groups.form.type', hideBelow: '3xl' },
  { id: 'enabled', labelKey: 'requisition-groups.form.enabled', hideBelow: '2xl' },
  { id: 'zone', labelKey: 'requisition-groups.form.zone', hideBelow: 'lg' },
] as const;
const visibilitySchema = z.record(z.string(), z.boolean());
const programColumn = createColumnHelper<DataTableFeatures, ProgramSchedule>();
const memberColumn = createColumnHelper<DataTableFeatures, MemberFacility>();
function focusAfterRemove(
  container: HTMLDivElement | null,
  index: number,
  add: HTMLButtonElement | null,
) {
  requestAnimationFrame(() => {
    const buttons = container?.querySelectorAll<HTMLElement>('[data-remove-row]');
    (buttons?.[Math.min(index, buttons.length - 1)] ?? add)?.focus();
  });
}
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <Button
        aria-label={label}
        data-remove-row
        onClick={onClick}
        size="icon-sm"
        variant="destructive"
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
function DropOffName({ id }: { id: string | undefined }) {
  const { data, isPending } = useQuery(REQUISITION_GROUP_LOOKUPS.facilities);
  if (!id) return null;
  if (isPending)
    return (
      <div className="h-4 w-24">
        <Skeleton fill />
      </div>
    );
  return data?.find((facility) => facility.id === id)?.name ?? id;
}
function programColumns(t: TFunction, remove?: (row: ProgramSchedule) => void) {
  return programColumn.columns([
    programColumn.accessor((row) => row.program.name ?? row.program.id, {
      id: 'program',
      header: () => (
        <DataTableHeaderLabel>{t('requisition-groups.form.program')}</DataTableHeaderLabel>
      ),
    }),
    programColumn.accessor(
      (row) =>
        row.processingSchedule.name ?? row.processingSchedule.code ?? row.processingSchedule.id,
      {
        id: 'schedule',
        header: () => (
          <DataTableHeaderLabel>
            {t('requisition-groups.form.schedule-column')}
          </DataTableHeaderLabel>
        ),
      },
    ),
    programColumn.display({
      id: 'dropOffFacility',
      header: () => (
        <DataTableHeaderLabel>{t('requisition-groups.form.drop-off')}</DataTableHeaderLabel>
      ),
      cell: ({ row }) => <DropOffName id={row.original.dropOffFacility?.id} />,
    }),
    programColumn.accessor('directDelivery', {
      header: () => (
        <DataTableHeaderLabel>{t('requisition-groups.form.direct-delivery')}</DataTableHeaderLabel>
      ),
      cell: ({ getValue }) =>
        t(getValue() ? 'requisition-groups.form.yes' : 'requisition-groups.form.no'),
    }),
    ...(remove
      ? [
          programColumn.display({
            id: 'actions',
            header: () => <span className="sr-only">{t('requisition-groups.actions')}</span>,
            meta: { className: 'w-16' },
            cell: ({ row }) => (
              <RemoveButton
                label={t('requisition-groups.form.remove-program', {
                  program: row.original.program.name ?? row.original.program.id,
                })}
                onClick={() => remove(row.original)}
              />
            ),
          }),
        ]
      : []),
  ]);
}
function ProgramSchedulesFields({ form, readOnly }: { form: GroupForm; readOnly: boolean }) {
  const { t } = useTranslation();
  const rows = useStore(form.store, (state) => state.values.schedules);
  const tableRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const view = useColumnVisibility(
    PROGRAM_COLUMNS,
    useStoredState('requisition-group-programs.column-visibility', visibilitySchema, {}),
    width,
  );
  const remove = useCallback(
    (row: ProgramSchedule) => {
      const index = form.state.values.schedules.findIndex(
        (item) => item.program.id === row.program.id,
      );
      if (index < 0) return;
      form.removeFieldValue('schedules', index);
      focusAfterRemove(tableRef.current, index, addRef.current);
    },
    [form],
  );
  const columns = useMemo(
    () => programColumns(t, readOnly ? undefined : remove),
    [t, readOnly, remove],
  );
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: (row) => row.program.id,
    enableSorting: false,
    state: { columnVisibility: view.visibility },
  });
  return (
    <div className="flex flex-col gap-4" ref={measure}>
      <DataTableToolbar>
        <div className="ms-auto">
          <DataTableViewOptions
            columns={PROGRAM_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
            visibility={view.visibility}
            onVisibilityChange={view.onVisibilityChange}
            onReset={view.onReset}
          />
        </div>
        {!readOnly && (
          <Button ref={addRef} variant="outline" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            {t('requisition-groups.form.add-program')}
          </Button>
        )}
      </DataTableToolbar>
      {!readOnly && (
        <AddProgramScheduleDialog
          open={adding}
          rows={rows}
          onClose={() => setAdding(false)}
          onAdd={(row) => form.pushFieldValue('schedules', row)}
        />
      )}
      <div ref={tableRef}>
        <DataTable
          table={table}
          empty={
            <DataTableEmpty
              title={t('requisition-groups.form.no-programs')}
              icon={<NetworkIcon />}
            />
          }
        />
      </div>
    </div>
  );
}
function memberColumns(t: TFunction, remove?: (row: MemberFacility) => void) {
  return memberColumn.columns([
    memberColumn.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.form.facility-name')} />
      ),
    }),
    memberColumn.accessor((row) => row.geographicZone?.name ?? '', {
      id: 'zone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.form.zone')} />
      ),
    }),
    memberColumn.accessor((row) => row.type?.name ?? '', {
      id: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.form.type')} />
      ),
    }),
    memberColumn.accessor('enabled', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.form.enabled')} />
      ),
      cell: ({ getValue }) =>
        t(getValue() ? 'requisition-groups.form.yes' : 'requisition-groups.form.no'),
    }),
    ...(remove
      ? [
          memberColumn.display({
            id: 'actions',
            header: () => <span className="sr-only">{t('requisition-groups.actions')}</span>,
            meta: { className: 'w-16' },
            cell: ({ row }) => (
              <RemoveButton
                label={t('requisition-groups.form.remove-facility', {
                  facility: row.original.name,
                })}
                onClick={() => remove(row.original)}
              />
            ),
          }),
        ]
      : []),
  ]);
}
function MembersFields({
  form,
  readOnly,
  search,
  onSearchChange,
}: {
  form: GroupForm;
  readOnly: boolean;
  search: RequisitionGroupEditorSearch;
  onSearchChange: SearchChange<RequisitionGroupEditorSearch>;
}) {
  const { t } = useTranslation();
  const rows = useStore(form.store, (state) => state.values.members);
  const tableRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const view = useColumnVisibility(
    MEMBER_COLUMNS,
    useStoredState('requisition-group-members.column-visibility', visibilitySchema, {}),
    width,
  );
  const page = useMemo(() => memberPage(rows, search), [rows, search]);
  const remove = useCallback(
    (row: MemberFacility) => {
      const index = form.state.values.members.findIndex((item) => item.id === row.id);
      const visible = page.data.findIndex((item) => item.id === row.id);
      if (index < 0) return;
      form.removeFieldValue('members', index);
      focusAfterRemove(tableRef.current, visible, addRef.current);
    },
    [form, page.data],
  );
  const columns = useMemo(
    () => memberColumns(t, readOnly ? undefined : remove),
    [t, readOnly, remove],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_MEMBER_SORT,
    onSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: page.data,
    getRowId: (row) => row.id,
    rowCount: page.total,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
    state: {
      ...searchState.state,
      pagination: { ...searchState.state.pagination, pageIndex: page.page - 1 },
      columnVisibility: view.visibility,
    },
  });
  useEffect(() => {
    if ((search.page ?? 1) !== page.page)
      onSearchChange({ page: page.page > 1 ? page.page : undefined }, true, { resetScroll: false });
  }, [page.page, search.page, onSearchChange]);
  return (
    <div className="flex flex-col gap-4" ref={measure}>
      <DataTableToolbar>
        <div className="w-full @2xl/main:w-72">
          <DataTableSearch
            value={search.q ?? ''}
            placeholder={t('requisition-groups.form.member-search')}
            onValueChange={(q) =>
              onSearchChange({ q: q || undefined, page: undefined }, true, { resetScroll: false })
            }
          />
        </div>
        <div className="ms-auto">
          <DataTableViewOptions
            columns={MEMBER_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
            visibility={view.visibility}
            onVisibilityChange={view.onVisibilityChange}
            onReset={view.onReset}
          />
        </div>
        {!readOnly && (
          <Button ref={addRef} variant="outline" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            {t('requisition-groups.form.add-facility')}
          </Button>
        )}
      </DataTableToolbar>
      {!readOnly && (
        <AddFacilityDialog
          open={adding}
          rows={rows}
          onClose={() => setAdding(false)}
          onAdd={(row) => form.pushFieldValue('members', row)}
        />
      )}
      <div ref={tableRef}>
        <DataTable
          table={table}
          empty={
            search.q ? (
              <DataTableEmpty
                title={t('requisition-groups.form.no-matches')}
                description={t('requisition-groups.form.no-matches-description')}
                icon={<SearchXIcon />}
                action={
                  <Button
                    variant="destructive"
                    onClick={() => onSearchChange({ q: undefined, page: undefined }, true)}
                  >
                    {t('requisition-groups.form.clear-filter')}
                  </Button>
                }
              />
            ) : (
              <DataTableEmpty
                title={t('requisition-groups.form.no-facilities')}
                icon={<BuildingIcon />}
              />
            )
          }
          footer={page.total > 0 && <DataTablePagination table={table} />}
        />
      </div>
    </div>
  );
}

type AddProgramProps = {
  open: boolean;
  rows: ProgramSchedule[];
  onClose: () => void;
  onAdd: (row: ProgramSchedule) => void;
};
function AddProgramScheduleDialog({ open, rows, onClose, onAdd }: AddProgramProps) {
  const { shown, close, dialogProps } = useDialogTarget(open ? 'new' : undefined, onClose);
  return (
    <FormDialog {...dialogProps()}>
      {shown && (
        <AddProgramForm
          rows={rows}
          onAdd={(row) => {
            if (close()) onAdd(row);
          }}
        />
      )}
    </FormDialog>
  );
}
function useProgramForm(
  rows: ProgramSchedule[],
  onAdd: (row: ProgramSchedule) => void,
  queryClient: QueryClient,
) {
  return useAppForm({
    defaultValues: {
      programId: null as string | null,
      scheduleId: null as string | null,
      dropOffId: null as string | null,
      directDelivery: false,
    },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: addProgramSchema(rows) },
    onSubmit: ({ value }) => {
      const program = queryClient
        .getQueryData(REQUISITION_GROUP_LOOKUPS.programs.queryKey)
        ?.find((item) => item.id === value.programId);
      const schedule = queryClient
        .getQueryData(REQUISITION_GROUP_LOOKUPS.schedules.queryKey)
        ?.find((item) => item.id === value.scheduleId);
      if (!program || !schedule) return;
      onAdd({
        program: { id: program.id, name: programName(program) },
        processingSchedule: schedule,
        directDelivery: value.directDelivery,
        ...(value.dropOffId && { dropOffFacility: { id: value.dropOffId } }),
      });
    },
  });
}
type ProgramForm = ReturnType<typeof useProgramForm>;
function AddProgramForm({ rows, onAdd }: Pick<AddProgramProps, 'rows' | 'onAdd'>) {
  const { t } = useTranslation();
  const form = useProgramForm(rows, onAdd, useQueryClient());
  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('requisition-groups.form.add-program')}</FormDialogTitle>
        <FormDialogDescription>
          {t('requisition-groups.form.add-program-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <LookupField label={t('requisition-groups.form.program')} required>
            <ProgramPicker form={form} rows={rows} />
          </LookupField>
          <LookupField label={t('requisition-groups.form.schedule')} required>
            <SchedulePicker form={form} />
          </LookupField>
          <LookupField label={t('requisition-groups.form.drop-off')}>
            <DropOffPicker form={form} />
          </LookupField>
          <form.AppField name="directDelivery">
            {(field) => <field.SwitchField label={t('requisition-groups.form.direct-delivery')} />}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('requisition-groups.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit>{t('requisition-groups.form.add')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
function ProgramPicker({ form, rows }: { form: ProgramForm; rows: ProgramSchedule[] }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(REQUISITION_GROUP_LOOKUPS.programs);
  return (
    <form.AppField name="programId">
      {(field) => (
        <field.ComboboxField
          required
          label={t('requisition-groups.form.program')}
          placeholder={t('requisition-groups.form.pick-program')}
          clearLabel={t('requisition-groups.form.clear-program')}
          emptyMessage={t('requisition-groups.form.no-options')}
          items={availablePrograms(data, rows).map((program) => ({
            value: program.id,
            label: programName(program),
          }))}
        />
      )}
    </form.AppField>
  );
}
function SchedulePicker({ form }: { form: ProgramForm }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(REQUISITION_GROUP_LOOKUPS.schedules);
  return (
    <form.AppField name="scheduleId">
      {(field) => (
        <field.ComboboxField
          required
          label={t('requisition-groups.form.schedule')}
          placeholder={t('requisition-groups.form.pick-schedule')}
          clearLabel={t('requisition-groups.form.clear-schedule')}
          emptyMessage={t('requisition-groups.form.no-options')}
          items={data.map((schedule) => ({
            value: schedule.id,
            label: schedule.name,
            description: schedule.code,
          }))}
        />
      )}
    </form.AppField>
  );
}
function DropOffPicker({ form }: { form: ProgramForm }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(REQUISITION_GROUP_LOOKUPS.facilities);
  return (
    <form.AppField name="dropOffId">
      {(field) => (
        <field.ComboboxField
          label={t('requisition-groups.form.drop-off')}
          placeholder={t('requisition-groups.form.pick-facility')}
          clearLabel={t('requisition-groups.form.clear-facility')}
          emptyMessage={t('requisition-groups.form.no-options')}
          items={data.map((facility) => ({
            value: facility.id,
            label: facility.name,
            description: facility.code,
          }))}
        />
      )}
    </form.AppField>
  );
}
type AddFacilityProps = {
  open: boolean;
  rows: MemberFacility[];
  onClose: () => void;
  onAdd: (row: MemberFacility) => void;
};
function AddFacilityDialog({ open, rows, onClose, onAdd }: AddFacilityProps) {
  const { shown, close, dialogProps } = useDialogTarget(open ? 'new' : undefined, onClose);
  const [pending, setPending] = useState(false);
  return (
    <FormDialog {...dialogProps(pending)} closeButton={!pending}>
      {shown && (
        <AddFacilityForm
          rows={rows}
          onPending={setPending}
          onAdd={(row) => {
            if (close()) onAdd(row);
          }}
        />
      )}
    </FormDialog>
  );
}
const addFacilitySchema = z.object({
  facilityId: z.string().nullable().refine(Boolean, 'requisition-groups.form.facility-required'),
});
function useFacilityForm(
  onAdd: (row: MemberFacility) => void,
  onPending: (pending: boolean) => void,
  queryClient: QueryClient,
  onError: (error: unknown) => void,
) {
  const [scope] = useState(getSessionScope);
  const isCurrent = () => scope === getSessionScope();
  return useAppForm({
    defaultValues: { facilityId: null as string | null },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: addFacilitySchema },
    onSubmit: async ({ value }) => {
      if (!value.facilityId || !isCurrent()) return;
      onError(undefined);
      onPending(true);
      try {
        const facility = await queryClient.fetchQuery(facilityOptions(value.facilityId));
        if (!isCurrent()) return;
        onAdd({
          ...facility,
          name: facility.name ?? facility.code,
          type: { ...facility.type, name: facility.type.name ?? undefined },
        });
      } catch (error) {
        if (isCurrent()) onError(error);
      } finally {
        if (isCurrent()) onPending(false);
      }
    },
  });
}
type FacilityForm = ReturnType<typeof useFacilityForm>;
function AddFacilityForm({
  rows,
  onAdd,
  onPending,
}: Pick<AddFacilityProps, 'rows' | 'onAdd'> & { onPending: (pending: boolean) => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<unknown>();
  const form = useFacilityForm(onAdd, onPending, useQueryClient(), setError);
  const busy = useStore(form.store, (state) => state.isSubmitting);
  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('requisition-groups.form.add-facility')}</FormDialogTitle>
        <FormDialogDescription>
          {t('requisition-groups.form.add-facility-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        {error !== undefined && (
          <ErrorAlert
            title={t('requisition-groups.form.facility-error-title')}
            description={serverMessage(error) ?? t('requisition-groups.form.facility-error')}
          />
        )}
        <FieldGroup>
          <LookupField label={t('requisition-groups.form.facility')} required>
            <FacilityPicker form={form} rows={rows} disabled={busy} />
          </LookupField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={busy}>{t('requisition-groups.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={busy}>{t('requisition-groups.form.add')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
function FacilityPicker({
  form,
  rows,
  disabled,
}: {
  form: FacilityForm;
  rows: MemberFacility[];
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(REQUISITION_GROUP_LOOKUPS.facilities);
  const ids = new Set(rows.map((row) => row.id));
  return (
    <form.AppField name="facilityId">
      {(field) => (
        <field.ComboboxField
          disabled={disabled}
          required
          label={t('requisition-groups.form.facility')}
          placeholder={t('requisition-groups.form.pick-facility')}
          clearLabel={t('requisition-groups.form.clear-facility')}
          emptyMessage={t('requisition-groups.form.no-options')}
          items={data
            .filter((facility) => !ids.has(facility.id))
            .map((facility) => ({
              value: facility.id,
              label: facility.name,
              description: facility.code,
            }))}
        />
      )}
    </form.AppField>
  );
}
export function RequisitionGroupEditorSkeleton({
  title,
  description,
  readOnly = false,
}: {
  title?: string;
  description: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const view = useColumnVisibility(
    PROGRAM_COLUMNS,
    useStoredState('requisition-group-programs.column-visibility', visibilitySchema, {}),
    width,
  );
  const columns = useMemo(() => programColumns(t, readOnly ? undefined : () => {}), [t, readOnly]);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: [],
    enableSorting: false,
    state: { columnVisibility: view.visibility },
  });
  return (
    <>
      <Workspace width="narrow">
        <EditorHeader title={title} description={description} />
        <WorkspaceContent>
          <div className="flex flex-col gap-6">
            <FieldGroup>
              <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
                <FieldSkeleton
                  label={t(
                    readOnly ? 'requisition-groups.form.view-code' : 'requisition-groups.form.name',
                  )}
                  required={!readOnly}
                />
                <FieldSkeleton
                  label={t(
                    readOnly ? 'requisition-groups.form.view-name' : 'requisition-groups.form.code',
                  )}
                  required={!readOnly}
                />
                <FieldSkeleton label={t('requisition-groups.form.node')} required={!readOnly} />
              </div>
            </FieldGroup>
            <Tabs spacing="page" value="programs">
              <EditorTabs />
              <TabsContent value="programs">
                <div className="flex flex-col gap-4" ref={measure}>
                  <DataTableToolbar>
                    <div className="ms-auto">
                      <DataTableViewOptions
                        columns={PROGRAM_COLUMNS.map(({ id, labelKey }) => ({
                          id,
                          label: t(labelKey),
                        }))}
                        disabled
                        visibility={view.visibility}
                        onVisibilityChange={() => {}}
                        onReset={() => {}}
                      />
                    </div>
                    {!readOnly && (
                      <Button disabled variant="outline">
                        <PlusIcon data-icon="inline-start" />
                        {t('requisition-groups.form.add-program')}
                      </Button>
                    )}
                  </DataTableToolbar>
                  <DataTableSkeleton table={table} rowCount={3} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled size="lg" variant="outline">
          {t('requisition-groups.form.cancel')}
        </Button>
        {!readOnly && (
          <Button disabled size="lg">
            {t('requisition-groups.form.save')}
          </Button>
        )}
      </WorkspaceFooter>
    </>
  );
}
