import { useNavigate } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  type LucideIcon,
  WifiIcon,
  WifiOffIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDeviceWork } from '@/components/device-work';
import { useHasOfflineCapability } from '@/components/nav-access';
import { NoticeCountdownBar } from '@/components/notice-countdown';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
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
  isOnline,
  seedOnline,
  useBackOnline,
  useOnline,
} from '@/lib/online';
import { useUpdateReady } from '@/lib/service-worker';
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
  const canWorkOffline = useHasOfflineCapability();
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

  const download = useDownloadStatus();
  const notices: Notice[] = [];
  if (!online) {
    notices.push({
      id: 'connection-offline',
      variant: 'warning',
      Icon: WifiOffIcon,
      title: t('offline.title'),
      description: t('offline.description'),
      action: {
        label: t('error.try-again'),
        onClick: () => {
          seedOnline();
          if (!isOnline())
            toast.info(t('offline.title'), { description: t('offline.retry-unavailable') });
        },
      },
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
    const programsByDataset = new Map<string, string[]>();
    for (const item of download.incompletePrograms) {
      const label = item.datasetLabel ?? '';
      const programs = programsByDataset.get(label) ?? [];
      programs.push(item.name);
      programsByDataset.set(label, programs);
    }
    notices.push({
      id: 'offline-download',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('offline.download.incomplete'),
      description: [
        t(`offline.download.failure-${reason}`),
        ...[...programsByDataset].map(([label, programs]) =>
          t('offline.download.failed-programs', {
            dataset: label ? t(label as import('i18next').ParseKeys) : t('offline.download.data'),
            programs: programs.join(', '),
          }),
        ),
      ]
        .filter(Boolean)
        .join('\n'),
      action: { label: t('offline.download.retry'), onClick: retryOfflineDownload },
    });
  }
  const signInPending =
    (offlineSession && (canWorkOffline || device.retained)) ||
    (canWorkOffline && waiting && phase === 'session');
  const receiptPending = canWorkOffline && waiting && phase === 'receipt';
  const syncPending = canWorkOffline && waiting && phase === 'syncing';
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
  if (canWorkOffline && !offlineSession && phase === 'complete' && device.pending === 0)
    notices.push({
      id: 'device-events-sync',
      variant: 'success',
      Icon: CircleCheckIcon,
      title: t('device-events.sync-complete'),
      countdown: syncCountdown,
    });
  if (canWorkOffline && phase === 'unsupported')
    notices.push({
      id: 'device-events-sync',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('device-events.sync-unavailable'),
      description: t('device-events.locks-required'),
    });
  if (online && canWorkOffline && !offlineSession && waiting && phase === 'failed')
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
  const { isMobile, state, openMobile, setOpenMobile, setOpen } = useSidebar();
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
                  tooltip={{
                    children: (
                      <span className="whitespace-pre-line">{`${title}${description ? `: ${description}` : ''}: ${action.label}`}</span>
                    ),
                  }}
                >
                  <Icon
                    className={`${ICON_TONE[variant]}${spinning ? ' animate-spin motion-reduce:animate-none' : ''}`}
                  />
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  aria-label={description ? `${title}: ${description}` : title}
                  onClick={() => setOpen(true)}
                  tooltip={{
                    children: (
                      <span className="whitespace-pre-line">
                        {description ? `${title}: ${description}` : title}
                      </span>
                    ),
                  }}
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
                {description && <span className="whitespace-pre-line">{description}</span>}
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
  const updateReady = useUpdateReady();
  const notices = useNotices();
  const queued = useQueuedAnnouncement();
  const { uncertain, refused } = useDeviceWork();
  const deviceSave = useDeviceSaveAnnouncement();
  const scope = useSessionScope();
  const { t } = useTranslation();
  const current: Record<string, string> = {};
  if (updateReady) current['app-update'] = t('update.reload-to-update');
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
  const { t } = useTranslation();
  const warnings = useNotices().filter((notice) => notice.variant === 'warning');
  const updateReady = useUpdateReady();
  const { isMobile, open, openMobile } = useSidebar();
  if ((!warnings.length && !updateReady) || (isMobile ? openMobile : open)) return null;
  const label = [
    ...warnings.map((notice) => notice.title),
    ...(updateReady ? [t('update.reload-to-update')] : []),
  ].join('. ');
  return (
    <span
      role="img"
      aria-label={label}
      className="pointer-events-none absolute top-1 end-1 size-2 rounded-full bg-warning"
    />
  );
}
