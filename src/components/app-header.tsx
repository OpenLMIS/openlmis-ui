import { UserRoundIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CommandPalette } from '@/components/command-palette';
import { CustomTrigger } from '@/components/custom-trigger';
import { NavUser } from '@/components/nav-user';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function AppHeader() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 flex h-(--app-header-height) w-full shrink-0 items-center gap-3 border-b bg-background px-2 md:px-4">
      <CustomTrigger place="navbar" />
      <CommandPalette />
      <div className="ms-auto flex items-center gap-1.5">
        <NavUser
          trigger={
            <button
              aria-label={t('nav-user.account-menu')}
              className="cursor-pointer rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              type="button"
            >
              <Avatar>
                <AvatarFallback>
                  <UserRoundIcon className="size-4" />
                </AvatarFallback>
              </Avatar>
            </button>
          }
        />
      </div>
    </header>
  );
}
