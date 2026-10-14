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
import { useDeviceSaveAnnouncement } from '@/lib/device-save-announcement';
import { retryOfflineDownload, useDownloadStatus } from '@/lib/offline-download-status';
import { dismissBackOnline, useBackOnline, useOnline } from '@/lib/online';
import { applyUpdate, dismissUpdate, useUpdateReady } from '@/lib/service-worker';

type Notice = {
  id: string;
  spinning?: boolean;
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
  const online = useOnline();
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
  if (events?.length)
    notices.push({
      id: 'device-events-waiting',
      variant: 'info',
      Icon: ListChecksIcon,
      title: t('device-events.waiting', { count: events.length }),
      action: {
        label: t('device-events.review'),
        onClick: () => void navigate({ to: '/stock-management/device-events' }),
      },
    });
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
        {notices.map(({ id, variant, Icon, title, description, action, spinning }) => (
          <SidebarMenuItem key={id}>
            {action ? (
              <SidebarMenuButton
                aria-label={action.label}
                onClick={() => {
                  action.onClick();
                  if (id === 'device-events-waiting') setOpenMobile(false);
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
        ))}
      </SidebarMenu>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {notices.map(({ id, variant, Icon, title, description, action, onClose, spinning }) => (
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
                      if (id === 'device-events-waiting') setOpenMobile(false);
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
      ))}
    </div>
  );
}

export function StatusAnnouncer() {
  const notices = useNotices();
  const download = useDownloadStatus();
  const deviceSave = useDeviceSaveAnnouncement();
  const { t } = useTranslation();
  return (
    <div className="sr-only" role="status">
      {[
        ...notices.map(({ title, description, id }) =>
          id === 'offline-download' && description ? `${title}. ${description}` : title,
        ),
        ...(deviceSave ? [t(deviceSave)] : []),
        ...(download.phase === 'complete' ? [t('offline.download.finished')] : []),
      ].join('. ')}
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
