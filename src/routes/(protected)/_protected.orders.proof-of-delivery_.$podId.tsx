import { createFileRoute } from '@tanstack/react-router';
import { ClipboardCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
export const Route = createFileRoute('/(protected)/_protected/orders/proof-of-delivery_/$podId')({
  component: PodPlaceholder,
  staticData: { crumbKey: 'orders.pod.detail-title' },
});
function PodPlaceholder() {
  const { t } = useTranslation();
  return (
    <Workspace width="wide">
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ClipboardCheckIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('orders.pod.detail-title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('orders.pod.detail-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
    </Workspace>
  );
}
