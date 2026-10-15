import { useNavigate } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  type LucideIcon,
  RefreshCwIcon,
  WifiIcon,
  WifiOffIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHasRight } from '@/components/nav-access';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useDeviceEvents } from '@/features/stock-events/hooks/use-device-events';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useOfflineSession } from '@/hooks/use-offline-session';
import { useQueuedAnnouncement, useSyncPhase, wakeStockEventSync } from '@/lib/device-event-status';
import { useDeviceSaveAnnouncement } from '@/lib/device-save-announcement';
import { retryOfflineDownload, useDownloadStatus } from '@/lib/offline-download-status';
import { dismissBackOnline, seedOnline, useBackOnline, useOnline } from '@/lib/online';
import { applyUpdate, dismissUpdate, useUpdateReady } from '@/lib/service-worker';
import { useSessionScope } from '@/lib/session-scope';

type Notice = {
  id: string;
  spinning?: boolean;
  closesSidebar?: boolean;
  variant: 'warning' | 'success' | 'info';
  Icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
};

const ICON_TONE: Record<Notice['variant'], string> = {
  warning: 'text-warning-strong',
  success: 'text-success-strong',
  info: 'text-primary dark:text-info',
};

function useNotices(): Notice[] {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canAdjust = useHasRight(RIGHTS.stockAdjust);
  const { events } = useDeviceEvents(canAdjust);
  const ownPhase = useSyncPhase();
  const phase =
    ownPhase === 'idle' && events?.some((event) => event.status === 'sending')
      ? 'syncing'
      : ownPhase;
  const waiting =
    events?.filter((event) => !event.pauseReason && ['queued', 'sending'].includes(event.status))
      .length ?? 0;
  const uncertain = events?.filter((event) => event.status === 'uncertain').length ?? 0;
  const refused =
    events?.filter((event) => event.status === 'refused' && !event.error?.resolvedAt).length ?? 0;
  const review = {
    label: t('device-events.review'),
    onClick: () => void navigate({ to: '/stock-management/device-events' }),
  };
  const online = useOnline();
  const offlineSession = useOfflineSession();
  const backOnline = useBackOnline();
  const updateReady = useUpdateReady();

  const download = useDownloadStatus();
  const notices: Notice[] = [];
  if (!online) {
    notices.push({
      id: 'connection-offline',
      variant: 'warning',
      Icon: WifiOffIcon,
      title: t('offline.title'),
      description: t('offline.description'),
      action: { label: t('offline.try-connection'), onClick: seedOnline },
    });
  }
  if (online && backOnline) {
    notices.push({
      id: 'connection-restored',
      variant: 'success',
      Icon: WifiIcon,
      title: t('offline.back-online'),
      onClose: dismissBackOnline,
    });
  }
  if (updateReady) {
    notices.push({
      id: 'app-update',
      variant: 'info',
      Icon: RefreshCwIcon,
      title: t('update.title'),
      action: {
        label: t('update.reload'),
        onClick: () => whenLeaveAllowed(() => void applyUpdate(allowUnload)),
      },
      onClose: dismissUpdate,
    });
  }
  if (download.phase === 'running')
    notices.push({
      id: 'offline-download',
      variant: 'info',
      Icon: LoaderCircleIcon,
      spinning: true,
      title: t('offline.download.fetching'),
    });
  if (download.phase === 'unsupported')
    notices.push({
      id: 'offline-download',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('offline.download.unavailable'),
      description: t('offline.download.locks-required'),
    });
  if (download.phase === 'failed') {
    const reason = download.reason ?? 'read';
    notices.push({
      id: 'offline-download',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('offline.download.incomplete'),
      description: [
        t(`offline.download.failure-${reason}`),
        download.failed.length
          ? t('offline.download.failed-programs', {
              programs: download.failed.map((program) => program.name).join(', '),
            })
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      action: { label: t('offline.download.retry'), onClick: retryOfflineDownload },
    });
  }
  if (waiting)
    notices.push({
      id: 'device-events-waiting',
      closesSidebar: true,
      variant: 'info',
      Icon: ListChecksIcon,
      title: t('device-events.waiting', { count: waiting }),
      action: review,
    });
  if (
    offlineSession ||
    (canAdjust && waiting && (phase === 'syncing' || phase === 'session' || phase === 'receipt'))
  )
    notices.push({
      id: 'device-events-sync',
      variant: !offlineSession && phase === 'syncing' ? 'info' : 'warning',
      Icon: !offlineSession && phase === 'syncing' ? LoaderCircleIcon : AlertTriangleIcon,
      spinning: !offlineSession && phase === 'syncing',
      title: t(
        !offlineSession && phase === 'syncing'
          ? 'device-events.syncing'
          : offlineSession || phase === 'session'
            ? 'device-events.sign-in'
            : 'device-events.receipt-write',
      ),
      description: offlineSession
        ? t('session.offline-description')
        : phase === 'receipt'
          ? t('device-events.receipt-write-description')
          : undefined,
      action: offlineSession || phase === 'session' ? undefined : review,
      closesSidebar: true,
    });
  if (canAdjust && phase === 'unsupported')
    notices.push({
      id: 'device-events-sync',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('device-events.sync-unavailable'),
      description: t('device-events.locks-required'),
    });
  if (canAdjust && waiting && phase === 'failed')
    notices.push({
      id: 'device-events-sync',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('device-events.sync-failed'),
      description: t('device-events.sync-failed-description'),
      action: { label: t('device-events.retry'), onClick: wakeStockEventSync },
    });
  if (uncertain)
    notices.push({
      id: 'device-events-uncertain',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('device-events.uncertain-count', { count: uncertain }),
      action: review,
      closesSidebar: true,
    });
  if (refused)
    notices.push({
      id: 'device-events-refused',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('device-events.refused-count', { count: refused }),
      action: review,
      closesSidebar: true,
    });
  for (const reason of ['access-changed', 'draft-changed'] as const) {
    if (events?.some((event) => event.pauseReason === reason))
      notices.push({
        id: `device-events-${reason}`,
        variant: 'warning',
        Icon: AlertTriangleIcon,
        title: t(`device-events.${reason}`),
        description: t(`device-events.${reason}-description`),
        action: review,
        closesSidebar: true,
      });
  }
  const reviewNotice =
    notices.find((notice) => notice.action === review && notice.variant === 'warning') ??
    notices.find((notice) => notice.action === review);
  for (const notice of notices) {
    if (notice.action === review && notice !== reviewNotice) notice.action = undefined;
  }
  return notices;
}

export function SidebarNotices() {
  const { t } = useTranslation();
  const { isMobile, state, setOpenMobile } = useSidebar();
  const notices = useNotices();

  if (notices.length === 0) return null;

  if (!isMobile && state === 'collapsed') {
    return (
      <SidebarMenu>
        {notices.map(
          ({ id, variant, Icon, title, description, action, spinning, closesSidebar }) => (
            <SidebarMenuItem key={id}>
              {action ? (
                <SidebarMenuButton
                  aria-label={action.label}
                  onClick={() => {
                    action.onClick();
                    if (closesSidebar) setOpenMobile(false);
                  }}
                  tooltip={`${title}${description ? `: ${description}` : ''}: ${action.label}`}
                >
                  <Icon className={`${ICON_TONE[variant]}${spinning ? ' animate-spin' : ''}`} />
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  render={<span />}
                  tooltip={description ? `${title}: ${description}` : title}
                >
                  <Icon
                    aria-hidden="true"
                    className={`${ICON_TONE[variant]}${spinning ? ' animate-spin' : ''}`}
                  />
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ),
        )}
      </SidebarMenu>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {notices.map(
        ({ id, variant, Icon, title, description, action, onClose, spinning, closesSidebar }) => (
          <Alert key={id} role="note" variant={variant}>
            <Icon aria-hidden="true" className={spinning ? 'animate-spin' : undefined} />
            <AlertTitle>{title}</AlertTitle>
            {(description || action) && (
              <AlertDescription>
                {description}
                {action && (
                  <div className="pt-1">
                    <Button
                      onClick={() => {
                        action.onClick();
                        if (closesSidebar) setOpenMobile(false);
                      }}
                      size="xs"
                      variant="outline"
                    >
                      {action.label}
                    </Button>
                  </div>
                )}
              </AlertDescription>
            )}
            {onClose && (
              <AlertAction>
                <Button
                  aria-label={t('notice.close', { title })}
                  onClick={onClose}
                  size="icon-xs"
                  variant="ghost"
                >
                  <XIcon />
                </Button>
              </AlertAction>
            )}
          </Alert>
        ),
      )}
    </div>
  );
}

export function StatusAnnouncer() {
  const notices = useNotices();
  const download = useDownloadStatus();
  const queued = useQueuedAnnouncement();
  const deviceSave = useDeviceSaveAnnouncement();
  const scope = useSessionScope();
  const { t } = useTranslation();
  const current: Record<string, string> = {};
  for (const { id, title, description } of notices) {
    if (id !== 'device-events-waiting')
      current[id] = description ? `${title}. ${description}` : title;
  }
  if (queued) current.queued = t('device-events.waiting', { count: queued.count });
  if (deviceSave) current.save = t(deviceSave);
  if (download.phase === 'complete') current.download = t('offline.download.finished');
  const signature = JSON.stringify(current);
  const [announced, setAnnounced] = useState<{
    scope: number;
    signature: string;
    notices: Record<string, string>;
    message: string;
  }>({ scope, signature: '', notices: {}, message: '' });
  if (announced.signature !== signature || announced.scope !== scope) {
    setAnnounced({
      scope,
      signature,
      notices: current,
      message: Object.entries(current)
        .filter(([id, text]) => announced.scope !== scope || announced.notices[id] !== text)
        .map(([, text]) => text)
        .join('. '),
    });
  }
  return (
    <div className="sr-only" role="status">
      {announced.message}
    </div>
  );
}

export function OfflineDot() {
  const online = useOnline();
  const { isMobile, open, openMobile } = useSidebar();
  if (online || (isMobile ? openMobile : open)) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1 end-1 size-2 rounded-full bg-warning"
    />
  );
}
