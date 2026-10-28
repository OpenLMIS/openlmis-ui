import { MessageSquareDashedIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { type ComponentProps, useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommentEntry } from '@/features/requisitions/components/status-message';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';

export function useDraftComment(editor?: RequisitionEditor) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const sub = editor?.form.store.subscribe(notify);
      return () => sub?.unsubscribe();
    },
    [editor?.form.store],
  );
  return useSyncExternalStore(subscribe, () => editor?.draft.draftStatusMessage ?? '');
}

export function DraftComment({
  text,
  pending,
  onEdit,
  onRemove,
}: {
  text: string;
  pending: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <CommentEntry
      badge={
        <Badge variant="outline">
          <MessageSquareDashedIcon data-icon="inline-start" />
          {t('requisitions.edit.draft-comment')}
        </Badge>
      }
      meta={t('requisitions.edit.draft-comment-note')}
      action={
        <CardActions
          label={t('requisitions.edit.draft-comment')}
          actions={[
            {
              id: 'edit',
              icon: <PencilIcon />,
              label: t('requisitions.edit.edit-comment'),
              disabled: pending,
              data: { 'data-comment-return': true },
              onSelect: onEdit,
            },
            {
              id: 'remove',
              icon: <Trash2Icon />,
              label: t('requisitions.edit.remove-comment'),
              destructive: true,
              disabled: pending,
              onSelect: onRemove,
            },
          ]}
        />
      }
    >
      {text}
    </CommentEntry>
  );
}

export function RequisitionCommentDialog({
  editor,
  open,
  pending,
  onClose,
  finalFocus,
}: {
  editor: RequisitionEditor;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  finalFocus?: ComponentProps<typeof FormDialog>['finalFocus'];
}) {
  return (
    <FormDialog
      open={open}
      finalFocus={finalFocus}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <CommentForm editor={editor} pending={pending} onClose={onClose} />
    </FormDialog>
  );
}

function CommentForm({
  editor,
  pending,
  onClose,
}: {
  editor: RequisitionEditor;
  pending: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const saved = editor.draft.draftStatusMessage;
  const write = (message: string) => {
    if (pending) return;
    editor.form.setFieldValue('draft.draftStatusMessage', message);
    onClose();
  };
  const form = useAppForm({
    defaultValues: { message: saved },
    onSubmit: ({ value }) => write(value.message.trim() ? value.message : ''),
  });
  return (
    <FormDialogForm onSubmit={() => void form.handleSubmit()}>
      <FormDialogHeader>
        <FormDialogTitle>
          {t(saved ? 'requisitions.edit.edit-comment' : 'requisitions.edit.add-comment')}
        </FormDialogTitle>
        <FormDialogDescription>{t('requisitions.edit.comment-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <form.AppField name="message">
          {(field) => (
            <field.TextareaField
              label={t('requisitions.edit.comment-label')}
              dir="auto"
              disabled={pending}
            />
          )}
        </form.AppField>
      </FormDialogBody>
      <FormDialogFooter>
        {saved && (
          <div className="flex flex-col sm:me-auto">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => write('')}
            >
              <Trash2Icon data-icon="inline-start" />
              {t('requisitions.edit.remove-comment')}
            </Button>
          </div>
        )}
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled={pending}>
          {t('requisitions.edit.save-comment')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
