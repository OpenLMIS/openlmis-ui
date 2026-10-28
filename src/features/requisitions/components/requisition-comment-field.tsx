import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';

export function useRequisitionComment(editor?: RequisitionEditor) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const open = opened || !!editor?.draft.draftStatusMessage;
  return {
    action:
      editor && !open ? (
        <Button size="lg" variant="outline" onClick={() => setOpened(true)}>
          {t('requisitions.edit.add-comment')}
        </Button>
      ) : null,
    field:
      editor && open ? (
        <div className="flex flex-col gap-2">
          <editor.form.AppField name="draft.draftStatusMessage">
            {(field) => <field.TextareaField label={t('requisitions.edit.comment-label')} />}
          </editor.form.AppField>
          <div>
            <Button
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
