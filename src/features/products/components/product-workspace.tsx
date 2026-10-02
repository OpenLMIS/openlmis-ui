import type { HistoryState } from '@tanstack/react-router';
import { PackageIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Block } from '@/components/skeleton-block';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { WorkspaceSlots, WorkspaceTabs } from '@/components/workspace-tabs';
import { productName } from '@/features/products/lib/product-name';
import type { ProductDetail } from '@/features/products/lib/types';

const PRODUCT_TABS = [
  { to: '/administration/products/$id/general', labelKey: 'products.edit.tabs.general' },
  { to: '/administration/products/$id/programs', labelKey: 'products.edit.tabs.programs' },
  {
    to: '/administration/products/$id/facility-types',
    labelKey: 'products.edit.tabs.facility-types',
  },
  {
    to: '/administration/products/$id/kit-unpack-list',
    labelKey: 'products.edit.tabs.kit-unpack-list',
  },
] as const;

type ProductWorkspaceProps = {
  productId: string;
  product?: ProductDetail;
  tabState?: HistoryState;
  children: ReactNode;
};

export function ProductWorkspace({
  productId,
  product,
  tabState,
  children,
}: ProductWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <WorkspaceSlots>
      <Workspace>
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <PackageIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>
              {product
                ? t('products.edit.title', {
                    product: productName(product),
                  })
                : t('products.edit.crumb')}
            </WorkspaceTitle>
            {product ? (
              <WorkspaceDescription>
                {t('products.edit.description', { code: product.productCode })}
              </WorkspaceDescription>
            ) : (
              <Block className="h-5 w-56 py-0.5" />
            )}
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <WorkspaceTabs
            label={t('products.edit.tabs-label')}
            linkState={tabState}
            tabs={PRODUCT_TABS.map(({ to, labelKey }) => ({
              to,
              params: { id: productId },
              label: t(labelKey),
            }))}
          >
            {children}
          </WorkspaceTabs>
        </WorkspaceContent>
      </Workspace>
    </WorkspaceSlots>
  );
}
