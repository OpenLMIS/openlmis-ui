import { useCallback, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';

export function useRequisitionComment(editor?: RequisitionEditor, pending = false) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(() => !!editor?.draft.draftStatusMessage);
  const subscribe = useCallback(
    (notify: () => void) => {
      const sub = editor?.form.store.subscribe(notify);
      return () => sub?.unsubscribe();
    },
    [editor?.form.store],
  );
  const hasComment = useSyncExternalStore(subscribe, () => !!editor?.draft.draftStatusMessage);
  if (hasComment && !opened) setOpened(true);
  const open = opened || hasComment;
  return {
    action:
      editor && !open ? (
        <Button size="lg" variant="outline" disabled={pending} onClick={() => setOpened(true)}>
          {t('requisitions.edit.add-comment')}
        </Button>
      ) : null,
    field:
      editor && open ? (
        <div className="flex flex-col gap-2">
          <editor.form.AppField name="draft.draftStatusMessage">
            {(field) => (
              <field.TextareaField
                label={t('requisitions.edit.comment-label')}
                disabled={pending}
              />
            )}
          </editor.form.AppField>
          <div>
            <Button
              size="lg"
              disabled={pending}
              variant="outline"
              onClick={() => {
                editor.form.setFieldValue('draft.draftStatusMessage', '');
                setOpened(false);
              }}
            >
              {t('requisitions.edit.remove-comment')}
            </Button>
          </div>
        </div>
      ) : null,
  };
}
