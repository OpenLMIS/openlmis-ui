import { useRegisterSW } from 'virtual:pwa-register/react';
import { type LucideIcon, RefreshCwIcon, WifiIcon, WifiOffIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { allowUnload, whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { reloadWhenUpdated } from '@/lib/app-update';
import { useOnline } from '@/lib/online';

const BACK_ONLINE_MS = 4000;
const UPDATE_CHECK_MS = 60 * 60 * 1000;

type Notice = {
  id: string;
  variant: 'warning' | 'success' | 'info';
  Icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
};

const ICON_TONE: Record<Notice['variant'], string> = {
  warning: 'text-warning-strong',
  success: 'text-success',
  info: 'text-primary dark:text-info',
};

/** True for a few seconds after the connection comes back; `dismiss` hides it sooner. */
function useBackOnline(online: boolean) {
  const [shown, setShown] = useState(false);
  const wasOnline = useRef(online);

  useEffect(() => {
    const cameBack = online && !wasOnline.current;
    wasOnline.current = online;
    if (!cameBack) {
      if (!online) setShown(false);
      return;
    }
    setShown(true);
    const timer = setTimeout(() => setShown(false), BACK_ONLINE_MS);
    return () => clearTimeout(timer);
  }, [online]);

  return [shown, () => setShown(false)] as const;
}

/** Offline, back online and a new version, above the sidebar's footer buttons. */
export function SidebarNotices() {
  const { t } = useTranslation();
  const { isMobile, state } = useSidebar();
  const online = useOnline();
  const [backOnline, dismissBackOnline] = useBackOnline(online);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // A tab left open for days still learns of a new version.
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
  });

  const notices: Notice[] = [];
  if (!online) {
    notices.push({
      id: 'offline',
      variant: 'warning',
      Icon: WifiOffIcon,
      title: t('offline.title'),
      description: t('offline.description'),
    });
  }
  if (backOnline) {
    notices.push({
      id: 'back-online',
      variant: 'success',
      Icon: WifiIcon,
      title: t('offline.back-online'),
      onClose: dismissBackOnline,
    });
  }
  if (needRefresh) {
    notices.push({
      id: 'update',
      variant: 'info',
      Icon: RefreshCwIcon,
      title: t('update.title'),
      action: {
        label: t('update.reload'),
        onClick: () =>
          whenLeaveAllowed(() => {
            allowUnload();
            reloadWhenUpdated();
            void updateServiceWorker(true);
          }),
      },
      onClose: () => setNeedRefresh(false),
    });
  }

  if (notices.length === 0) return null;

  // The icon rail has room for an icon each, with its title on hover.
  if (!isMobile && state === 'collapsed') {
    return (
      <SidebarMenu role="status">
        {notices.map(({ id, variant, Icon, title, action }) => (
          <SidebarMenuItem key={id}>
            <SidebarMenuButton onClick={action?.onClick} tooltip={title}>
              <Icon className={ICON_TONE[variant]} />
              <span>{title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {notices.map(({ id, variant, Icon, title, description, action, onClose }) => (
        <Alert key={id} role="status" variant={variant}>
          <Icon />
          <AlertTitle>{title}</AlertTitle>
          {(description || action) && (
            <AlertDescription>
              {description}
              {action && (
                <div className="pt-1">
                  <Button onClick={action.onClick} size="xs" variant="outline">
                    {action.label}
                  </Button>
                </div>
              )}
            </AlertDescription>
          )}
          {onClose && (
            <AlertAction>
              <Button
                aria-label={t('notice.close')}
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

/** A warning dot on the menu button while offline, for when the sidebar is out of view. */
export function OfflineDot() {
  const { t } = useTranslation();
  const online = useOnline();
  const { isMobile, open, openMobile } = useSidebar();
  // Only beside the menu button, which the header shows while the sidebar is closed.
  if (online || (isMobile ? openMobile : open)) return null;
  return (
    <span className="pointer-events-none absolute top-1 end-1 size-2 rounded-full bg-warning">
      <span className="sr-only">{t('offline.title')}</span>
    </span>
  );
}
