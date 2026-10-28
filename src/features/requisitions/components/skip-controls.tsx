import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { GridEditing, GridModel } from '@/features/requisitions/components/requisition-grid';

export function SkipControls({
  editing,
  all,
  page,
}: {
  editing: GridEditing;
  all: GridModel[];
  page: GridModel[];
}) {
  const { t } = useTranslation();
  const set = (lines: GridModel[], skipped: boolean) => {
    if (editing.pending) return;
    editing.editor.setLines(
      lines
        .filter((model) => model.fullSupply && (!skipped || model.canSkip))
        .map((model) => model.line.id),
      { skipped },
    );
  };
  return (
    <fieldset disabled={editing.pending} className="flex flex-wrap items-center gap-2">
      <legend>{t('requisitions.edit.skip-label')}</legend>
      <Button size="lg" variant="outline" onClick={() => set(all, true)}>
        {t('requisitions.edit.skip-all')}
      </Button>
      <Button size="lg" variant="outline" onClick={() => set(page, true)}>
        {t('requisitions.edit.skip-page')}
      </Button>
      <Button size="lg" variant="outline" onClick={() => set(all, false)}>
        {t('requisitions.edit.skip-none')}
      </Button>
    </fieldset>
  );
}
