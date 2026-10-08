import { revalidateLogic } from '@tanstack/react-form';
import { useIsMutating, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  SkeletonLine,
  SwitchSkeleton,
  serverMessage,
} from '@/components/dialog-parts';
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
import { FieldGroup } from '@/components/ui/field';
import { createFacilityType, updateFacilityType } from '@/features/facility-types/api/api';
import { facilityTypeDetailOptions } from '@/features/facility-types/api/queries';
import {
  duplicateField,
  EMPTY_FACILITY_TYPE_FORM,
  type FacilityTypeFormValues,
  facilityTypeFormSchema,
  type TakenFacilityType,
  toFacilityTypeBody,
  toFacilityTypeFormValues,
} from '@/features/facility-types/lib/facility-type-form';
import { facilityTypesOptions } from '@/features/reference-data/api/queries';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import type { FacilityType } from '@/features/reference-data/lib/types';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';

const NO_TYPES: FacilityType[] = [];

const saveKey = (target: string) => [...queryKeys.facilityTypes.all, 'save', target] as const;

type FacilityTypeFormDialogProps = {
  target: 'new' | string | undefined;
  onClose: () => void;
};

export function FacilityTypeFormDialog({ target, onClose }: FacilityTypeFormDialogProps) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? 'new') }) > 0;

  return (
    <FormDialog {...dialogProps(isSaving)}>
      {shown && <FacilityTypeDialogContent onDone={close} target={shown} />}
    </FormDialog>
  );
}

function FacilityTypeDialogContent({ target, onDone }: { target: string; onDone: () => void }) {
  const { t } = useTranslation();
  const isNew = target === 'new';
  const title = t(isNew ? 'facility-types.form.create-title' : 'facility-types.form.edit-title');
  const opening = useOpening();

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound description={t('facility-types.form.not-found')} title={title} />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('facility-types.form.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={
        <FacilityTypeFormSkeleton
          submitLabel={t(isNew ? 'facility-types.form.create' : 'facility-types.form.save')}
          title={title}
        />
      }
      resetKey={target}
    >
      {isNew ? (
        <FacilityTypeForm onDone={onDone} />
      ) : (
        <ExistingFacilityType key={target} onDone={onDone} opening={opening} typeId={target} />
      )}
    </QueryBoundary>
  );
}

type ExistingFacilityTypeProps = { typeId: string; opening: number; onDone: () => void };

function ExistingFacilityType({ typeId, opening, onDone }: ExistingFacilityTypeProps) {
  const { data: type } = useSuspenseQuery(facilityTypeDetailOptions(typeId, opening));
  return <FacilityTypeForm onDone={onDone} type={type} />;
}

type FacilityTypeFormProps = {
  type?: FacilityType;
  onDone: () => void;
};

function FacilityTypeForm({ type, onDone }: FacilityTypeFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: types = NO_TYPES } = useQuery({ ...facilityTypesOptions(), staleTime: 0 });
  const [refused, setRefused] = useState<TakenFacilityType[]>([]);
  const schema = useMemo(
    () => facilityTypeFormSchema([...types, ...refused], type?.id),
    [types, refused, type?.id],
  );

  const save = useSessionMutation({
    mutationKey: saveKey(type?.id ?? 'new'),
    mutationFn: (values: FacilityTypeFormValues) => {
      const body = toFacilityTypeBody(values, type);
      return type ? updateFacilityType(type.id, body) : createFacilityType(body);
    },
    onSuccess: (saved) => {
      toast.success(
        t(type ? 'facility-types.form.updated-title' : 'facility-types.form.created-title'),
        {
          description: t(type ? 'facility-types.form.updated' : 'facility-types.form.created', {
            type: facilityTypeName(saved),
          }),
        },
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.facilityTypes.all,
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
    },
    onError: (error, values) => {
      const field = duplicateField(error);
      if (!field) return;
      setRefused((taken) => [
        ...taken,
        {
          id: `refused-${taken.length}`,
          code: field === 'code' ? values.code : '',
          name: field === 'name' ? values.name : null,
        },
      ]);
    },
  });
  const refusedField = duplicateField(save.error);

  const form = useAppForm({
    defaultValues: type ? toFacilityTypeFormValues(type) : EMPTY_FACILITY_TYPE_FORM,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
  });

  useEffect(() => {
    if (refused.length > 0) void form.validate('change');
  }, [refused, form]);

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>
          {t(type ? 'facility-types.form.edit-title' : 'facility-types.form.create-title')}
        </FormDialogTitle>
        <FormDialogDescription>
          {t(
            type
              ? 'facility-types.form.edit-description'
              : 'facility-types.form.create-description',
          )}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {save.isError && !refusedField && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('facility-types.form.save-error')}
              title={t('facility-types.form.save-error-title')}
            />
          )}
          <form.AppField name="code">
            {(field) => (
              <field.TextField
                autoComplete="off"
                description={type ? t('facility-types.form.code-locked') : undefined}
                dir="ltr"
                disabled={Boolean(type)}
                label={t('facility-types.form.code')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="name">
            {(field) => (
              <field.TextField autoComplete="off" label={t('facility-types.form.name')} required />
            )}
          </form.AppField>
          <form.AppField name="displayOrder">
            {(field) => (
              <field.NumberField
                description={t('facility-types.form.display-order-description')}
                label={t('facility-types.form.display-order')}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="active">
            {(field) => (
              <field.SwitchField
                description={t('facility-types.form.active-description')}
                label={t('facility-types.form.active')}
              />
            )}
          </form.AppField>
          <form.AppField name="primaryHealthCare">
            {(field) => (
              <field.SwitchField
                description={t('facility-types.form.primary-health-care-description')}
                label={t('facility-types.form.primary-health-care')}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>
          {t(type ? 'facility-types.form.save' : 'facility-types.form.create')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function FacilityTypeFormSkeleton({ title, submitLabel }: { title: string; submitLabel: string }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('facility-types.form.code')} required />
          <FieldSkeleton label={t('facility-types.form.name')} required />
          <FieldSkeleton label={t('facility-types.form.display-order')} required />
          <SwitchSkeleton />
          <SwitchSkeleton />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{submitLabel}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
