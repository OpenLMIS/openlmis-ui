import { useNavigate } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
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
import { useDeviceSync, useDeviceWork } from '@/components/app-shell/device-work';
import { useHasOfflineCapability } from '@/components/app-shell/nav-access';
import { NoticeCountdownBar } from '@/components/app-shell/notice-countdown';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useOfflineSession } from '@/hooks/use-offline-session';
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
import { cn } from '@/lib/utils';

type Notice = {
  id: string;
  spinning?: boolean;
  countdown?: NoticeCountdown;
  closesSidebar?: boolean;
  variant: 'warning' | 'success' | 'info' | 'destructive';
  Icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
};

const ICON_TONE: Record<Notice['variant'], string> = {
  destructive: 'text-destructive',
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
  const { phase: ownPhase, countdown: syncCountdown, wake } = useDeviceSync();
  const phase = ownPhase === 'idle' && device.sending ? 'syncing' : ownPhase;
  const needsAction = device.refused + device.uncertain;
  const review = {
    label: t('offline-events.review-short'),
    onClick: () =>
      void navigate({ to: '/offline-events', search: needsAction ? { tab: 'errors' } : {} }),
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
  if (
    download.phase === 'failed' &&
    (online ||
      download.reason !== 'offline' ||
      download.incomplete.length > 0 ||
      download.accessFailed)
  ) {
    const reason = download.reason ?? 'read';
    const programsByDataset = new Map<ParseKeys, string[]>();
    for (const item of download.incomplete) {
      const label = item.datasetLabel;
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
            dataset: t(label),
            programs: programs.join(', '),
          }),
        ),
      ]
        .filter(Boolean)
        .join('\n'),
      action: online
        ? { label: t('offline.download.retry'), onClick: retryOfflineDownload }
        : undefined,
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
          ? 'offline-events.receipt-write'
          : signInPending
            ? 'offline-events.sign-in'
            : 'offline-events.syncing',
      ),
      description: receiptPending ? t('offline-events.receipt-write-description') : undefined,
      action: !receiptPending && signInPending ? undefined : review,
      closesSidebar: true,
    });
  }
  if (canWorkOffline && !offlineSession && phase === 'complete' && device.pending === 0)
    notices.push({
      id: 'device-events-sync',
      variant: 'success',
      Icon: CircleCheckIcon,
      title: t('offline-events.sync-complete'),
      countdown: syncCountdown,
    });
  if (canWorkOffline && phase === 'unsupported')
    notices.push({
      id: 'device-events-sync',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('offline-events.sync-unavailable'),
      description: t('offline-events.locks-required'),
    });
  if (online && canWorkOffline && !offlineSession && waiting && phase === 'failed')
    notices.push({
      id: 'device-events-sync',
      variant: 'warning',
      Icon: AlertTriangleIcon,
      title: t('offline-events.sync-failed'),
      description: t('offline-events.sync-failed-description'),
      action: { label: t('offline-events.retry'), onClick: wake },
    });
  for (const reason of ['access-changed', 'draft-changed'] as const) {
    if (device.pauses.includes(reason))
      notices.push({
        id: `device-events-${reason}`,
        variant: 'warning',
        Icon: AlertTriangleIcon,
        title: t(`offline-events.${reason}`),
        description: t(`offline-events.${reason}-held-description`),
        action: review,
        closesSidebar: true,
      });
  }
  if (needsAction)
    notices.unshift({
      id: 'device-events-action-needed',
      variant: 'destructive',
      Icon: AlertTriangleIcon,
      title: t('offline-events.action-needed-count', { count: needsAction }),
      action: review,
      closesSidebar: true,
    });
  const reviewNotice =
    notices.find((notice) => notice.action === review && notice.variant === 'destructive') ??
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
                    aria-hidden="true"
                    className={cn(
                      ICON_TONE[variant],
                      spinning && 'animate-spin motion-reduce:animate-none',
                    )}
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
                    className={cn(
                      ICON_TONE[variant],
                      spinning && 'animate-spin motion-reduce:animate-none',
                    )}
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
  const { queued, save: deviceSave } = useDeviceSync();
  const scope = useSessionScope();
  const { t } = useTranslation();
  const current: Record<string, string> = {};
  if (updateReady) current['app-update'] = t('update.reload-to-update');
  for (const { id, title, description } of notices) {
    current[id] = description ? `${title.replace(/[.!?؟。]+$/u, '')}. ${description}` : title;
  }
  if (queued) current.queued = t('offline-events.waiting', { count: queued.count });
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
  const warnings = useNotices().filter((notice) =>
    ['warning', 'destructive'].includes(notice.variant),
  );
  const destructive = warnings.some((notice) => notice.variant === 'destructive');
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
      className={cn(
        'pointer-events-none absolute top-1 end-1 size-2 rounded-full',
        destructive ? 'bg-destructive' : 'bg-warning',
      )}
    />
  );
}
