import { useId } from 'react';
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
    <SkipButtons
      disabled={editing.pending}
      onSet={(target, skipped) => set(target === 'page' ? page : all, skipped)}
    />
  );
}

export function SkipButtons({
  disabled,
  onSet = () => {},
}: {
  disabled: boolean;
  onSet?: (target: 'all' | 'page', skipped: boolean) => void;
}) {
  const { t } = useTranslation();
  const label = useId();
  return (
    <div className="flex w-full items-center gap-2 @2xl/main:w-auto">
      <span id={label} className="text-sm">
        {t('requisitions.edit.skip')}
      </span>
      <ButtonGroup aria-labelledby={label} width="full">
        <Button disabled={disabled} size="lg" variant="outline" onClick={() => onSet('all', true)}>
          {t('requisitions.edit.skip-all')}
        </Button>
        <Button disabled={disabled} size="lg" variant="outline" onClick={() => onSet('page', true)}>
          {t('requisitions.edit.skip-page')}
        </Button>
        <Button disabled={disabled} size="lg" variant="outline" onClick={() => onSet('all', false)}>
          {t('requisitions.edit.skip-none')}
        </Button>
      </ButtonGroup>
    </div>
  );
}
