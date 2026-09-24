import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
import { ComboboxField } from '@/components/form/form-fields';
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
import { FieldDescription, FieldGroup } from '@/components/ui/field';
import { allUsersOptions, userDetailsOptions } from '@/features/users/api/queries';
import {
  ErrorAlert,
  FieldSkeleton,
  RetryButton,
  SkeletonLine,
} from '@/features/users/components/dialog-parts';
import { fullName } from '@/features/users/lib/names';
import { mergeAssignments } from '@/features/users/lib/role-assignments';
import type { RoleAssignment } from '@/features/users/lib/types';

const importSchema = z.object({
  userId: z.string().nullable().refine(Boolean, 'users.roles.import.user-required'),
});

type ImportRolesDialogProps = {
  open: boolean;
  /** The user being edited, left out of the list. */
  userId: string;
  username: string;
  draft: RoleAssignment[];
  onImport: (assignments: RoleAssignment[], fromUsername: string) => void;
  onClose: () => void;
};

export function ImportRolesDialog({ open, onClose, ...props }: ImportRolesDialogProps) {
  const { shown, dialogProps } = useDialogTarget(open || undefined, onClose);
  return (
    <FormDialog {...dialogProps()}>
      {shown && <ImportRolesForm onDone={onClose} {...props} />}
    </FormDialog>
  );
}

function ImportRolesForm({
  userId,
  username,
  draft,
  onImport,
  onDone,
}: Omit<ImportRolesDialogProps, 'open' | 'onClose'> & { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useAppForm({
    defaultValues: { userId: null as string | null },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: importSchema },
    onSubmit: ({ value }) => {
      const source = value.userId
        ? queryClient.getQueryData(userDetailsOptions(value.userId).queryKey)
        : undefined;
      if (!source) return;
      onImport(source.user.roleAssignments, source.user.username);
      onDone();
    },
  });
  const sourceId = useStore(form.store, (state) => state.values.userId);
  const source = useQuery({ ...userDetailsOptions(sourceId ?? ''), enabled: Boolean(sourceId) });

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('users.roles.import.title')}</FormDialogTitle>
        <FormDialogDescription>
          {t('users.roles.import.description', { username })}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <form.AppField name="userId">
            {() => (
              <QueryBoundary
                errorComponent={({ reset }) => (
                  <ErrorAlert
                    action={<RetryButton onClick={reset} />}
                    description={t('users.roles.error-description')}
                    title={t('users.roles.import.load-error-title')}
                  />
                )}
                pendingFallback={<FieldSkeleton label={t('users.roles.import.user')} required />}
                resetKey="users"
              >
                <UserCombobox excludeId={userId} />
              </QueryBoundary>
            )}
          </form.AppField>
          {sourceId && source.isError && (
            <ErrorAlert
              action={<RetryButton onClick={() => void source.refetch()} />}
              description={t('users.roles.error-description')}
              title={t('users.roles.import.load-error-title')}
            />
          )}
          {sourceId && source.isPending && <SkeletonLine width="medium" />}
          {source.data && (
            <FieldDescription>
              {t(
                'users.roles.import.preview',
                mergeAssignments(draft, source.data.user.roleAssignments),
              )}
            </FieldDescription>
          )}
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('users.roles.form.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled={Boolean(sourceId) && !source.data}>
          {t('users.roles.import.submit')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

function UserCombobox({ excludeId }: { excludeId: string }) {
  const { t } = useTranslation();
  const { data: users } = useSuspenseQuery(allUsersOptions());
  const items = useMemo(
    () =>
      users
        .filter((user) => user.id !== excludeId)
        .map((user) => {
          const name = fullName(user);
          return { value: user.id, label: name ? `${user.username} (${name})` : user.username };
        }),
    [users, excludeId],
  );
  return (
    <ComboboxField
      clearLabel={t('users.roles.import.user-clear')}
      description={t('users.roles.import.user-description', { count: items.length })}
      emptyMessage={t('users.roles.import.user-empty')}
      items={items}
      label={t('users.roles.import.user')}
      placeholder={t('users.roles.import.user-placeholder')}
      required
    />
  );
}
