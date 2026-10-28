import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button disabled={editing.pending} size="lg" variant="outline" width="full" />}
        >
          {t('requisitions.edit.skip-lines')}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" width="auto">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => set(all, true)}>
              {t('requisitions.edit.skip-all')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => set(page, true)}>
              {t('requisitions.edit.skip-page')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => set(all, false)}>
              {t('requisitions.edit.skip-none')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
