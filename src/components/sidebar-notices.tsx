import { type LucideIcon, RefreshCwIcon, WifiIcon, WifiOffIcon, XIcon } from 'lucide-react';
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
import { dismissBackOnline, useBackOnline, useOnline } from '@/lib/online';
import { applyUpdate, dismissUpdate, useUpdateReady } from '@/lib/service-worker';

type Notice = {
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
  const online = useOnline();
  const backOnline = useBackOnline();
  const updateReady = useUpdateReady();

  const notices: Notice[] = [];
  if (!online) {
    notices.push({
      variant: 'warning',
      Icon: WifiOffIcon,
      title: t('offline.title'),
      description: t('offline.description'),
    });
  }
  if (online && backOnline) {
    notices.push({
      variant: 'success',
      Icon: WifiIcon,
      title: t('offline.back-online'),
      onClose: dismissBackOnline,
    });
  }
  if (updateReady) {
    notices.push({
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
  return notices;
}

export function SidebarNotices() {
  const { t } = useTranslation();
  const { isMobile, state } = useSidebar();
  const notices = useNotices();

  if (notices.length === 0) return null;

  if (!isMobile && state === 'collapsed') {
    return (
      <SidebarMenu>
        {notices.map(({ variant, Icon, title, action }) => (
          <SidebarMenuItem key={variant}>
            {action ? (
              <SidebarMenuButton
                aria-label={action.label}
                onClick={action.onClick}
                tooltip={`${title}: ${action.label}`}
              >
                <Icon className={ICON_TONE[variant]} />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton render={<span />} tooltip={title}>
                <Icon aria-hidden="true" className={ICON_TONE[variant]} />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {notices.map(({ variant, Icon, title, description, action, onClose }) => (
        <Alert key={variant} role="note" variant={variant}>
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
  return (
    <div className="sr-only" role="status">
      {notices.map(({ title }) => title).join('. ')}
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
