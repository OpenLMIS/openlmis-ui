import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { GridEditing } from '@/features/requisitions/components/requisition-grid';
import { canSkipLine } from '@/features/requisitions/lib/draft';
import type { RequisitionLine } from '@/features/requisitions/lib/lines';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export function SkipControls({
  editing,
  record,
  all,
  page,
}: {
  editing: GridEditing;
  record: RequisitionRecord;
  all: RequisitionLine[];
  page: RequisitionLine[];
}) {
  const { t } = useTranslation();
  const set = (lines: RequisitionLine[], skipped: boolean) => {
    editing.editor.setLines(
      lines
        .filter(
          (model) =>
            model.fullSupply &&
            (!skipped ||
              canSkipLine(
                { ...model.line, ...editing.editor.draft.lines[model.line.id] },
                record.template,
                { tab: 'fullSupply', status: record.status, emergency: record.emergency },
              )),
        )
        .map((model) => model.line.id),
      { skipped },
    );
  };
  return (
    <fieldset
      className="flex flex-wrap items-center gap-2"
      aria-label={t('requisitions.edit.skip-lines')}
    >
      <span>{t('requisitions.edit.skip-label')}</span>
      <Button size="sm" variant="outline" onClick={() => set(all, true)}>
        {t('requisitions.edit.skip-all')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => set(page, true)}>
        {t('requisitions.edit.skip-page')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => set(all, false)}>
        {t('requisitions.edit.skip-none')}
      </Button>
    </fieldset>
  );
}
