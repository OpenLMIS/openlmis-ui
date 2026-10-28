import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
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
    <div className="w-full @2xl/main:w-auto">
      <ButtonGroup aria-label={t('requisitions.edit.skip-lines')} width="full">
        <Button
          disabled={editing.pending}
          size="lg"
          variant="outline"
          onClick={() => set(all, true)}
        >
          {t('requisitions.edit.skip-all')}
        </Button>
        <Button
          disabled={editing.pending}
          size="lg"
          variant="outline"
          onClick={() => set(page, true)}
        >
          {t('requisitions.edit.skip-page')}
        </Button>
        <Button
          disabled={editing.pending}
          size="lg"
          variant="outline"
          onClick={() => set(all, false)}
        >
          {t('requisitions.edit.skip-none')}
        </Button>
      </ButtonGroup>
    </div>
  );
}
