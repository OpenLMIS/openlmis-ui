import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  return (
    <div className="flex-1 @2xl/main:flex-none">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={<Button size="lg" variant="outline" width="full" />}
        >
          {t('requisitions.edit.skip')}
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" width="content">
          <DropdownMenuItem onClick={() => onSet('all', true)}>
            {t('requisitions.edit.skip-all')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSet('page', true)}>
            {t('requisitions.edit.skip-page')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSet('all', false)}>
            {t('requisitions.edit.skip-none')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
