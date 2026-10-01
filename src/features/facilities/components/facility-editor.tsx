import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { BuildingIcon, Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableCard } from '@/components/data-table/data-table';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
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
  availablePrograms,
  type FacilityFormValues,
  type FacilityTab,
  facilityFormSchema,
  isDuplicateCode,
  tabWithFirstError,
  toProgramRow,
} from '@/features/facilities/lib/facility-form';
import {
  facilityOperatorsOptions,
  facilityTypesOptions,
  geographicZonesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import type { Facility } from '@/features/reference-data/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

/** The lookups the form picks from; the page waits for them, since every field needs one. */
export const FACILITY_EDITOR_LOOKUPS = [
  facilityTypesOptions({ active: true }),
  geographicZonesOptions(),
  facilityOperatorsOptions(),
  programsOptions(),
] as const;

type FacilityEditorProps = {
  initialValues: FacilityFormValues;
  tab: FacilityTab;
  onTabChange: (tab: FacilityTab) => void;
  title: string;
  description: string;
  submitLabel: string;
  discardDescription: string;
  save: (values: FacilityFormValues) => Promise<Facility>;
  /** Runs once the page may be left, e.g. to show a toast and go back to the list. */
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

/** Once the tab with the error is open, its first wrong field takes focus. */
function focusFirstError(container: HTMLElement | null) {
  requestAnimationFrame(() =>
    container
      ?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) [aria-invalid="true"]')
      ?.focus(),
  );
}

/** A facility's information and programs as tabs over one draft, with one save for both. */
export function FacilityEditor({
  initialValues,
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
  const schema = useMemo(() => facilityFormSchema(refused), [refused]);
  const tabs = useRef<HTMLDivElement>(null);
  // Set once the page may be left without asking, right after a save.
  const leaving = useRef(false);

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: (saved) => {
      leaving.current = true;
      onSaved(saved);
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
      <Workspace>
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
          <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={tabs}>
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
                <InformationFields form={form} />
              </TabsContent>
              <TabsContent keepMounted value="programs">
                <ProgramsFields form={form} />
              </TabsContent>
            </Tabs>
          </div>
          <DiscardChangesDialog description={discardDescription} {...guard.dialog} />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter>
        <Button disabled={mutation.isPending} onClick={onCancel} size="lg" variant="outline">
          {t('facilities.form.cancel')}
        </Button>
        <Button disabled={mutation.isPending} onClick={() => form.handleSubmit()} size="lg">
          {mutation.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </WorkspaceFooter>
    </>
  );
}

function FieldSpan({ children }: { children: ReactNode }) {
  return <div className="@3xl/main:col-span-2">{children}</div>;
}

function InformationFields({ form }: { form: FacilityForm }) {
  const { t } = useTranslation();
  const { data: types } = useSuspenseQuery(FACILITY_EDITOR_LOOKUPS[0]);
  const { data: zones } = useSuspenseQuery(FACILITY_EDITOR_LOOKUPS[1]);
  const { data: operators } = useSuspenseQuery(FACILITY_EDITOR_LOOKUPS[2]);
  const typeItems = useMemo(
    () => types.map((type) => ({ value: type.id, label: type.name || type.code })),
    [types],
  );
  const zoneItems = useMemo(
    () =>
      zones.map((zone) => ({
        value: zone.id,
        label: zone.name,
        ...(zone.level.name && { description: zone.level.name }),
      })),
    [zones],
  );
  const operatorItems = useMemo(
    () =>
      operators.map((operator) => ({ value: operator.id, label: operator.name || operator.code })),
    [operators],
  );
  const noMatches = t('facilities.form.no-matches');

  return (
    <FieldGroup>
      <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
        <form.AppField name="name">
          {(field) => (
            <field.TextField autoComplete="off" label={t('facilities.form.name')} required />
          )}
        </form.AppField>
        <form.AppField name="code">
          {(field) => (
            <field.TextField
              autoComplete="off"
              dir="ltr"
              label={t('facilities.form.code')}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="typeId">
          {(field) => (
            <field.ComboboxField
              clearLabel={t('facilities.form.clear-type')}
              emptyMessage={noMatches}
              items={typeItems}
              label={t('facilities.form.type')}
              placeholder={t('facilities.form.pick-type')}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="zoneId">
          {(field) => (
            <field.ComboboxField
              clearLabel={t('facilities.form.clear-zone')}
              emptyMessage={noMatches}
              items={zoneItems}
              label={t('facilities.form.zone')}
              placeholder={t('facilities.form.pick-zone')}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="goLiveDate">
          {(field) => (
            <field.DateField
              clearLabel={t('facilities.form.clear-go-live-date')}
              description={t('facilities.form.go-live-date-description')}
              label={t('facilities.form.go-live-date')}
              placeholder={t('facilities.form.pick-date')}
            />
          )}
        </form.AppField>
        <form.AppField name="operatorId">
          {(field) => (
            <field.ComboboxField
              clearLabel={t('facilities.form.clear-operator')}
              emptyMessage={noMatches}
              items={operatorItems}
              label={t('facilities.form.operator')}
              placeholder={t('facilities.form.pick-operator')}
            />
          )}
        </form.AppField>
        <FieldSpan>
          <form.AppField name="description">
            {(field) => <field.TextareaField label={t('facilities.form.description')} />}
          </form.AppField>
        </FieldSpan>
        <form.AppField name="active">
          {(field) => (
            <field.SwitchField
              description={t('facilities.form.active-description')}
              label={t('facilities.form.active')}
            />
          )}
        </form.AppField>
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

const addProgramSchema = z.object({
  programId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), 'facilities.form.program-required'),
  startDate: z.string().min(1, 'facilities.form.start-date-required'),
});

function ProgramsFields({ form }: { form: FacilityForm }) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(FACILITY_EDITOR_LOOKUPS[3]);
  const rows = useStore(form.store, (state) => state.values.programs);
  const programItems = useMemo(
    () =>
      availablePrograms(programs, rows).map((program) => ({
        value: program.id,
        label: programName(program),
      })),
    [programs, rows],
  );

  const addForm = useAppForm({
    defaultValues: { programId: null as string | null, startDate: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: addProgramSchema },
    onSubmit: ({ value, formApi }) => {
      const program = programs.find((item) => item.id === value.programId);
      if (!program) return;
      form.pushFieldValue('programs', toProgramRow(program, value.startDate));
      formApi.reset();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <div className="flex flex-col gap-x-4 gap-y-5 @2xl/main:flex-row @2xl/main:items-start">
          <div className="min-w-0 flex-1">
            <addForm.AppField name="programId">
              {(field) => (
                <field.ComboboxField
                  clearLabel={t('facilities.form.clear-program')}
                  emptyMessage={t('facilities.form.no-matches')}
                  items={programItems}
                  label={t('facilities.form.program')}
                  placeholder={t('facilities.form.pick-program')}
                  required
                />
              )}
            </addForm.AppField>
          </div>
          <div className="@2xl/main:w-64">
            <addForm.AppField name="startDate">
              {(field) => (
                <field.DateField
                  description={t('facilities.form.start-date-description')}
                  label={t('facilities.form.start-date')}
                  placeholder={t('facilities.form.pick-date')}
                  required
                />
              )}
            </addForm.AppField>
          </div>
          <div className="@2xl/main:pt-6">
            <Button onClick={() => addForm.handleSubmit()} variant="outline" width="full">
              <PlusIcon data-icon="inline-start" />
              {t('facilities.form.add-program')}
            </Button>
          </div>
        </div>
      </FieldGroup>
      <ProgramRows form={form} />
    </div>
  );
}

function ProgramRows({ form }: { form: FacilityForm }) {
  const { t } = useTranslation();

  return (
    <form.Field mode="array" name="programs">
      {(programsField) =>
        programsField.state.value.length === 0 ? (
          <DataTableCard>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BuildingIcon />
                </EmptyMedia>
                <EmptyTitle>{t('facilities.form.no-programs-title')}</EmptyTitle>
                <EmptyDescription>{t('facilities.form.no-programs-description')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </DataTableCard>
        ) : (
          <DataTableCard>
            <Table density="comfortable">
              <TableHeader surface="muted">
                <TableRow>
                  <TableHead>{t('facilities.form.program')}</TableHead>
                  <TableHead>{t('facilities.form.program-active')}</TableHead>
                  <TableHead>{t('facilities.form.start-date')}</TableHead>
                  <TableHead>{t('facilities.form.locally-fulfilled')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('facilities.form.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programsField.state.value.map((row, index) => {
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
                                required
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
                              onClick={() => programsField.removeValue(index)}
                              size="icon-sm"
                              variant="ghost"
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
          </DataTableCard>
        )
      }
    </form.Field>
  );
}
