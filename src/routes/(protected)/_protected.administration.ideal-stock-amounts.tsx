import { createFileRoute } from '@tanstack/react-router';
import { BookOpenIcon, FileSpreadsheetIcon } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CsvTransfer, CsvTransferSkeleton } from '@/components/file-transfer/csv-transfer';
import { TransferInstructionsDialog } from '@/components/file-transfer/transfer-instructions-dialog';
import type { CsvTransferCopy } from '@/components/file-transfer/types';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { IDEAL_STOCK_AMOUNTS_API } from '@/features/ideal-stock-amounts/api/api';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const instructionsSearchSchema = z.object({
  instructions: z.literal(true).optional().catch(undefined),
});
type InstructionsSearch = z.infer<typeof instructionsSearchSchema>;
const CLOSED_DIALOGS = { instructions: undefined };

export const Route = createFileRoute('/(protected)/_protected/administration/ideal-stock-amounts')({
  validateSearch: instructionsSearchSchema,
  loader: ({ context: { queryClient } }) =>
    requireRight(queryClient, RIGHTS.systemIdealStockAmountsManage),
  pendingComponent: IdealStockAmountsPagePending,
  component: IdealStockAmountsPage,
});

function useIdealStockAmountsCopy(): CsvTransferCopy {
  const { t } = useTranslation();
  return {
    exportLabel: t('ideal-stock-amounts.export-label'),
    uploadLabel: t('ideal-stock-amounts.upload-label'),
    uploadError: t('ideal-stock-amounts.upload-error'),
  };
}

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
  const { t } = useTranslation();
  const copy = useIdealStockAmountsCopy();
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
            {t('file-transfer.instructions-label')}
          </Button>
        </IdealStockAmountsHeader>
        <WorkspaceContent>
          <CsvTransfer api={IDEAL_STOCK_AMOUNTS_API} copy={copy} />
        </WorkspaceContent>
      </Workspace>
      <TransferInstructionsDialog
        finalFocus={instructionsButton}
        note={t('ideal-stock-amounts.instructions-note')}
        onClose={closeDialog}
        open={Boolean(instructions)}
        steps={{
          export: t('ideal-stock-amounts.instructions-export'),
          edit: t('ideal-stock-amounts.instructions-edit'),
        }}
      />
    </>
  );
}

function IdealStockAmountsPagePending() {
  const { t } = useTranslation();
  const copy = useIdealStockAmountsCopy();
  return (
    <Workspace width="narrow">
      <IdealStockAmountsHeader>
        <Button disabled size="lg" variant="outline">
          <BookOpenIcon data-icon="inline-start" />
          {t('file-transfer.instructions-label')}
        </Button>
      </IdealStockAmountsHeader>
      <WorkspaceContent>
        <CsvTransferSkeleton copy={copy} />
      </WorkspaceContent>
    </Workspace>
  );
}
