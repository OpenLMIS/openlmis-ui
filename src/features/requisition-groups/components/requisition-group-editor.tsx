import { revalidateLogic, useStore } from '@tanstack/react-form';
import {
  type QueryClient,
  useIsMutating,
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
import { type ReactNode, type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CardActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  type DataTableInstance,
  DataTableSkeleton,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import {
  ErrorAlert,
  FieldSkeleton,
  LookupBoundary,
  serverMessage,
} from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { FlagBadge } from '@/components/flag-badge';
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
import { Block } from '@/components/skeleton-block';
import { TableCards, TableCardsSkeleton, useInCards } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
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
import { useCardView } from '@/hooks/use-card-view';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { usePageStart } from '@/hooks/use-page-start';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { tableValue } from '@/lib/empty-value';
import { queryKeys } from '@/lib/key-factory';
import { type SearchChange, searchSort, useTableSearchState } from '@/lib/table-search';

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
      const body = toRequisitionGroupBody(values, saved);
      return saved ? updateRequisitionGroup(saved.id, body) : createRequisitionGroup(body);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.requisitionGroups.list().slice(0, 2),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.requisitionGroups.detail(result.id),
        exact: true,
      });
      leaving.current = true;
      onSaved?.(result);
    },
  });
  const form = useGroupForm(
    initialValues,
    async (values) => {
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
        <WorkspaceTitle>{title ?? <Block className="h-5 w-64 max-w-full" />}</WorkspaceTitle>
        <WorkspaceDescription>{description}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function EditorTabs() {
  const { t } = useTranslation();
  return (
    <TabsList aria-label={t('requisition-groups.form.tabs-label')}>
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
const GENERAL_FIELDS = {
  edit: [
    { name: 'name', labelKey: 'requisition-groups.form.name' },
    { name: 'code', labelKey: 'requisition-groups.form.code' },
    { name: 'nodeId', labelKey: 'requisition-groups.form.node' },
  ],
  view: [
    { name: 'code', labelKey: 'requisition-groups.form.view-code' },
    { name: 'name', labelKey: 'requisition-groups.form.view-name' },
    { name: 'nodeId', labelKey: 'requisition-groups.form.node' },
  ],
} as const;
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
  const fields = GENERAL_FIELDS[readOnly ? 'view' : 'edit'];
  const savedNodes = useMemo(() => (saved ? [saved.supervisoryNode] : []), [saved]);
  return (
    <FieldGroup>
      <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
        {fields.map(({ name, labelKey }) =>
          name === 'nodeId' ? (
            <LookupField key={name} label={t(labelKey)} required={!readOnly}>
              {readOnly ? (
                <NodeControl form={form} readOnly nodes={savedNodes} />
              ) : (
                <NodeField form={form} saved={saved} />
              )}
            </LookupField>
          ) : (
            <form.AppField key={name} name={name}>
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  dir={name === 'code' ? 'ltr' : 'auto'}
                  disabled={readOnly}
                  label={t(labelKey)}
                  required={!readOnly}
                />
              )}
            </form.AppField>
          ),
        )}
      </div>
    </FieldGroup>
  );
}
function NodeField({ form, saved }: { form: GroupForm; saved?: RequisitionGroup }) {
  const { data } = useSuspenseQuery(REQUISITION_GROUP_LOOKUPS.nodes);
  const nodes = useMemo(
    () =>
      saved && !data.some((node) => node.id === saved.supervisoryNode.id)
        ? [...data, saved.supervisoryNode]
        : data,
    [data, saved],
  );
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
  const items = useMemo(
    () => nodes.map((node) => ({ value: node.id, label: node.name, description: node.code })),
    [nodes],
  );
  return (
    <form.AppField name="nodeId">
      {(field) => (
        <field.ComboboxField
          items={items}
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
function RemoveButton({
  name,
  label,
  onClick,
}: {
  name: string;
  label: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  if (useInCards()) {
    return (
      <CardActions
        label={t('card-actions.actions-for', { name })}
        actions={[
          {
            id: 'remove',
            icon: <Trash2Icon />,
            label,
            destructive: true,
            data: { 'data-remove-row': true },
            onSelect: onClick,
          },
        ]}
      />
    );
  }
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
function DropOffName({ id }: { id: string }) {
  const { data, isPending } = useQuery(REQUISITION_GROUP_LOOKUPS.facilities);
  if (isPending) return <Block className="h-4 w-24" />;
  return (
    <span className="whitespace-normal break-words" dir="auto">
      {tableValue(data?.find((facility) => facility.id === id)?.name)}
    </span>
  );
}
function programColumns(t: TFunction, remove?: (index: number) => void) {
  return programColumn.columns([
    programColumn.accessor((row) => tableValue(row.program.name), {
      id: 'program',
      cell: ({ getValue }) => (
        <span className="whitespace-normal break-words" dir="auto">
          {getValue()}
        </span>
      ),
      header: () => (
        <DataTableHeaderLabel>{t('requisition-groups.form.program')}</DataTableHeaderLabel>
      ),
    }),
    programColumn.accessor(
      (row) =>
        row.processingSchedule.name ?? row.processingSchedule.code ?? row.processingSchedule.id,
      {
        id: 'schedule',
        cell: ({ getValue }) => (
          <span className="whitespace-normal break-words" dir="auto">
            {getValue()}
          </span>
        ),
        header: () => (
          <DataTableHeaderLabel>
            {t('requisition-groups.form.schedule-column')}
          </DataTableHeaderLabel>
        ),
        meta: { label: t('requisition-groups.form.schedule-column') },
      },
    ),
    programColumn.display({
      id: 'dropOffFacility',
      header: () => (
        <DataTableHeaderLabel>{t('requisition-groups.form.drop-off')}</DataTableHeaderLabel>
      ),
      cell: ({ row }) =>
        row.original.dropOffFacility?.id ? (
          <DropOffName id={row.original.dropOffFacility.id} />
        ) : null,
      meta: { label: t('requisition-groups.form.drop-off') },
    }),
    programColumn.accessor('directDelivery', {
      meta: { className: 'w-36', label: t('requisition-groups.form.direct-delivery') },
      header: () => (
        <DataTableHeaderLabel>{t('requisition-groups.form.direct-delivery')}</DataTableHeaderLabel>
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('requisition-groups.form.yes')}
          falseLabel={t('requisition-groups.form.no')}
        />
      ),
    }),
    ...(remove
      ? [
          programColumn.display({
            id: 'actions',
            header: () => <span className="sr-only">{t('requisition-groups.actions')}</span>,
            meta: { className: 'w-16' },
            cell: ({ row }) => (
              <RemoveButton
                name={row.original.program.name ?? row.original.program.id}
                label={t('requisition-groups.form.remove-program', {
                  program: row.original.program.name ?? row.original.program.id,
                })}
                onClick={() => remove(row.index)}
              />
            ),
          }),
        ]
      : []),
  ]);
}
function useProgramColumnView() {
  const { columnView, ...rest } = useCardView(
    PROGRAM_COLUMNS,
    'requisition-group-programs.column-visibility',
  );
  return { view: columnView, ...rest };
}
function ProgramsToolbar({
  view,
  layout,
  readOnly,
  disabled = false,
  addRef,
  onAdd,
}: {
  view: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
  readOnly: boolean;
  disabled?: boolean;
  addRef?: Ref<HTMLButtonElement>;
  onAdd?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DataTableToolbar>
      <div className="ms-auto">
        <DataTableViewOptions
          columns={PROGRAM_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          disabled={disabled}
          layout={layout}
          visibility={view.visibility}
          onVisibilityChange={view.onVisibilityChange}
          onReset={view.onReset}
        />
      </div>
      {!readOnly && (
        <Button ref={addRef} disabled={disabled} variant="outline" onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          {t('requisition-groups.form.add-program')}
        </Button>
      )}
    </DataTableToolbar>
  );
}
function ProgramSchedulesFields({ form, readOnly }: { form: GroupForm; readOnly: boolean }) {
  const { t } = useTranslation();
  const rows = useStore(form.store, (state) => state.values.schedules);
  const tableRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);
  const { measure, view, cards, layout } = useProgramColumnView();
  const remove = useCallback(
    (index: number) => {
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
  const empty = (
    <DataTableEmpty
      title={t('requisition-groups.form.no-programs')}
      description={t(
        readOnly
          ? 'requisition-groups.form.no-programs-view-description'
          : 'requisition-groups.form.no-programs-description',
      )}
      icon={<NetworkIcon />}
    />
  );
  return (
    <div className="flex flex-col gap-4" ref={measure}>
      <ProgramsToolbar
        view={view}
        layout={layout}
        readOnly={readOnly}
        addRef={addRef}
        onAdd={() => setAdding(true)}
      />
      {!readOnly && (
        <AddProgramScheduleDialog
          open={adding}
          rows={rows}
          onClose={() => setAdding(false)}
          onAdd={(row) => form.pushFieldValue('schedules', row)}
        />
      )}
      <div ref={tableRef}>
        {cards ? (
          <TableCards table={table} title="program" empty={empty} />
        ) : (
          <DataTable table={table} empty={empty} />
        )}
      </div>
    </div>
  );
}
function memberColumns(t: TFunction, remove?: (id: string, visible: number) => void) {
  return memberColumn.columns([
    memberColumn.accessor('name', {
      cell: ({ getValue }) => (
        <span className="whitespace-normal break-words" dir="auto">
          {getValue()}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.form.facility-name')} />
      ),
    }),
    memberColumn.accessor((row) => row.geographicZone?.name ?? '', {
      id: 'zone',
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="whitespace-normal break-words" dir="auto">
            {getValue()}
          </span>
        ) : null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.form.zone')} />
      ),
      meta: { label: t('requisition-groups.form.zone') },
    }),
    memberColumn.accessor((row) => row.type?.name ?? '', {
      id: 'type',
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="whitespace-normal break-words" dir="auto">
            {getValue()}
          </span>
        ) : null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.form.type')} />
      ),
      meta: { label: t('requisition-groups.form.type') },
    }),
    memberColumn.accessor('enabled', {
      meta: { className: 'w-40', label: t('requisition-groups.form.enabled') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.form.enabled')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('requisition-groups.form.yes')}
          falseLabel={t('requisition-groups.form.no')}
        />
      ),
    }),
    memberColumn.display({
      id: 'actions',
      header: () => remove && <span className="sr-only">{t('requisition-groups.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) =>
        remove && (
          <RemoveButton
            name={row.original.name}
            label={t('requisition-groups.form.remove-facility', {
              facility: row.original.name,
            })}
            onClick={() => remove(row.original.id, row.index)}
          />
        ),
    }),
  ]);
}
function useMemberColumnView() {
  const { columnView, ...rest } = useCardView(
    MEMBER_COLUMNS,
    'requisition-group-members.column-visibility',
  );
  return { view: columnView, ...rest };
}
const MEMBER_SORT_COLUMNS = [
  { id: 'name', labelKey: 'requisition-groups.form.facility-name' },
  { id: 'zone', labelKey: 'requisition-groups.form.zone' },
  { id: 'type', labelKey: 'requisition-groups.form.type' },
  { id: 'enabled', labelKey: 'requisition-groups.form.enabled' },
] as const;
function MembersToolbar({
  view,
  layout,
  search,
  onSortChange,
  readOnly,
  query,
  disabled = false,
  addRef,
  onAdd,
  onQueryChange,
}: {
  view: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
  search: RequisitionGroupEditorSearch;
  onSortChange?: (patch: Partial<RequisitionGroupEditorSearch>) => void;
  readOnly: boolean;
  query: string | undefined;
  disabled?: boolean;
  addRef?: Ref<HTMLButtonElement>;
  onAdd?: () => void;
  onQueryChange?: (query: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          disabled={disabled}
          value={query ?? ''}
          placeholder={t('requisition-groups.form.member-search')}
          onValueChange={(q) => onQueryChange?.(q)}
        />
      </div>
      <div className="ms-auto">
        <DataTableViewOptions
          columns={MEMBER_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          disabled={disabled}
          layout={layout}
          sort={{
            columns: MEMBER_SORT_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
            ...searchSort(search, DEFAULT_MEMBER_SORT, onSortChange ?? noop),
          }}
          visibility={view.visibility}
          onVisibilityChange={view.onVisibilityChange}
          onReset={view.onReset}
        />
      </div>
      {!readOnly && (
        <Button ref={addRef} disabled={disabled} variant="outline" onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          {t('requisition-groups.form.add-facility')}
        </Button>
      )}
    </DataTableToolbar>
  );
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
  const { measure, view, cards, layout } = useMemberColumnView();
  const page = useMemo(() => memberPage(rows, search), [rows, search]);
  const pageStart = usePageStart<HTMLUListElement>(`${page.page}:${search.size ?? 10}`, cards);
  const onTableChange = useCallback<SearchChange<RequisitionGroupEditorSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const remove = useCallback(
    (id: string, visible: number) => {
      const index = form.state.values.members.findIndex((item) => item.id === id);
      if (index < 0) return;
      form.removeFieldValue('members', index);
      focusAfterRemove(tableRef.current, visible, addRef.current);
    },
    [form],
  );
  const columns = useMemo(
    () => memberColumns(t, readOnly ? undefined : remove),
    [t, readOnly, remove],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_MEMBER_SORT,
    onSearchChange: onTableChange,
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
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
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
      <MembersToolbar
        view={view}
        layout={layout}
        search={search}
        onSortChange={(patch) => onSearchChange(patch, false, { resetScroll: false })}
        readOnly={readOnly}
        query={search.q}
        addRef={addRef}
        onAdd={() => setAdding(true)}
        onQueryChange={(q) =>
          onSearchChange({ q: q || undefined, page: undefined }, true, { resetScroll: false })
        }
      />
      {!readOnly && (
        <AddFacilityDialog
          open={adding}
          rows={rows}
          onClose={() => setAdding(false)}
          onAdd={(row) => form.pushFieldValue('members', row)}
        />
      )}
      <div ref={tableRef}>
        <MembersList
          cards={cards}
          table={table}
          listRef={pageStart.ref}
          footer={page.total > 0 && <DataTablePagination table={table} />}
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
                description={t(
                  readOnly
                    ? 'requisition-groups.form.no-facilities-view-description'
                    : 'requisition-groups.form.no-facilities-description',
                )}
                icon={<BuildingIcon />}
              />
            )
          }
        />
      </div>
    </div>
  );
}
function MembersList({
  cards,
  table,
  listRef,
  empty,
  footer,
}: {
  cards: boolean;
  table: DataTableInstance<MemberFacility>;
  listRef: Ref<HTMLUListElement>;
  empty: ReactNode;
  footer: ReactNode;
}) {
  if (cards) {
    return (
      <TableCards table={table} title="name" listRef={listRef} empty={empty} footer={footer} />
    );
  }
  return <DataTable table={table} empty={empty} footer={footer} />;
}
const noop = () => {};

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
  const items = useMemo(
    () =>
      availablePrograms(data, rows).map((program) => ({
        value: program.id,
        label: programName(program),
      })),
    [data, rows],
  );
  return (
    <form.AppField name="programId">
      {(field) => (
        <field.ComboboxField
          required
          label={t('requisition-groups.form.program')}
          placeholder={t('requisition-groups.form.pick-program')}
          clearLabel={t('requisition-groups.form.clear-program')}
          emptyMessage={t('requisition-groups.form.no-options')}
          items={items}
        />
      )}
    </form.AppField>
  );
}
function SchedulePicker({ form }: { form: ProgramForm }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(REQUISITION_GROUP_LOOKUPS.schedules);
  const items = useMemo(
    () =>
      data.map((schedule) => ({
        value: schedule.id,
        label: schedule.name,
        description: schedule.code,
      })),
    [data],
  );
  return (
    <form.AppField name="scheduleId">
      {(field) => (
        <field.ComboboxField
          required
          label={t('requisition-groups.form.schedule')}
          placeholder={t('requisition-groups.form.pick-schedule')}
          clearLabel={t('requisition-groups.form.clear-schedule')}
          emptyMessage={t('requisition-groups.form.no-options')}
          items={items}
        />
      )}
    </form.AppField>
  );
}
function DropOffPicker({ form }: { form: ProgramForm }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(REQUISITION_GROUP_LOOKUPS.facilities);
  const items = useMemo(
    () =>
      data.map((facility) => ({
        value: facility.id,
        label: facility.name,
        description: facility.code,
      })),
    [data],
  );
  return (
    <form.AppField name="dropOffId">
      {(field) => (
        <field.ComboboxField
          label={t('requisition-groups.form.drop-off')}
          placeholder={t('requisition-groups.form.pick-facility')}
          clearLabel={t('requisition-groups.form.clear-facility')}
          emptyMessage={t('requisition-groups.form.no-options')}
          items={items}
        />
      )}
    </form.AppField>
  );
}
const ADD_FACILITY_KEY = [...queryKeys.requisitionGroups.all, 'add-facility'];
type AddFacilityProps = {
  open: boolean;
  rows: MemberFacility[];
  onClose: () => void;
  onAdd: (row: MemberFacility) => void;
};
function AddFacilityDialog({ open, rows, onClose, onAdd }: AddFacilityProps) {
  const { shown, close, dialogProps } = useDialogTarget(open ? 'new' : undefined, onClose);
  const pending = useIsMutating({ mutationKey: ADD_FACILITY_KEY }) > 0;
  return (
    <FormDialog {...dialogProps(pending)} closeButton={!pending}>
      {shown && (
        <AddFacilityForm
          rows={rows}
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
function useFacilityForm(onAdd: (row: MemberFacility) => void, queryClient: QueryClient) {
  const mutation = useSessionMutation({
    mutationKey: ADD_FACILITY_KEY,
    mutationFn: (id: string) => queryClient.fetchQuery(facilityOptions(id)),
    onSuccess: (facility) =>
      onAdd({
        ...facility,
        name: facility.name ?? facility.code,
        type: { ...facility.type, name: facility.type.name ?? undefined },
      }),
  });
  const form = useAppForm({
    defaultValues: { facilityId: null as string | null },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: addFacilitySchema },
    onSubmit: ({ value }) =>
      value.facilityId ? mutation.mutateAsync(value.facilityId).catch(() => undefined) : undefined,
  });
  return { form, mutation };
}
type FacilityForm = ReturnType<typeof useFacilityForm>['form'];
function AddFacilityForm({ rows, onAdd }: Pick<AddFacilityProps, 'rows' | 'onAdd'>) {
  const { t } = useTranslation();
  const { form, mutation } = useFacilityForm(onAdd, useQueryClient());
  const busy = mutation.isPending;
  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('requisition-groups.form.add-facility')}</FormDialogTitle>
        <FormDialogDescription>
          {t('requisition-groups.form.add-facility-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        {mutation.isError && (
          <ErrorAlert
            title={t('requisition-groups.form.facility-error-title')}
            description={
              serverMessage(mutation.error) ?? t('requisition-groups.form.facility-error')
            }
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
  const ids = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  const items = useMemo(
    () =>
      data
        .filter((facility) => !ids.has(facility.id))
        .map((facility) => ({
          value: facility.id,
          label: facility.name,
          description: facility.code,
        })),
    [data, ids],
  );
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
          items={items}
        />
      )}
    </form.AppField>
  );
}
export function RequisitionGroupEditorSkeleton({
  title,
  description,
  readOnly = false,
  search,
}: {
  title?: string;
  description: string;
  readOnly?: boolean;
  search: RequisitionGroupEditorSearch;
}) {
  const { t } = useTranslation();
  const tab = search.tab ?? 'programs';
  return (
    <>
      <Workspace width="narrow">
        <EditorHeader title={title} description={description} />
        <WorkspaceContent>
          <div className="flex flex-col gap-6">
            <FieldGroup>
              <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
                {GENERAL_FIELDS[readOnly ? 'view' : 'edit'].map(({ name, labelKey }) => (
                  <FieldSkeleton key={name} label={t(labelKey)} required={!readOnly} />
                ))}
              </div>
            </FieldGroup>
            <Tabs spacing="page" value={tab}>
              <EditorTabs />
              <TabsContent value={tab}>
                {tab === 'facilities' ? (
                  <MembersSkeleton readOnly={readOnly} search={search} />
                ) : (
                  <ProgramsSkeleton readOnly={readOnly} />
                )}
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
function ProgramsSkeleton({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation();
  const { measure, view, cards, layout } = useProgramColumnView();
  const columns = useMemo(() => programColumns(t, readOnly ? undefined : () => {}), [t, readOnly]);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: [],
    enableSorting: false,
    state: { columnVisibility: view.visibility },
  });
  return (
    <div className="flex flex-col gap-4" ref={measure}>
      <ProgramsToolbar view={view} layout={layout} readOnly={readOnly} disabled />
      {cards ? (
        <TableCardsSkeleton table={table} title="program" rowCount={3} />
      ) : (
        <DataTableSkeleton table={table} rowCount={3} />
      )}
    </div>
  );
}
function MembersSkeleton({
  readOnly,
  search,
}: {
  readOnly: boolean;
  search: RequisitionGroupEditorSearch;
}) {
  const { t } = useTranslation();
  const { measure, view, cards, layout } = useMemberColumnView();
  const columns = useMemo(() => memberColumns(t, readOnly ? undefined : () => {}), [t, readOnly]);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: [],
    enableSorting: false,
    state: {
      columnVisibility:
        readOnly && cards ? { ...view.visibility, actions: false } : view.visibility,
    },
  });
  return (
    <div className="flex flex-col gap-4" ref={measure}>
      <MembersToolbar
        view={view}
        layout={layout}
        search={search}
        readOnly={readOnly}
        query={search.q}
        disabled
      />
      {cards ? (
        <TableCardsSkeleton table={table} title="name" rowCount={search.size ?? 10} />
      ) : (
        <DataTableSkeleton table={table} rowCount={search.size ?? 10} />
      )}
    </div>
  );
}
