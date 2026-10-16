import { createFileRoute } from '@tanstack/react-router';
import { FileSpreadsheetIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
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

export const Route = createFileRoute('/(protected)/_protected/administration/ideal-stock-amounts')({
  loader: ({ context: { queryClient } }) =>
    requireRight(queryClient, RIGHTS.systemIdealStockAmountsManage),
  pendingComponent: IdealStockAmountsPagePending,
  component: IdealStockAmountsPage,
});

function IdealStockAmountsHeader() {
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
    </WorkspaceHeader>
  );
}

function IdealStockAmountsPage() {
  return (
    <Workspace width="narrow">
      <IdealStockAmountsHeader />
      <WorkspaceContent>
        <IdealStockAmountsUpload />
      </WorkspaceContent>
    </Workspace>
  );
}

function IdealStockAmountsPagePending() {
  return (
    <Workspace width="narrow">
      <IdealStockAmountsHeader />
      <WorkspaceContent>
        <IdealStockAmountsUploadSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
