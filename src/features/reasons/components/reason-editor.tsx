import { revalidateLogic, useStore } from '@tanstack/react-form';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { ParseKeys, TFunction } from 'i18next';
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
  DialogLoadError,
  ErrorAlert,
  FieldSkeleton,
  LookupBoundary,
  SwitchRowSkeleton,
  SwitchSkeleton,
  serverMessage,
} from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import type { TagRefusal } from '@/components/form/tags';
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
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Block } from '@/components/skeleton-block';
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
  type PairRef,
  pairKey,
  type ReasonFormValues,
  reasonFormSchema,
  toReasonBody,
  toReasonFormValues,
} from '@/features/reasons/lib/reason-form';
import { saveReason } from '@/features/reasons/lib/save-reason';
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

function pairNames(t: TFunction, programs: Program[] = [], types: FacilityType[] = []) {
  const programNames = new Map(programs.map((program) => [program.id, programName(program)]));
  const typeNames = new Map(types.map((type) => [type.id, facilityTypeName(type)]));
  const unknown = t('reasons.form.unknown');
  const program = (id: string) => programNames.get(id) ?? unknown;
  const facilityType = (id: string) => typeNames.get(id) ?? unknown;
  return {
    program,
    facilityType,
    pair: (ref: PairRef) =>
      t('reasons.form.pair', {
        program: program(ref.programId),
        facilityType: facilityType(ref.facilityTypeId),
      }),
  };
}

const TAG_REFUSED_KEYS = {
  'too-short': 'reasons.form.tag-too-short',
  'too-long': 'reasons.form.tag-too-long',
  duplicate: 'reasons.form.tag-duplicate',
} as const satisfies Record<TagRefusal, ParseKeys>;

type ReasonEditorProps = {
  /** None adds a new reason. */
  saved?: { reason: Reason; pairs: ValidReason[] };
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
  const { data: reasons } = useSuspenseQuery(reasonsOptions());
  // After a partial save, the next one diffs against what the server now holds.
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
      void queryClient.invalidateQueries({ queryKey: LOOKUPS.tags.queryKey });
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
  const pairCount = useStore(form.store, (state) => state.values.pairs.length);
  const guard = useDiscardGuard(changed, { allowLeave: () => leaving.current });

  return (
    <>
      <Workspace width="narrow">
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
                pendingFallback={<PairsSkeleton rows={pairCount} />}
                resetKey="reason-pairs"
              >
                <PairsFields form={form} />
              </QueryBoundary>
            </FieldSet>
          </div>
          <DiscardChangesDialog description={discardDescription} {...guard.dialog} />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled={mutation.isPending} onClick={onCancel} size="lg" variant="outline">
          {t('reasons.form.cancel')}
        </Button>
        <Button
          disabled={mutation.isPending}
          focusableWhenDisabled
          form={FORM_ID}
          size="lg"
          type="submit"
        >
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
  const names = pairNames(t, programs, types);
  const reason = failed.length === 1 ? serverMessage(error) : undefined;
  return (
    <ErrorAlert
      description={[
        t('reasons.form.pairs-error', { pairs: failed.map(names.pair).join('; ') }),
        reason,
      ]
        .filter(Boolean)
        .join(' ')}
      title={t('reasons.form.pairs-error-title')}
    />
  );
}

function LookupField(props: {
  label: string;
  required?: boolean;
  description?: string | undefined;
  children: ReactNode;
}) {
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
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
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
        <LookupField
          description={t('reasons.form.tags-description')}
          label={t('reasons.form.tags')}
        >
          <TagsInput form={form} />
        </LookupField>
        <LookupField
          description={saved ? t('reasons.form.fixed-description') : undefined}
          label={t('reasons.form.category')}
          required
        >
          <CategoryField form={form} saved={saved} />
        </LookupField>
        <LookupField label={t('reasons.form.type')} required>
          <TypeField form={form} saved={saved} />
        </LookupField>
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

/** Fixed once saved, so it shows a stored code the options lack. */
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
          maxLength={255}
          minLength={3}
          refusedMessage={(reason) => t(TAG_REFUSED_KEYS[reason])}
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
  const names = useMemo(() => pairNames(t, programs, types), [t, programs, types]);
  const table = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);

  const removeRow = (index: number) => {
    form.removeFieldValue('pairs', index);
    // The pressed button is gone, so the next row's takes the focus, or Add.
    requestAnimationFrame(() => {
      const buttons = table.current?.querySelectorAll<HTMLElement>('[data-remove-pair]');
      const next = buttons?.[Math.min(index, buttons.length - 1)];
      (next ?? addButton.current)?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} ref={addButton} variant="outline">
          <PlusIcon data-icon="inline-start" />
          {t('reasons.form.add-pair-title')}
        </Button>
      </div>
      <AddPairDialog
        onAdd={(pair) => form.pushFieldValue('pairs', pair)}
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
                  const pair = names.pair(row);
                  return (
                    <TableRow key={pairKey(row)}>
                      <TableCell>
                        <span className="whitespace-normal font-medium" dir="auto">
                          {names.program(row.programId)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-normal" dir="auto">
                          {names.facilityType(row.facilityTypeId)}
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
                            variant="destructive"
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

type AddPairDialogProps = {
  open: boolean;
  rows: PairDraft[];
  onAdd: (pair: PairDraft) => void;
  onClose: () => void;
};

function AddPairDialog({ open, rows, onAdd, onClose }: AddPairDialogProps) {
  const { t } = useTranslation();
  const { shown, dialogProps } = useDialogTarget(open ? 'new' : undefined, onClose);
  const title = t('reasons.form.add-pair-title');

  return (
    <FormDialog {...dialogProps()}>
      {shown && (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <DialogLoadError
              error={error}
              errorTitle={t('reasons.form.load-error-title')}
              onRetry={reset}
              title={title}
            />
          )}
          pendingFallback={<AddPairSkeleton />}
          resetKey="add-pair"
        >
          <AddPairForm
            onAdd={(pair) => {
              onAdd(pair);
              onClose();
            }}
            rows={rows}
          />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

function AddPairForm({ rows, onAdd }: Pick<AddPairDialogProps, 'rows' | 'onAdd'>) {
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

  const form = useAppForm({
    defaultValues: { programId: '', facilityTypeId: '', show: true },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => onAdd(value),
  });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('reasons.form.add-pair-title')}</FormDialogTitle>
        <FormDialogDescription>{t('reasons.form.add-pair-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <form.AppField name="programId">
            {(field) => (
              <field.SelectField items={programItems} label={t('reasons.form.program')} required />
            )}
          </form.AppField>
          <form.AppField name="facilityTypeId">
            {(field) => (
              <field.SelectField
                items={typeItems}
                label={t('reasons.form.facility-type')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="show">
            {(field) => (
              <field.SwitchField
                description={t('reasons.form.show-description')}
                label={t('reasons.form.show')}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit>{t('reasons.form.add-pair')}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function AddPairSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('reasons.form.add-pair-title')}</FormDialogTitle>
        <FormDialogDescription>{t('reasons.form.add-pair-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('reasons.form.program')} required />
          <FieldSkeleton label={t('reasons.form.facility-type')} required />
          <SwitchSkeleton />
        </FieldGroup>
      </FormDialogBody>
    </>
  );
}

function PairsSkeleton({ rows }: { rows: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button disabled variant="outline">
          <PlusIcon data-icon="inline-start" />
          {t('reasons.form.add-pair-title')}
        </Button>
      </div>
      <DataTableCard>
        {rows === 0 ? (
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
              {Array.from({ length: rows }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have nothing else to key on.
                <TableRow key={index}>
                  <TableCell>
                    <Block className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Block className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Block className="h-4.5 w-8" shape="circle" />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Block className="size-7" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableCard>
    </div>
  );
}

type ReasonEditorSkeletonProps = {
  title: string;
  description: string;
  submitLabel: string;
  editing?: boolean;
};

export function ReasonEditorSkeleton({
  title,
  description,
  submitLabel,
  editing = false,
}: ReasonEditorSkeletonProps) {
  const { t } = useTranslation();
  return (
    <>
      <Workspace width="narrow">
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
          <div className="flex flex-col gap-8">
            <FieldGroup>
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
                <FieldSkeleton label={t('reasons.form.name')} required />
                <FieldSkeleton
                  description={t('reasons.form.tags-description')}
                  label={t('reasons.form.tags')}
                />
                <FieldSkeleton
                  description={editing ? t('reasons.form.fixed-description') : undefined}
                  label={t('reasons.form.category')}
                  required
                />
                <FieldSkeleton label={t('reasons.form.type')} required />
                <SwitchRowSkeleton label={t('reasons.form.free-text')} />
              </div>
            </FieldGroup>
            <FieldSet>
              <FieldLegend>{t('reasons.form.where-used')}</FieldLegend>
              <FieldDescription>{t('reasons.form.where-used-description')}</FieldDescription>
              <PairsSkeleton rows={editing ? 3 : 0} />
            </FieldSet>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled size="lg" variant="outline">
          {t('reasons.form.cancel')}
        </Button>
        <Button disabled size="lg">
          {submitLabel}
        </Button>
      </WorkspaceFooter>
    </>
  );
}
