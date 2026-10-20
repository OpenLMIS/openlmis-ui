import { useNavigate } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  type LucideIcon,
  RefreshCwIcon,
  WifiIcon,
  WifiOffIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceWork } from '@/components/device-work';
import { useHasRight } from '@/components/nav-access';
import { NoticeCountdownBar } from '@/components/notice-countdown';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { RIGHTS } from '@/features/auth/lib/rights';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { useOfflineSession } from '@/hooks/use-offline-session';
import {
  syncCountdown,
  useQueuedAnnouncement,
  useSyncPhase,
  wakeStockEventSync,
} from '@/lib/device-event-status';
import { useDeviceSaveAnnouncement } from '@/lib/device-save-announcement';
import type { NoticeCountdown } from '@/lib/notice-countdown';
import {
  downloadCountdown,
  retryOfflineDownload,
  useDownloadStatus,
} from '@/lib/offline-download-status';
import {
  backOnlineCountdown,
  dismissBackOnline,
  seedOnline,
  useBackOnline,
  useOnline,
} from '@/lib/online';
import { applyUpdate, dismissUpdate, useUpdateReady } from '@/lib/service-worker';
import { useSessionScope } from '@/lib/session-scope';

type Notice = {
  id: string;
  spinning?: boolean;
  countdown?: NoticeCountdown;
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
  const device = useDeviceWork();
  const { waiting } = device;
  const ownPhase = useSyncPhase();
  const phase = ownPhase === 'idle' && device.sending ? 'syncing' : ownPhase;
  const review = {
    label: t('device-events.review'),
    onClick: () => void navigate({ to: '/offline-events' }),
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
      action: { label: t('error.try-again'), onClick: seedOnline },
    });
  }
  if (online && backOnline) {
    notices.push({
      id: 'connection-restored',
      countdown: backOnlineCountdown,
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
  if (download.phase === 'running' && download.trigger !== 'refresh')
    notices.push({
      id: 'offline-download',
      variant: 'info',
      Icon: LoaderCircleIcon,
      spinning: true,
      title: t('offline.download.fetching'),
    });
  if (download.phase === 'complete' && download.trigger !== 'refresh')
    notices.push({
      id: 'offline-download',
      variant: 'success',
      Icon: CircleCheckIcon,
      title: t('offline.download.finished'),
      countdown: downloadCountdown,
    });
  if (download.phase === 'unsupported')
    notices.push({
      id: 'offline-download',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('offline.download.unavailable'),
      description: t('offline.download.locks-required'),
    });
  if (download.phase === 'failed' && (online || download.reason !== 'offline')) {
    const reason = download.reason ?? 'read';
    notices.push({
      id: 'offline-download',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('offline.download.incomplete'),
      description: [
        t(`offline.download.failure-${reason}`),
        download.incompletePrograms.length
          ? t('offline.download.failed-programs', {
              programs: download.incompletePrograms.map((program) => program.name).join(', '),
            })
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      action: { label: t('offline.download.retry'), onClick: retryOfflineDownload },
    });
  }
  const signInPending =
    (offlineSession && (canAdjust || device.retained)) ||
    (canAdjust && waiting && phase === 'session');
  const receiptPending = canAdjust && waiting && phase === 'receipt';
  const syncPending = canAdjust && waiting && phase === 'syncing';
  if (receiptPending || (online && (signInPending || syncPending))) {
    const syncing = !receiptPending && !signInPending;
    notices.push({
      id: 'device-events-sync',
      variant: syncing ? 'info' : 'warning',
      Icon: syncing ? LoaderCircleIcon : AlertTriangleIcon,
      spinning: syncing,
      title: t(
        receiptPending
          ? 'device-events.receipt-write'
          : signInPending
            ? 'device-events.sign-in'
            : 'device-events.syncing',
      ),
      description: receiptPending ? t('device-events.receipt-write-description') : undefined,
      action: !receiptPending && signInPending ? undefined : review,
      closesSidebar: true,
    });
  }
  if (canAdjust && !offlineSession && phase === 'complete' && device.pending === 0)
    notices.push({
      id: 'device-events-sync',
      variant: 'success',
      Icon: CircleCheckIcon,
      title: t('device-events.sync-complete'),
      countdown: syncCountdown,
    });
  if (canAdjust && phase === 'unsupported')
    notices.push({
      id: 'device-events-sync',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('device-events.sync-unavailable'),
      description: t('device-events.locks-required'),
    });
  if (online && canAdjust && !offlineSession && waiting && phase === 'failed')
    notices.push({
      id: 'device-events-sync',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('device-events.sync-failed'),
      description: t('device-events.sync-failed-description'),
      action: { label: t('device-events.retry'), onClick: wakeStockEventSync },
    });
  for (const reason of ['access-changed', 'draft-changed'] as const) {
    if (device.pauses.includes(reason))
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
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  const notices = useNotices();
  const reviewAction = useRef<HTMLButtonElement>(null);
  const reviewNoticeId = notices.find((notice) => notice.action && notice.closesSidebar)?.id;
  const expanded = isMobile ? openMobile : state === 'expanded';
  useEffect(() => {
    if (reviewNoticeId && expanded) reviewAction.current?.scrollIntoView({ block: 'nearest' });
  }, [reviewNoticeId, expanded]);

  if (notices.length === 0) return null;

  if (!isMobile && state === 'collapsed') {
    return (
      <SidebarMenu>
        {notices.map(
          ({ id, variant, Icon, title, description, action, spinning, closesSidebar }) => (
            <SidebarMenuItem key={id}>
              {action ? (
                <SidebarMenuButton
                  aria-label={t('notice.action-label', { action: action.label, title })}
                  onClick={() => {
                    action.onClick();
                    if (closesSidebar) setOpenMobile(false);
                  }}
                  tooltip={`${title}${description ? `: ${description}` : ''}: ${action.label}`}
                >
                  <Icon
                    className={`${ICON_TONE[variant]}${spinning ? ' animate-spin motion-reduce:animate-none' : ''}`}
                  />
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  render={<span />}
                  tooltip={description ? `${title}: ${description}` : title}
                >
                  <Icon
                    aria-hidden="true"
                    className={`${ICON_TONE[variant]}${spinning ? ' animate-spin motion-reduce:animate-none' : ''}`}
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
        ({
          id,
          variant,
          Icon,
          title,
          description,
          action,
          onClose,
          spinning,
          closesSidebar,
          countdown,
        }) => (
          <Alert
            key={id}
            role="note"
            variant={variant}
            countdown={!!countdown}
            onMouseEnter={() => countdown?.pause('hover', true)}
            onMouseLeave={() => countdown?.pause('hover', false)}
            onFocusCapture={() => countdown?.pause('focus', true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                countdown?.pause('focus', false);
            }}
          >
            {countdown && <NoticeCountdownBar countdown={countdown} />}
            <Icon
              aria-hidden="true"
              className={spinning ? 'animate-spin motion-reduce:animate-none' : undefined}
            />
            <AlertTitle>{title}</AlertTitle>
            {(description || action) && (
              <AlertDescription>
                {description}
                {action && (
                  <div className="pt-1">
                    <Button
                      ref={closesSidebar ? reviewAction : undefined}
                      onClick={() => {
                        action.onClick();
                        if (closesSidebar) setOpenMobile(false);
                      }}
                      size="xs"
                      variant={variant === 'success' ? 'outline' : variant}
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
  const queued = useQueuedAnnouncement();
  const { uncertain, refused } = useDeviceWork();
  const deviceSave = useDeviceSaveAnnouncement();
  const scope = useSessionScope();
  const { t } = useTranslation();
  const current: Record<string, string> = {};
  for (const { id, title, description } of notices) {
    current[id] = description ? `${title.replace(/[.!?؟。]+$/u, '')}. ${description}` : title;
  }
  if (uncertain) current.uncertain = t('device-events.uncertain-count', { count: uncertain });
  if (refused) current.refused = t('device-events.refused-count', { count: refused });
  if (queued) current.queued = t('device-events.waiting', { count: queued.count });
  if (deviceSave) current.save = t(deviceSave);
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
        .map(([, text]) => text.replace(/[.!?؟。]+$/u, ''))
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
