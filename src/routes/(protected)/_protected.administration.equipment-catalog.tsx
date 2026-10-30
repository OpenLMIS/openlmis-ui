import { createFileRoute } from '@tanstack/react-router';
import { BookOpenIcon, RefrigeratorIcon } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  CsvTransfer,
  type CsvTransferCopy,
  CsvTransferSkeleton,
} from '@/components/file-transfer/csv-transfer';
import { TransferInstructionsDialog } from '@/components/file-transfer/transfer-instructions-dialog';
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
import { CCE_CATALOG_API } from '@/features/cce-catalog/api/api';
import {
  catalogUploadErrorText,
  catalogUploadIssue,
} from '@/features/cce-catalog/lib/upload-errors';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const instructionsSearchSchema = z.object({
  instructions: z.literal(true).optional().catch(undefined),
});
type InstructionsSearch = z.infer<typeof instructionsSearchSchema>;
const CLOSED_DIALOGS = { instructions: undefined };

export const Route = createFileRoute('/(protected)/_protected/administration/equipment-catalog')({
  validateSearch: instructionsSearchSchema,
  loader: ({ context: { queryClient } }) => requireRight(queryClient, RIGHTS.cceManage),
  pendingComponent: EquipmentCatalogPagePending,
  component: EquipmentCatalogPage,
});

function useCatalogCopy(): CsvTransferCopy {
  const { t } = useTranslation();
  return {
    exportLabel: t('cce-catalog.export-label'),
    uploadLabel: t('cce-catalog.upload-label'),
    uploadError: t('cce-catalog.upload-error'),
  };
}

function EquipmentCatalogHeader({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <RefrigeratorIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('cce-catalog.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('cce-catalog.description')}</WorkspaceDescription>
      </WorkspaceHeading>
      <WorkspaceActions>{children}</WorkspaceActions>
    </WorkspaceHeader>
  );
}

function EquipmentCatalogPage() {
  const { t } = useTranslation();
  const copy = useCatalogCopy();
  const instructions = Route.useSearch({ select: (search) => search.instructions });
  const { openDialog, closeDialog } = useSearchNavigation<InstructionsSearch>(CLOSED_DIALOGS);
  const instructionsButton = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Workspace width="narrow">
        <EquipmentCatalogHeader>
          <Button
            onClick={() => void openDialog({ instructions: true })}
            ref={instructionsButton}
            size="lg"
            variant="outline"
          >
            <BookOpenIcon data-icon="inline-start" />
            {t('file-transfer.instructions-label')}
          </Button>
        </EquipmentCatalogHeader>
        <WorkspaceContent>
          <CsvTransfer
            api={CCE_CATALOG_API}
            copy={copy}
            describeUploadError={(error) => {
              const issue = catalogUploadIssue(error);
              return issue && catalogUploadErrorText(issue, t);
            }}
          />
        </WorkspaceContent>
      </Workspace>
      <TransferInstructionsDialog
        finalFocus={instructionsButton}
        note={t('cce-catalog.instructions-note')}
        onClose={closeDialog}
        open={Boolean(instructions)}
        steps={{
          export: t('cce-catalog.instructions-export'),
          edit: t('cce-catalog.instructions-edit'),
          upload: t('file-transfer.instructions-upload'),
        }}
      />
    </>
  );
}

function EquipmentCatalogPagePending() {
  const { t } = useTranslation();
  return (
    <Workspace width="narrow">
      <EquipmentCatalogHeader>
        <Button disabled size="lg" variant="outline">
          <BookOpenIcon data-icon="inline-start" />
          {t('file-transfer.instructions-label')}
        </Button>
      </EquipmentCatalogHeader>
      <WorkspaceContent>
        <CsvTransferSkeleton copy={useCatalogCopy()} />
      </WorkspaceContent>
    </Workspace>
  );
}
