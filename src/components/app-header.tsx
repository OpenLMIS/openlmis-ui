import { BellIcon, HelpCircleIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CustomTrigger } from '@/components/custom-trigger';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function AppHeader() {
  const { t } = useTranslation();
  const helpLabel = t('header.help');
  const notificationsLabel = t('header.notifications');

  return (
    <header className="sticky top-0 z-50 flex h-(--app-header-height) w-full shrink-0 items-center justify-between gap-2 border-b bg-background px-2 md:px-4">
      <div className="flex items-center gap-3">
        <CustomTrigger place="navbar" />
      </div>
      <div className="flex items-center gap-1.5">
        {/* TODO: Wire up onClick (open help center / docs link). */}
        <Tooltip>
          <TooltipTrigger render={<Button aria-label={helpLabel} size="icon-sm" variant="ghost" />}>
            <HelpCircleIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">{helpLabel}</TooltipContent>
        </Tooltip>
        {/* TODO: Wire up notifications (badge with unread count, dropdown/drawer). */}
        <Tooltip>
          <TooltipTrigger
            render={<Button aria-label={notificationsLabel} size="icon-sm" variant="ghost" />}
          >
            <BellIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">{notificationsLabel}</TooltipContent>
        </Tooltip>
        <Separator
          className="h-4 data-[orientation=vertical]:self-center mx-2 md:mx-4"
          orientation="vertical"
        />
        <NavUser />
      </div>
    </header>
  );
}
