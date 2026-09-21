import { useNavigate } from '@tanstack/react-router';
import { LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { useLoginData } from '@/features/auth/store/login-data';

type NavUserProps = {
  /** Rendered as the menu trigger so each call site styles its own. */
  trigger: ReactElement;
  align?: 'start' | 'end';
};

export function NavUser({ trigger, align = 'end' }: NavUserProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuthActions();
  const username = useLoginData((state) => state.username);
  const referenceDataUserId = useLoginData((state) => state.referenceDataUserId);

  const handleLogout = async () => {
    await logout();
    await navigate({ to: '/login' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align} width="wide">
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          <p className="truncate font-semibold text-foreground text-xs">{username}</p>
          {/* TODO: Swap the reference-data id for the real profile once that endpoint is wired up. */}
          <p className="truncate text-2xs text-muted-foreground">{referenceDataUserId}</p>
        </div>
        <DropdownMenuSeparator />
        {/* TODO: Wire up onClick handlers (navigate to /account, /settings). */}
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <UserIcon />
            {t('nav-user.account')}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <SettingsIcon />
            {t('nav-user.settings')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} variant="destructive">
          <LogOutIcon className="rtl:rotate-180" />
          {t('nav-user.log-out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
