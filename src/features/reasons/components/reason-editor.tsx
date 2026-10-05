import { revalidateLogic, useStore } from '@tanstack/react-form';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import {
  Loader2Icon,
  MapPinnedIcon,
  MessageSquareTextIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard } from '@/components/data-table/data-table';
import {
  ErrorAlert,
  FieldSkeleton,
  LookupBoundary,
  serverMessage,
} from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  reasonCategoriesOptions,
  reasonTagsOptions,
  reasonTypesOptions,
} from '@/features/reasons/api/queries';
import { useReasonLabels } from '@/features/reasons/hooks/use-reason-labels';
import {
  addPairSchema,
  EMPTY_REASON_FORM,
  type PairDraft,
  type ReasonFormValues,
  reasonFormSchema,
  toReasonBody,
  toReasonFormValues,
} from '@/features/reasons/lib/reason-form';
import { type PairRef, saveReason } from '@/features/reasons/lib/save-reason';
import type { ValidReason } from '@/features/reasons/lib/types';
import {
  facilityTypesOptions,
  programsOptions,
  reasonsOptions,
} from '@/features/reference-data/api/queries';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import { programName } from '@/features/reference-data/lib/programs';
import type { FacilityType, Program, Reason } from '@/features/reference-data/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { queryKeys } from '@/lib/key-factory';

const LOOKUPS = {
  types: reasonTypesOptions(),
  categories: reasonCategoriesOptions(),
  tags: reasonTagsOptions(),
  programs: programsOptions(),
  // Every type names the saved pairs; only active ones are offered for new pairs.
  facilityTypes: facilityTypesOptions(),
  activeFacilityTypes: facilityTypesOptions({ active: true }),
};

export function prefetchReasonEditorLookups(queryClient: QueryClient) {
  queryClient.prefetchQuery(LOOKUPS.types);
  queryClient.prefetchQuery(LOOKUPS.categories);
  queryClient.prefetchQuery(LOOKUPS.tags);
  queryClient.prefetchQuery(LOOKUPS.programs);
  queryClient.prefetchQuery(LOOKUPS.facilityTypes);
  queryClient.prefetchQuery(LOOKUPS.activeFacilityTypes);
  queryClient.prefetchQuery(reasonsOptions());
}

const FORM_ID = 'reason-form';

const isDuplicateName = (error: unknown) =>
  isAxiosError<{ messageKey?: string }>(error) &&
  /\.reason\.name\.duplicate$/.test(error.response?.data?.messageKey ?? '');

function focusFirstError(container: HTMLElement | null) {
  requestAnimationFrame(() =>
    container?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}

const pairKey = (pair: PairRef) => `${pair.programId}|${pair.facilityTypeId}`;

/** A pair in words, such as "EPI, Health Center"; a program or type the lookups lack is Unknown. */
function pairNamer(
  t: TFunction,
  programs: Program[] | undefined,
  types: FacilityType[] | undefined,
) {
  const programNames = new Map(programs?.map((program) => [program.id, programName(program)]));
  const typeNames = new Map(types?.map((type) => [type.id, facilityTypeName(type)]));
  const unknown = t('reasons.form.unknown');
  return (pair: PairRef) =>
    t('reasons.form.pair', {
      program: programNames.get(pair.programId) ?? unknown,
      facilityType: typeNames.get(pair.facilityTypeId) ?? unknown,
    });
}

type ReasonEditorProps = {
  /** The reason and its pairs as stored; none adds a new reason. */
  saved?: { reason: Reason; pairs: ValidReason[] } | undefined;
  title: string;
  description: string;
  submitLabel: string;
  discardDescription: string;
  onSaved: (reason: Reason) => void;
  onCancel: () => void;
};

function useReasonForm(
  initialValues: ReasonFormValues,
  schema: ReturnType<typeof reasonFormSchema>,
  onSubmit: (values: ReasonFormValues) => Promise<unknown>,
  onInvalid: () => void,
) {
  return useAppForm({
    defaultValues: initialValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => onSubmit(value),
    onSubmitInvalid: onInvalid,
  });
}

type ReasonForm = ReturnType<typeof useReasonForm>;

export function ReasonEditor({
  saved,
  title,
  description,
  submitLabel,
  discardDescription,
  onSaved,
  onCancel,
}: ReasonEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: reasons = [] } = useQuery(reasonsOptions());
  // What the server holds; after a partial save, the next one only sends what is still missing.
  const [stored, setStored] = useState(() => ({
    reason: saved?.reason,
    pairs: saved?.pairs ?? [],
  }));
  const [refused, setRefused] = useState<string[]>([]);
  const [failure, setFailure] = useState<{ failed: PairRef[]; error: unknown }>();
  const schema = useMemo(
    () => reasonFormSchema(reasons, stored.reason?.id, refused),
    [reasons, stored.reason?.id, refused],
  );
  const page = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  const mutation = useMutation({
    mutationFn: (values: ReasonFormValues) =>
      saveReason({
        id: stored.reason?.id,
        body: toReasonBody(values, stored.reason),
        savedPairs: stored.pairs,
        pairs: values.pairs,
      }),
    onMutate: () => setFailure(undefined),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reasons.list() });
      void queryClient.invalidateQueries({ queryKey: reasonTagsOptions().queryKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reasons.detail(result.reason.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.validReasons.all });
      if (result.failed.length === 0) {
        leaving.current = true;
        onSaved(result.reason);
        return;
      }
      setStored({ reason: result.reason, pairs: result.pairs });
      setFailure({ failed: result.failed, error: result.error });
    },
    onError: (error, values) => {
      if (isDuplicateName(error)) setRefused((names) => [...names, values.name.trim()]);
    },
  });

  const form = useReasonForm(
    saved ? toReasonFormValues(saved.reason, saved.pairs) : EMPTY_REASON_FORM,
    schema,
    (values) => mutation.mutateAsync(values).catch(() => undefined),
    () => focusFirstError(page.current),
  );

  useEffect(() => {
    if (refused.length === 0) return;
    void form.validate('change');
    focusFirstError(page.current);
  }, [refused, form]);

  const changed = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useDiscardGuard(changed, { allowLeave: () => leaving.current });

  return (
    <>
      <Workspace>
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <MessageSquareTextIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>{title}</WorkspaceTitle>
            <WorkspaceDescription>{description}</WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <div className="flex flex-col gap-8" inert={mutation.isPending} ref={page}>
            {mutation.isError && !isDuplicateName(mutation.error) && (
              <ErrorAlert
                description={serverMessage(mutation.error) ?? t('reasons.form.save-error')}
                title={t('reasons.form.save-error-title')}
              />
            )}
            {failure && <PairsFailedAlert {...failure} />}
            <form
              id={FORM_ID}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <ReasonFields form={form} saved={stored.reason} />
            </form>
            <FieldSet>
              <FieldLegend>{t('reasons.form.where-used')}</FieldLegend>
              <FieldDescription>{t('reasons.form.where-used-description')}</FieldDescription>
              <QueryBoundary
                errorComponent={({ error, reset }) => (
                  <LoadError
                    description={t('reasons.form.load-error-description')}
                    error={error}
                    reset={reset}
                    title={t('reasons.form.load-error-title')}
                  />
                )}
                pendingFallback={<FieldSkeleton label={t('reasons.form.program')} required />}
                resetKey="reason-pairs"
              >
                <PairsFields form={form} />
              </QueryBoundary>
            </FieldSet>
          </div>
          <DiscardChangesDialog description={discardDescription} {...guard.dialog} />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter>
        <Button disabled={mutation.isPending} onClick={onCancel} size="lg" variant="outline">
          {t('reasons.form.cancel')}
        </Button>
        <Button disabled={mutation.isPending} form={FORM_ID} size="lg" type="submit">
          {mutation.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </WorkspaceFooter>
    </>
  );
}

function PairsFailedAlert({ failed, error }: { failed: PairRef[]; error: unknown }) {
  const { t } = useTranslation();
  const { data: programs } = useQuery(LOOKUPS.programs);
  const { data: types } = useQuery(LOOKUPS.facilityTypes);
  const name = pairNamer(t, programs, types);
  const reason = failed.length === 1 ? serverMessage(error) : undefined;
  return (
    <ErrorAlert
      description={[t('reasons.form.pairs-error', { pairs: failed.map(name).join('; ') }), reason]
        .filter(Boolean)
        .join(' ')}
      title={t('reasons.form.pairs-error-title')}
    />
  );
}

function LookupField(props: { label: string; required?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <LookupBoundary
      errorDescription={t('reasons.form.load-error-description')}
      errorTitle={t('reasons.form.load-error-title')}
      {...props}
    />
  );
}

function ReasonFields({ form, saved }: { form: ReasonForm; saved: Reason | undefined }) {
  const { t } = useTranslation();

  return (
    <FieldGroup>
      <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
        <div className="@3xl/main:col-span-2">
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                autoComplete="off"
                dir="auto"
                label={t('reasons.form.name')}
                required
              />
            )}
          </form.AppField>
        </div>
        <LookupField label={t('reasons.form.category')} required>
          <CategoryField form={form} saved={saved} />
        </LookupField>
        <LookupField label={t('reasons.form.type')} required>
          <TypeField form={form} saved={saved} />
        </LookupField>
        <div className="@3xl/main:col-span-2">
          <LookupField label={t('reasons.form.tags')}>
            <TagsInput form={form} />
          </LookupField>
        </div>
        <form.AppField name="isFreeTextAllowed">
          {(field) => (
            <field.SwitchField
              description={t('reasons.form.free-text-description')}
              label={t('reasons.form.free-text')}
            />
          )}
        </form.AppField>
      </div>
    </FieldGroup>
  );
}

type SavedFieldProps = { form: ReasonForm; saved: Reason | undefined };

function CategoryField(props: SavedFieldProps) {
  const { data: codes } = useSuspenseQuery(LOOKUPS.categories);
  return <CodeField codes={codes} kind="category" {...props} />;
}

function TypeField(props: SavedFieldProps) {
  const { data: codes } = useSuspenseQuery(LOOKUPS.types);
  return <CodeField codes={codes} kind="type" {...props} />;
}

type CodeFieldProps = SavedFieldProps & {
  kind: 'category' | 'type';
  codes: string[];
};

/** Category or type: fixed once the reason is saved, so it shows the stored code even when it isn't offered. */
function CodeField({ form, kind, codes, saved }: CodeFieldProps) {
  const { t } = useTranslation();
  const labels = useReasonLabels();
  const current = kind === 'category' ? saved?.reasonCategory : saved?.reasonType;
  const items = useMemo(
    () =>
      (current && !codes.includes(current) ? [...codes, current] : codes).map((code) => ({
        value: code,
        label: labels[kind](code),
      })),
    [codes, current, labels, kind],
  );
  return (
    <form.AppField name={kind}>
      {(field) => (
        <field.SelectField
          description={
            saved && kind === 'category' ? t('reasons.form.fixed-description') : undefined
          }
          disabled={Boolean(saved)}
          items={items}
          label={t(kind === 'category' ? 'reasons.form.category' : 'reasons.form.type')}
          required
        />
      )}
    </form.AppField>
  );
}

function TagsInput({ form }: { form: ReasonForm }) {
  const { t } = useTranslation();
  const { data: suggestions } = useSuspenseQuery(LOOKUPS.tags);
  return (
    <form.AppField name="tags">
      {(field) => (
        <field.TagsField
          description={t('reasons.form.tags-description')}
          label={t('reasons.form.tags')}
          placeholder={t('reasons.form.tags-placeholder')}
          refusedMessage={(reason) =>
            t(
              reason === 'duplicate'
                ? 'reasons.form.tag-duplicate'
                : reason === 'too-long'
                  ? 'reasons.form.tag-too-long'
                  : 'reasons.form.tag-too-short',
            )
          }
          removeLabel={(tag) => t('reasons.form.remove-tag', { tag })}
          suggestions={suggestions}
        />
      )}
    </form.AppField>
  );
}

function PairsFields({ form }: { form: ReasonForm }) {
  const { t } = useTranslation();
  const rows = useStore(form.store, (state) => state.values.pairs);
  const { data: programs } = useSuspenseQuery(LOOKUPS.programs);
  const { data: types } = useSuspenseQuery(LOOKUPS.facilityTypes);
  const name = useMemo(() => pairNamer(t, programs, types), [t, programs, types]);
  const programNames = useMemo(
    () => new Map(programs.map((program) => [program.id, programName(program)])),
    [programs],
  );
  const typeNames = useMemo(
    () => new Map(types.map((type) => [type.id, facilityTypeName(type)])),
    [types],
  );
  const table = useRef<HTMLDivElement>(null);
  const unknown = t('reasons.form.unknown');

  const removeRow = (index: number) => {
    form.removeFieldValue('pairs', index);
    // The pressed button is gone, so the next row's takes the focus, or the program picker.
    requestAnimationFrame(() => {
      const buttons = table.current?.querySelectorAll<HTMLElement>('[data-remove-pair]');
      const next = buttons?.[Math.min(index, buttons.length - 1)];
      (next ?? document.getElementById('programId'))?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <AddPairRow form={form} rows={rows} />
      <div ref={table}>
        <DataTableCard>
          {rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinnedIcon />
                </EmptyMedia>
                <EmptyTitle>{t('reasons.form.no-pairs-title')}</EmptyTitle>
                <EmptyDescription>{t('reasons.form.no-pairs-description')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table density="comfortable">
              <TableHeader surface="muted">
                <TableRow>
                  <TableHead>{t('reasons.form.program')}</TableHead>
                  <TableHead>{t('reasons.form.facility-type')}</TableHead>
                  <TableHead>{t('reasons.form.show')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('reasons.form.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const pair = name(row);
                  return (
                    <TableRow key={pairKey(row)}>
                      <TableCell>
                        <span className="whitespace-normal font-medium" dir="auto">
                          {programNames.get(row.programId) ?? unknown}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-normal" dir="auto">
                          {typeNames.get(row.facilityTypeId) ?? unknown}
                        </span>
                      </TableCell>
                      <TableCell>
                        <form.AppField name={`pairs[${index}].show`}>
                          {(field) => (
                            <field.SwitchField
                              label={t('reasons.form.row-label', {
                                field: t('reasons.form.show'),
                                pair,
                              })}
                              layout="inline"
                            />
                          )}
                        </form.AppField>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            aria-label={t('reasons.form.remove-pair', { pair })}
                            data-remove-pair
                            onClick={() => removeRow(index)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
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

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

function AddPairRow({ form, rows }: { form: ReasonForm; rows: PairDraft[] }) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(LOOKUPS.programs);
  const { data: types } = useSuspenseQuery(LOOKUPS.activeFacilityTypes);
  const programItems = useMemo(
    () =>
      programs.map((program) => ({ value: program.id, label: programName(program) })).sort(byLabel),
    [programs],
  );
  const typeItems = useMemo(
    () => types.map((type) => ({ value: type.id, label: facilityTypeName(type) })).sort(byLabel),
    [types],
  );
  const schema = useMemo(() => addPairSchema(rows), [rows]);

  const addForm = useAppForm({
    defaultValues: { programId: '', facilityTypeId: '', show: true },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value, formApi }) => {
      form.pushFieldValue('pairs', value);
      formApi.reset();
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void addForm.handleSubmit();
      }}
    >
      <FieldGroup>
        <div className="flex flex-col gap-x-4 gap-y-5 @2xl/main:flex-row @2xl/main:items-start">
          <div className="min-w-0 flex-1">
            <addForm.AppField name="programId">
              {(field) => (
                <field.SelectField
                  items={programItems}
                  label={t('reasons.form.program')}
                  required
                />
              )}
            </addForm.AppField>
          </div>
          <div className="min-w-0 flex-1">
            <addForm.AppField name="facilityTypeId">
              {(field) => (
                <field.SelectField
                  items={typeItems}
                  label={t('reasons.form.facility-type')}
                  required
                />
              )}
            </addForm.AppField>
          </div>
          <div className="@2xl/main:w-28 @2xl/main:pt-6">
            <addForm.AppField name="show">
              {(field) => (
                <field.SwitchField
                  description={t('reasons.form.show-description')}
                  label={t('reasons.form.show')}
                />
              )}
            </addForm.AppField>
          </div>
          <div className="@2xl/main:pt-6">
            <Button type="submit" variant="outline" width="full">
              <PlusIcon data-icon="inline-start" />
              {t('reasons.form.add-pair')}
            </Button>
          </div>
        </div>
      </FieldGroup>
    </form>
  );
}

type ReasonEditorSkeletonProps = {
  title: string;
  description: string;
};

export function ReasonEditorSkeleton({ title, description }: ReasonEditorSkeletonProps) {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <MessageSquareTextIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{title}</WorkspaceTitle>
          <WorkspaceDescription>{description}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
          <div className="@3xl/main:col-span-2">
            <FieldSkeleton label={t('reasons.form.name')} required />
          </div>
          <FieldSkeleton label={t('reasons.form.category')} required />
          <FieldSkeleton label={t('reasons.form.type')} required />
          <div className="@3xl/main:col-span-2">
            <FieldSkeleton label={t('reasons.form.tags')} />
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
