import { revalidateLogic, useStore } from '@tanstack/react-form';
import { type QueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { BuildingIcon, InfoIcon, Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import {
  DialogLoadError,
  ErrorAlert,
  FieldSkeleton,
  LookupBoundary,
  SwitchRowSkeleton,
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
import { QueryBoundary } from '@/components/query-boundary';
import { Block } from '@/components/skeleton-block';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { FieldGroup } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  addProgramSchema,
  availablePrograms,
  type FacilityFormValues,
  type FacilityTab,
  facilityFormSchema,
  isDuplicateCode,
  isManagedExternally,
  tabWithFirstError,
  toProgramRow,
} from '@/features/facilities/lib/facility-form';
import { toZoneOption } from '@/features/facilities/lib/zone-filter';
import {
  facilityOperatorsOptions,
  facilityTypesOptions,
  geographicZonesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import type { Facility } from '@/features/reference-data/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';

export const FACILITY_EDITOR_LOOKUPS = {
  types: facilityTypesOptions({ active: true }),
  zones: geographicZonesOptions(),
  operators: facilityOperatorsOptions(),
  programs: programsOptions(),
};

export function prefetchFacilityEditorLookups(queryClient: QueryClient) {
  const { types, zones, operators, programs } = FACILITY_EDITOR_LOOKUPS;
  queryClient.prefetchQuery(types);
  queryClient.prefetchQuery(zones);
  queryClient.prefetchQuery(operators);
  queryClient.prefetchQuery(programs);
}

const FORM_ID = 'facility-form';

type FacilityEditorProps = {
  initialValues: FacilityFormValues;
  saved?: Facility | undefined;
  tab: FacilityTab;
  onTabChange: (tab: FacilityTab) => void;
  title: string;
  description: string;
  submitLabel: string;
  discardDescription: string;
  save: (values: FacilityFormValues) => Promise<Facility>;
  onSaved: (saved: Facility) => void;
  onCancel: () => void;
};

function useFacilityForm(
  initialValues: FacilityFormValues,
  schema: ReturnType<typeof facilityFormSchema>,
  onSubmit: (values: FacilityFormValues) => Promise<unknown>,
  onInvalid: (fieldNames: string[]) => void,
) {
  return useAppForm({
    defaultValues: initialValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => onSubmit(value),
    onSubmitInvalid: ({ formApi }) =>
      onInvalid(
        Object.entries(formApi.state.fieldMeta)
          .filter(([, meta]) => (meta?.errors.length ?? 0) > 0)
          .map(([name]) => name),
      ),
  });
}

type FacilityForm = ReturnType<typeof useFacilityForm>;

function focusFirstError(container: HTMLElement | null) {
  requestAnimationFrame(() =>
    container
      ?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) [aria-invalid="true"]')
      ?.focus(),
  );
}

export function FacilityEditor({
  initialValues,
  saved,
  tab,
  onTabChange,
  title,
  description,
  submitLabel,
  discardDescription,
  save,
  onSaved,
  onCancel,
}: FacilityEditorProps) {
  const { t } = useTranslation();
  const [refused, setRefused] = useState<string[]>([]);
  const locked = saved ? isManagedExternally(saved) : false;
  const editing = Boolean(saved);
  const schema = useMemo(
    () => facilityFormSchema(refused, { goLiveDateRequired: editing, locked }),
    [refused, editing, locked],
  );
  const tabs = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  const mutation = useSessionMutation({
    mutationFn: save,
    onSuccess: (facility) => {
      leaving.current = true;
      onSaved(facility);
    },
    onError: (error, values) => {
      if (!isDuplicateCode(error)) return;
      setRefused((codes) => [...codes, values.code]);
      onTabChange('information');
    },
  });

  const form = useFacilityForm(
    initialValues,
    schema,
    (values) => mutation.mutateAsync(values).catch(() => undefined),
    (fieldNames) => {
      const errorTab = tabWithFirstError(fieldNames);
      if (errorTab) onTabChange(errorTab);
      focusFirstError(tabs.current);
    },
  );

  useEffect(() => {
    if (refused.length === 0) return;
    void form.validate('change');
    focusFirstError(tabs.current);
  }, [refused, form]);

  const changed = useStore(form.store, (state) => !state.isDefaultValue);
  const programCount = useStore(form.store, (state) => state.values.programs.length);
  const guard = useDiscardGuard(changed, { allowLeave: () => leaving.current });

  return (
    <>
      <Workspace width="narrow">
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <BuildingIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>{title}</WorkspaceTitle>
            <WorkspaceDescription>{description}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div
            className="flex flex-col gap-4 @4xl/main:gap-6"
            inert={mutation.isPending}
            ref={tabs}
          >
            {locked && (
              <Alert variant="info">
                <InfoIcon />
                <AlertTitle>{t('facilities.form.managed-externally-title')}</AlertTitle>
                <AlertDescription>{t('facilities.form.managed-externally')}</AlertDescription>
              </Alert>
            )}
            {mutation.isError && !isDuplicateCode(mutation.error) && (
              <ErrorAlert
                description={serverMessage(mutation.error) ?? t('facilities.form.save-error')}
                title={t('facilities.form.save-error-title')}
              />
            )}
            <Tabs
              onValueChange={(value: FacilityTab) => onTabChange(value)}
              spacing="page"
              value={tab}
            >
              <TabsList aria-label={t('facilities.form.tabs-label')}>
                <TabsTrigger value="information">{t('facilities.form.information')}</TabsTrigger>
                <TabsTrigger value="programs">
                  {t('facilities.form.programs')}
                  <Badge variant="secondary">{programCount}</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent keepMounted value="information">
                <form
                  id={FORM_ID}
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void form.handleSubmit();
                  }}
                >
                  <InformationFields form={form} locked={locked} saved={saved} />
                </form>
              </TabsContent>
              <TabsContent keepMounted value="programs">
                <ProgramsFields form={form} />
              </TabsContent>
            </Tabs>
          </div>
          <DiscardChangesDialog description={discardDescription} {...guard.dialog} />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled={mutation.isPending} onClick={onCancel} size="lg" variant="outline">
          {t('facilities.form.cancel')}
        </Button>
        <Button disabled={mutation.isPending} form={FORM_ID} size="lg" type="submit">
          {mutation.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </WorkspaceFooter>
    </>
  );
}

function LookupField(props: { label: string; required?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <LookupBoundary
      errorDescription={t('facilities.form.load-error-description')}
      errorTitle={t('facilities.form.load-error-title')}
      {...props}
    />
  );
}

type InformationFieldsProps = {
  form: FacilityForm;
  locked: boolean;
  saved: Facility | undefined;
};

function InformationFields({ form, locked, saved }: InformationFieldsProps) {
  const { t } = useTranslation();

  return (
    <FieldGroup>
      <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              autoComplete="off"
              disabled={locked}
              label={t('facilities.form.name')}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="code">
          {(field) => (
            <field.TextField
              autoComplete="off"
              dir="ltr"
              disabled={locked}
              label={t('facilities.form.code')}
              required
            />
          )}
        </form.AppField>
        <LookupField label={t('facilities.form.type')} required>
          <TypeField current={saved?.type} form={form} />
        </LookupField>
        <LookupField label={t('facilities.form.zone')} required>
          <ZoneField disabled={locked} form={form} />
        </LookupField>
        <form.AppField name="goLiveDate">
          {(field) => (
            <field.DateField
              clearLabel={t('facilities.form.clear-go-live-date')}
              description={t('facilities.form.go-live-date-description')}
              label={t('facilities.form.go-live-date')}
              placeholder={t('facilities.form.pick-date')}
              required={Boolean(saved)}
            />
          )}
        </form.AppField>
        <LookupField label={t('facilities.form.operator')}>
          <OperatorField form={form} />
        </LookupField>
        <form.AppField name="description">
          {(field) => (
            <field.TextareaField disabled={locked} label={t('facilities.form.description')} />
          )}
        </form.AppField>
        <div className="@3xl/main:col-start-1">
          <form.AppField name="active">
            {(field) => (
              <field.SwitchField
                description={t('facilities.form.active-description')}
                disabled={locked}
                label={t('facilities.form.active')}
              />
            )}
          </form.AppField>
        </div>
        <form.AppField name="enabled">
          {(field) => (
            <field.SwitchField
              description={t('facilities.form.enabled-description')}
              label={t('facilities.form.enabled')}
            />
          )}
        </form.AppField>
      </div>
    </FieldGroup>
  );
}

type TypeFieldProps = {
  form: FacilityForm;
  current: Facility['type'] | undefined;
};

function TypeField({ form, current }: TypeFieldProps) {
  const { t } = useTranslation();
  const { data: types } = useSuspenseQuery(FACILITY_EDITOR_LOOKUPS.types);
  const items = useMemo(() => {
    const all =
      current && !types.some((type) => type.id === current.id) ? [...types, current] : types;
    return all
      .map((type) => ({ value: type.id, label: type.name || type.code }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [types, current]);
  return (
    <form.AppField name="typeId">
      {(field) => (
        <field.ComboboxField
          clearLabel={t('facilities.form.clear-type')}
          emptyMessage={t('facilities.form.no-matches')}
          items={items}
          label={t('facilities.form.type')}
          placeholder={t('facilities.form.pick-type')}
          required
        />
      )}
    </form.AppField>
  );
}

function ZoneField({ form, disabled }: { form: FacilityForm; disabled: boolean }) {
  const { t } = useTranslation();
  const { data: zones } = useSuspenseQuery(FACILITY_EDITOR_LOOKUPS.zones);
  const items = useMemo(() => zones.map(toZoneOption), [zones]);
  return (
    <form.AppField name="zoneId">
      {(field) => (
        <field.ComboboxField
          clearLabel={t('facilities.form.clear-zone')}
          disabled={disabled}
          emptyMessage={t('facilities.form.no-matches')}
          items={items}
          label={t('facilities.form.zone')}
          limit={-1}
          placeholder={t('facilities.form.pick-zone')}
          required
        />
      )}
    </form.AppField>
  );
}

function OperatorField({ form }: { form: FacilityForm }) {
  const { t } = useTranslation();
  const { data: operators } = useSuspenseQuery(FACILITY_EDITOR_LOOKUPS.operators);
  const items = useMemo(
    () =>
      operators.map((operator) => ({ value: operator.id, label: operator.name || operator.code })),
    [operators],
  );
  return (
    <form.AppField name="operatorId">
      {(field) => (
        <field.ComboboxField
          clearLabel={t('facilities.form.clear-operator')}
          emptyMessage={t('facilities.form.no-matches')}
          items={items}
          label={t('facilities.form.operator')}
          placeholder={t('facilities.form.pick-operator')}
        />
      )}
    </form.AppField>
  );
}

function ProgramsFields({ form }: { form: FacilityForm }) {
  const { t } = useTranslation();
  const rows = useStore(form.store, (state) => state.values.programs);
  const table = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);

  const removeRow = (index: number) => {
    form.removeFieldValue('programs', index);
    // The pressed button is gone, so the next row's takes the focus, or Add Program.
    requestAnimationFrame(() => {
      const buttons = table.current?.querySelectorAll<HTMLElement>('[data-remove-program]');
      const next = buttons?.[Math.min(index, buttons.length - 1)];
      (next ?? addButton.current)?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} ref={addButton} variant="outline">
          <PlusIcon data-icon="inline-start" />
          {t('facilities.form.add-program')}
        </Button>
      </div>
      <AddProgramDialog
        onAdd={(row) => form.pushFieldValue('programs', row)}
        onClose={() => setAdding(false)}
        open={adding}
        rows={rows}
      />
      <div ref={table}>
        <DataTableCard>
          {rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BuildingIcon />
                </EmptyMedia>
                <EmptyTitle>{t('facilities.form.no-programs-title')}</EmptyTitle>
                <EmptyDescription>{t('facilities.form.no-programs-description')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table density="comfortable">
              <TableHeader surface="muted">
                <TableRow>
                  <TableHead>
                    <DataTableHeaderLabel>{t('facilities.form.program')}</DataTableHeaderLabel>
                  </TableHead>
                  <TableHead>
                    <DataTableHeaderLabel>
                      {t('facilities.form.program-active')}
                    </DataTableHeaderLabel>
                  </TableHead>
                  <TableHead>
                    <DataTableHeaderLabel>{t('facilities.form.start-date')}</DataTableHeaderLabel>
                  </TableHead>
                  <TableHead>
                    <DataTableHeaderLabel>
                      {t('facilities.form.locally-fulfilled')}
                    </DataTableHeaderLabel>
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">{t('facilities.form.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const name = programName(row);
                  const named = (field: string) =>
                    t('facilities.form.row-label', { program: name, field });
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="whitespace-normal font-medium" dir="auto">
                          {name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <form.AppField name={`programs[${index}].supportActive`}>
                          {(field) => (
                            <field.SwitchField
                              label={named(t('facilities.form.program-active'))}
                              layout="inline"
                            />
                          )}
                        </form.AppField>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-44">
                          <form.AppField name={`programs[${index}].supportStartDate`}>
                            {(field) => (
                              <field.DateField
                                label={named(t('facilities.form.start-date'))}
                                layout="inline"
                                placeholder={t('facilities.form.pick-date')}
                                required={!row.saved}
                              />
                            )}
                          </form.AppField>
                        </div>
                      </TableCell>
                      <TableCell>
                        <form.AppField name={`programs[${index}].supportLocallyFulfilled`}>
                          {(field) => (
                            <field.SwitchField
                              label={named(t('facilities.form.locally-fulfilled'))}
                              layout="inline"
                            />
                          )}
                        </form.AppField>
                      </TableCell>
                      <TableCell>
                        {!row.saved && (
                          <div className="flex justify-end">
                            <Button
                              aria-label={t('facilities.form.remove-program', { program: name })}
                              data-remove-program
                              onClick={() => removeRow(index)}
                              size="icon-sm"
                              variant="destructive"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      </div>
    </div>
  );
}

type AddProgramDialogProps = {
  open: boolean;
  rows: FacilityFormValues['programs'];
  onAdd: (row: FacilityFormValues['programs'][number]) => void;
  onClose: () => void;
};

function AddProgramDialog({ open, rows, onAdd, onClose }: AddProgramDialogProps) {
  const { t } = useTranslation();
  const { shown, close, dialogProps } = useDialogTarget(open ? 'new' : undefined, onClose);

  return (
    <FormDialog {...dialogProps()}>
      {shown && (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <DialogLoadError
              error={error}
              errorTitle={t('facilities.form.load-error-title')}
              onRetry={reset}
              title={t('facilities.form.add-program')}
            />
          )}
          pendingFallback={<AddProgramSkeleton />}
          resetKey="add-program"
        >
          <AddProgramForm
            onAdd={(row) => {
              if (close()) onAdd(row);
            }}
            rows={rows}
          />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

function AddProgramHeader() {
  const { t } = useTranslation();
  return (
    <FormDialogHeader>
      <FormDialogTitle>{t('facilities.form.add-program')}</FormDialogTitle>
      <FormDialogDescription>{t('facilities.form.add-program-description')}</FormDialogDescription>
    </FormDialogHeader>
  );
}

function AddProgramForm({ rows, onAdd }: Pick<AddProgramDialogProps, 'rows' | 'onAdd'>) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(FACILITY_EDITOR_LOOKUPS.programs);
  const items = useMemo(
    () =>
      availablePrograms(programs, rows).map((program) => ({
        value: program.id,
        label: programName(program),
      })),
    [programs, rows],
  );

  const form = useAppForm({
    defaultValues: { programId: null as string | null, startDate: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: addProgramSchema },
    onSubmit: ({ value }) => {
      const program = programs.find((item) => item.id === value.programId);
      if (program) onAdd(toProgramRow(program, value.startDate));
    },
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <AddProgramHeader />
      <FormDialogBody>
        <FieldGroup>
          <form.AppField name="programId">
            {(field) => (
              <field.ComboboxField
                clearLabel={t('facilities.form.clear-program')}
                emptyMessage={t('facilities.form.no-matches')}
                items={items}
                label={t('facilities.form.program')}
                placeholder={t('facilities.form.pick-program')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="startDate">
            {(field) => (
              <field.DateField
                description={t('facilities.form.start-date-description')}
                label={t('facilities.form.start-date')}
                placeholder={t('facilities.form.pick-date')}
                required
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit>{t('facilities.form.add')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function AddProgramSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <AddProgramHeader />
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('facilities.form.program')} required />
          <FieldSkeleton label={t('facilities.form.start-date')} required />
        </FieldGroup>
      </FormDialogBody>
    </>
  );
}

type FacilityEditorSkeletonProps = {
  title: string;
  description: string;
  submitLabel: string;
  goLiveDateRequired?: boolean;
};

export function FacilityEditorSkeleton({
  title,
  description,
  submitLabel,
  goLiveDateRequired = false,
}: FacilityEditorSkeletonProps) {
  const { t } = useTranslation();
  return (
    <>
      <Workspace width="narrow">
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <BuildingIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>{title}</WorkspaceTitle>
            <WorkspaceDescription>{description}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div className="flex flex-col gap-4 @4xl/main:gap-6">
            <Tabs spacing="page" value="information">
              <TabsList aria-label={t('facilities.form.tabs-label')}>
                <TabsTrigger value="information">{t('facilities.form.information')}</TabsTrigger>
                <TabsTrigger value="programs">
                  {t('facilities.form.programs')}
                  <Badge variant="secondary">
                    <Block className="h-3 w-2" />
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="information">
                <FieldGroup>
                  <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
                    <FieldSkeleton label={t('facilities.form.name')} required />
                    <FieldSkeleton label={t('facilities.form.code')} required />
                    <FieldSkeleton label={t('facilities.form.type')} required />
                    <FieldSkeleton label={t('facilities.form.zone')} required />
                    <FieldSkeleton
                      description={t('facilities.form.go-live-date-description')}
                      label={t('facilities.form.go-live-date')}
                      required={goLiveDateRequired}
                    />
                    <FieldSkeleton label={t('facilities.form.operator')} />
                    <FieldSkeleton control="textarea" label={t('facilities.form.description')} />
                    <div className="@3xl/main:col-start-1">
                      <SwitchRowSkeleton label={t('facilities.form.active')} />
                    </div>
                    <SwitchRowSkeleton label={t('facilities.form.enabled')} />
                  </div>
                </FieldGroup>
              </TabsContent>
            </Tabs>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled size="lg" variant="outline">
          {t('facilities.form.cancel')}
        </Button>
        <Button disabled size="lg">
          {submitLabel}
        </Button>
      </WorkspaceFooter>
    </>
  );
}
