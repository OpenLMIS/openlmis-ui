import { createFileRoute } from '@tanstack/react-router';
import { BookOpenIcon, FileSpreadsheetIcon } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  IdealStockAmountsUpload,
  IdealStockAmountsUploadSkeleton,
} from '@/features/ideal-stock-amounts/components/ideal-stock-amounts-upload';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const instructionsSearchSchema = z.object({
  instructions: z.literal(true).optional().catch(undefined),
});
type InstructionsSearch = z.infer<typeof instructionsSearchSchema>;
const CLOSED_DIALOGS = { instructions: undefined };
const INSTRUCTION_STEPS = [
  {
    title: 'ideal-stock-amounts.instructions-export-title',
    body: 'ideal-stock-amounts.instructions-export',
  },
  {
    title: 'ideal-stock-amounts.instructions-edit-title',
    body: 'ideal-stock-amounts.instructions-edit',
  },
  {
    title: 'ideal-stock-amounts.instructions-upload-title',
    body: 'ideal-stock-amounts.instructions-upload',
  },
] as const;

export const Route = createFileRoute('/(protected)/_protected/administration/ideal-stock-amounts')({
  validateSearch: instructionsSearchSchema,
  loader: ({ context: { queryClient } }) =>
    requireRight(queryClient, RIGHTS.systemIdealStockAmountsManage),
  pendingComponent: IdealStockAmountsPagePending,
  component: IdealStockAmountsPage,
});

function IdealStockAmountsHeader({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <FileSpreadsheetIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('ideal-stock-amounts.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('ideal-stock-amounts.description')}</WorkspaceDescription>
      </WorkspaceHeading>
      <WorkspaceActions>{children}</WorkspaceActions>
    </WorkspaceHeader>
  );
}

function IdealStockAmountsPage() {
  const { t, i18n } = useTranslation();
  const instructions = Route.useSearch({ select: (search) => search.instructions });
  const { openDialog, closeDialog } = useSearchNavigation<InstructionsSearch>(CLOSED_DIALOGS);
  const instructionsButton = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Workspace width="narrow">
        <IdealStockAmountsHeader>
          <Button
            onClick={() => void openDialog({ instructions: true })}
            ref={instructionsButton}
            size="lg"
            variant="outline"
          >
            <BookOpenIcon data-icon="inline-start" />
            {t('ideal-stock-amounts.instructions-label')}
          </Button>
        </IdealStockAmountsHeader>
        <WorkspaceContent>
          <IdealStockAmountsUpload />
        </WorkspaceContent>
      </Workspace>
      <Dialog open={Boolean(instructions)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent finalFocus={instructionsButton} layout="scroll">
          <DialogHeader>
            <DialogTitle>{t('ideal-stock-amounts.instructions-label')}</DialogTitle>
            <DialogDescription>
              {t('ideal-stock-amounts.instructions-description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
            <ol className="flex flex-col gap-4">
              {INSTRUCTION_STEPS.map((step, index) => (
                <li className="flex gap-3" key={step.title}>
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs"
                  >
                    {new Intl.NumberFormat(i18n.language).format(index + 1)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-medium">{t(step.title)}</h3>
                    <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                      {t(step.body)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('ideal-stock-amounts.instructions-note')}
            </p>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}

function IdealStockAmountsPagePending() {
  const { t } = useTranslation();
  return (
    <Workspace width="narrow">
      <IdealStockAmountsHeader>
        <Button disabled size="lg" variant="outline">
          <BookOpenIcon data-icon="inline-start" />
          {t('ideal-stock-amounts.instructions-label')}
        </Button>
      </IdealStockAmountsHeader>
      <WorkspaceContent>
        <IdealStockAmountsUploadSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
