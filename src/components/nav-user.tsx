import { CreditCardIcon, LogOutIcon, SettingsIcon, UserIcon, UserRoundIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// TODO: Replace with the authenticated user from auth context (e.g. `useAuth()`).
const user = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  avatar: '',
};

export function NavUser() {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Avatar className="size-8" />}>
        {user.avatar && <AvatarImage src={user.avatar} />}
        <AvatarFallback>
          <UserRoundIcon className="size-4" />
        </AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel gap="md" className="flex items-center">
            <Avatar className="size-10">
              {user.avatar && <AvatarImage src={user.avatar} />}
              <AvatarFallback>
                <UserRoundIcon className="size-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="font-medium text-foreground">{user.name}</span>
              <div className="max-w-full truncate text-muted-foreground text-xs">{user.email}</div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* TODO: Wire up onClick handlers (navigate to /account, /settings, /billing). */}
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
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <CreditCardIcon />
            {t('nav-user.plan-billing')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* TODO: Wire up logout (clear auth state, redirect to /login). */}
          <DropdownMenuItem variant="destructive">
            <LogOutIcon />
            {t('nav-user.log-out')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
