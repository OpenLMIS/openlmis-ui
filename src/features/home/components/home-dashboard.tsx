import {
  ClipboardCheckIcon,
  LayoutDashboardIcon,
  PackageIcon,
  TruckIcon,
  WrenchIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/query-boundary';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  approvalsOptions,
  convertCountOptions,
  equipmentStatusCountsOptions,
  openOrdersCountOptions,
} from '@/features/home/api/queries';
import { ApprovalsTable } from '@/features/home/components/approvals-table';
import { LegacyLink } from '@/features/home/components/dashboard-parts';
import { EquipmentStatusCard } from '@/features/home/components/equipment-status';
import { RequisitionStatusMeter } from '@/features/home/components/requisition-status-meter';
import { RequisitionsByPeriod } from '@/features/home/components/requisitions-by-period';
import { StatTile } from '@/features/home/components/stat-tile';
import { SystemNotifications } from '@/features/home/components/system-notifications';
import { type DashboardAccess, hasAnyWidget } from '@/features/home/lib/access';

/** The home page body: only the parts the user's rights allow, laid out by the room the page has. */
export function HomeDashboard({ access }: { access: DashboardAccess }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <QueryBoundary errorComponent={() => null} pendingFallback={null} resetKey="notifications">
        <SystemNotifications />
      </QueryBoundary>

      {!hasAnyWidget(access) && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutDashboardIcon />
            </EmptyMedia>
            <EmptyTitle>{t('home.empty-title')}</EmptyTitle>
            <EmptyDescription>{t('home.empty-description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <div className="grid grid-cols-2 gap-4 @5xl/main:grid-cols-4">
        {access.approve && (
          <StatTile
            action={
              <LegacyLink route="requisitions/approvalList">
                {t('home.tiles.approve-action')}
              </LegacyLink>
            }
            icon={<ClipboardCheckIcon />}
            label={t('home.tiles.approve')}
            query={approvalsOptions()}
            select={(approvals) => approvals.total}
          />
        )}
        {access.convert && (
          <StatTile
            action={
              <LegacyLink route="requisitions/convertToOrder">
                {t('home.tiles.convert-action')}
              </LegacyLink>
            }
            icon={<PackageIcon />}
            label={t('home.tiles.convert')}
            query={convertCountOptions()}
            select={(count) => count}
          />
        )}
        {access.orders && (
          <StatTile
            action={<LegacyLink route="orders/view">{t('home.tiles.orders-action')}</LegacyLink>}
            icon={<TruckIcon />}
            label={t('home.tiles.orders')}
            query={openOrdersCountOptions()}
            select={(count) => count}
          />
        )}
        {access.equipment && (
          <StatTile
            action={
              <LegacyLink route="cce/inventory">{t('home.tiles.equipment-action')}</LegacyLink>
            }
            icon={<WrenchIcon />}
            label={t('home.tiles.equipment')}
            query={equipmentStatusCountsOptions()}
            select={(counts) => counts.AWAITING_REPAIR + counts.UNSERVICEABLE}
          />
        )}
      </div>

      {/* Each row pairs a wide card with a narrow one; a grid cell stretches its card to the row. */}
      {access.requisitions && (
        <div className="grid grid-cols-1 gap-4 @4xl/main:grid-cols-3">
          <div className="grid @4xl/main:col-span-2">
            <RequisitionsByPeriod />
          </div>
          <div className="grid">
            <RequisitionStatusMeter />
          </div>
        </div>
      )}

      {(access.approve || access.equipment) && (
        <div className="grid grid-cols-1 gap-4 @4xl/main:grid-cols-3">
          {access.approve && (
            <div className="grid @4xl/main:col-span-2">
              <ApprovalsTable />
            </div>
          )}
          {access.equipment && (
            <div className="grid">
              <EquipmentStatusCard />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
