import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { LogOutIcon, WifiOffIcon } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceWork } from '@/components/device-work';
import { useAccountLinks, useNavGroups } from '@/components/nav-access';
import { useOfflineNavigation } from '@/components/offline-navigation';
import { useOfflineSignOut } from '@/components/offline-sign-out';
import { Badge } from '@/components/ui/badge';
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
import { isNavParent } from '@/lib/config';
import { fullName } from '@/lib/text';
import type { LiveNavLink } from '@/lib/types';

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
  const navGroups = useNavGroups();
  const offlineEvents = navGroups
    .flatMap((group) => group.items)
    .filter((item): item is LiveNavLink => !isNavParent(item))
    .find((item) => item.to === '/offline-events');
  const menuLinks = [...accountLinks, ...(offlineEvents ? [offlineEvents] : [])];
  const { pending } = useDeviceWork();
  const offlineSignOut = useOfflineSignOut();
  const offline = useOfflineNavigation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    await navigate({ to: '/login' });
  };

  return (
    <>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(next) => {
          if (!offline.open) setMenuOpen(next);
        }}
      >
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent align={align} width="wide">
          <SignedInAs userId={referenceDataUserId} username={username} />
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {menuLinks.map((link) => (
              <DropdownMenuItem
                key={link.to}
                aria-label={
                  link.to === '/offline-events' && pending > 0
                    ? t('device-events.nav-count', { count: pending })
                    : undefined
                }
                data-unavailable={link.connectionRequired || undefined}
                closeOnClick={!link.connectionRequired}
                onClick={
                  link.connectionRequired
                    ? (event) => {
                        event.preventDefault();
                        offline.show(event.currentTarget);
                      }
                    : undefined
                }
                aria-description={
                  link.connectionRequired ? t('offline.connection-required') : undefined
                }
                render={link.connectionRequired ? undefined : <Link to={link.to} />}
              >
                {link.icon && <link.icon />}
                {t(link.titleKey)}
                {link.to === '/offline-events' && pending > 0 && (
                  <span className="ms-auto">
                    <Badge variant="secondary" aria-hidden>
                      {pending.toLocaleString()}
                    </Badge>
                  </span>
                )}
                {link.connectionRequired && <WifiOffIcon aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => offlineSignOut.confirm(() => void handleLogout())}
            variant="destructive"
          >
            <LogOutIcon className="rtl:rotate-180" />
            {t('nav-user.log-out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
        {offline.dialog}
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
