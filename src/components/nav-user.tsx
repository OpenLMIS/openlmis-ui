import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { LogOutIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountLinks } from '@/components/nav-access';
import { useOfflineSignOut } from '@/components/offline-sign-out';
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
import { profileOptions } from '@/features/profile/api/queries';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { fullName } from '@/lib/text';

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

  const accountLinks = useAccountLinks();
  const offlineSignOut = useOfflineSignOut();

  const handleLogout = async () => {
    await logout();
    await navigate({ to: '/login' });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent align={align} width="wide">
          <SignedInAs userId={referenceDataUserId} username={username} />
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {accountLinks.map((link) => (
              <DropdownMenuItem key={link.to} render={<Link to={link.to} />}>
                <link.icon />
                {t(link.titleKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              offlineSignOut.confirm(() => whenLeaveAllowed(() => void handleLogout()))
            }
            variant="destructive"
          >
            <LogOutIcon className="rtl:rotate-180" />
            {t('nav-user.log-out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {offlineSignOut.dialog}
    </>
  );
}

/** The user's name over their username; rendered in the open menu, so it loads only then. */
function SignedInAs({ userId, username }: { userId: string | null; username: string | null }) {
  const { data: name } = useQuery({
    ...profileOptions(userId ?? ''),
    enabled: userId !== null,
    select: ({ user }) => fullName(user),
  });

  return (
    <div className="flex flex-col gap-0.5 px-2 py-1.5">
      <p className="truncate font-semibold text-foreground text-xs">{name || username}</p>
      {name && <p className="truncate text-2xs text-muted-foreground">{username}</p>}
    </div>
  );
}
