import { Link, useLocation } from '@tanstack/react-router';
import { ChevronRightIcon, SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomTrigger } from '@/components/custom-trigger';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Logo } from '@/components/logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDirection } from '@/components/ui/direction';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getNavTrail, isNavParent, LIVE_NAV_GROUPS } from '@/lib/config';
import type { LiveNavItem, LiveNavLink, LiveNavParent } from '@/lib/types';

export function AppSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const direction = useDirection();
  const settingsLabel = t('sidebar.settings');

  // The rail only has room for a smaller mark; the mobile sheet is always full width.
  const isCollapsed = !isMobile && state === 'collapsed';

  const { openParent, setOpenParent } = useOpenNavParent(pathname);

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar
      collapsible="icon"
      dir={direction}
      side={direction === 'rtl' ? 'right' : 'left'}
      variant="sidebar"
    >
      <SidebarHeader bordered layout="bar">
        <Button
          nativeButton={false}
          render={<Link onClick={closeMobileSidebar} to="/home" />}
          size={isCollapsed ? 'icon' : 'icon-lg'}
          tone="sidebar"
          variant="ghost"
        >
          <Logo />
        </Button>
        <CustomTrigger place="sidebar" />
      </SidebarHeader>

      <SidebarContent>
        {LIVE_NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.labelKey ?? group.items[0]?.titleKey}>
            {group.labelKey && <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavMenuItem
                    isCollapsed={isCollapsed}
                    item={item}
                    key={item.titleKey}
                    onNavigate={closeMobileSidebar}
                    onOpenChange={(open) => setOpenParent(open ? item.titleKey : null)}
                    open={openParent === item.titleKey}
                    pathname={pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center group-data-[collapsible=icon]:hidden">
          <ThemeSwitcher tone="sidebar" />
          <LanguageSwitcher tone="sidebar" />
          {/* TODO: Wire up onClick (open settings dialog or navigate to /settings). */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button aria-label={settingsLabel} size="icon-sm" tone="sidebar" variant="ghost" />
              }
            >
              <SettingsIcon />
            </TooltipTrigger>
            <TooltipContent>{settingsLabel}</TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

const findActiveParent = (pathname: string) => {
  const trail = getNavTrail(pathname);
  return trail.length > 1 ? (trail[0]?.titleKey ?? null) : null;
};

// Accordion: opening one parent closes the rest, and navigating opens the new one.
function useOpenNavParent(pathname: string) {
  const activeParent = findActiveParent(pathname);
  const [openParent, setOpenParent] = useState<LiveNavParent['titleKey'] | null>(activeParent);
  const [trackedParent, setTrackedParent] = useState(activeParent);

  if (activeParent !== trackedParent) {
    setTrackedParent(activeParent);
    if (activeParent) setOpenParent(activeParent);
  }

  return { openParent, setOpenParent };
}

type NavMenuItemProps = {
  item: LiveNavItem;
  pathname: string;
  isCollapsed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
};

function NavMenuItem({ item, isCollapsed, ...props }: NavMenuItemProps) {
  if (isNavParent(item)) {
    const isActive = item.items.some((child) => child.to === props.pathname);
    return isCollapsed ? (
      <NavFlyout isActive={isActive} item={item} />
    ) : (
      <NavCollapsible isActive={isActive} item={item} {...props} />
    );
  }

  return <NavLinkItem item={item} onNavigate={props.onNavigate} pathname={props.pathname} />;
}

type NavLinkItemProps = Pick<NavMenuItemProps, 'pathname' | 'onNavigate'> & { item: LiveNavLink };

function NavLinkItem({ item, pathname, onNavigate }: NavLinkItemProps) {
  const { t } = useTranslation();
  const title = t(item.titleKey);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={pathname === item.to}
        render={<Link onClick={onNavigate} to={item.to} />}
        tooltip={title}
      >
        {item.icon && <item.icon />}
        <span className="truncate">{title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

type NavParentProps = Omit<NavMenuItemProps, 'item' | 'isCollapsed'> & {
  item: LiveNavParent;
  isActive: boolean;
};

function NavCollapsible({
  item,
  pathname,
  isActive,
  open,
  onOpenChange,
  onNavigate,
}: NavParentProps) {
  const { t } = useTranslation();
  return (
    <Collapsible onOpenChange={onOpenChange} open={open} render={<SidebarMenuItem />}>
      <CollapsibleTrigger render={<SidebarMenuButton isActive={isActive} />}>
        {item.icon && <item.icon />}
        <span>{t(item.titleKey)}</span>
        <ChevronRightIcon className="ms-auto transition-transform rtl:rotate-180 group-data-panel-open/menu-button:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub end="flush">
          {item.items.map((child) => (
            <SidebarMenuSubItem key={child.titleKey}>
              <SidebarMenuSubButton
                isActive={pathname === child.to}
                render={<Link onClick={onNavigate} to={child.to} />}
              >
                {child.icon && <child.icon />}
                <span className="truncate">{t(child.titleKey)}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

// The icon rail has no room for a nested list, so children open beside it like the legacy navbar.
function NavFlyout({ item, isActive }: Pick<NavParentProps, 'item' | 'isActive'>) {
  const { t } = useTranslation();
  const title = t(item.titleKey);
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuButton aria-label={title} isActive={isActive} />}>
          {item.icon && <item.icon />}
          <span>{title}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="inline-end" sideOffset={12} width="wide">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            {item.items.map((child) => (
              <DropdownMenuItem key={child.titleKey} render={<Link to={child.to} />}>
                {child.icon && <child.icon />}
                <span className="truncate">{t(child.titleKey)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
