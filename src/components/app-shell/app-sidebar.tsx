import { Link, useLocation } from '@tanstack/react-router';
import {
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  WifiOffIcon,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { BackToLegacyButton } from '@/components/app-shell/back-to-legacy-button';
import { CustomTrigger } from '@/components/app-shell/custom-trigger';
import { useDeviceWork } from '@/components/app-shell/device-work';
import { LanguageSwitcher } from '@/components/app-shell/language-switcher';
import { Logo } from '@/components/app-shell/logo';
import { useAccountLinks, useNavGroups } from '@/components/app-shell/nav-access';
import { useOfflineNavigation } from '@/components/app-shell/offline-navigation';
import { SidebarNotices } from '@/components/app-shell/sidebar-notices';
import { ThemeSwitcher } from '@/components/app-shell/theme-switcher';
import { UpdateButton } from '@/components/app-shell/update-button';
import { LocalizedCount } from '@/components/i18n/localized-count';
import { ActionTooltip } from '@/components/shared/action-tooltip';
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useStoredState } from '@/hooks/use-stored-state';
import { useAppName, useShowAppName } from '@/lib/app-configuration';
import { getNavTrail, isNavActive, isNavParent } from '@/lib/config';
import { getSessionUserId } from '@/lib/session-scope';
import type { LiveNavItem, LiveNavLink, LiveNavParent } from '@/lib/types';

export const AppSidebar = memo(function AppSidebar() {
  const { isMobile, setOpenMobile, state } = useSidebar();
  const direction = useDirection();
  const railTooltipSide = !isMobile && state === 'collapsed' ? 'inline-end' : 'top';
  const appName = useAppName();
  const showAppName = useShowAppName();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [openSections, setOpenSections] = useOpenNavSections(pathname);

  // The rail only has room for a smaller mark; the mobile sheet is always full width.
  const isCollapsed = !isMobile && state === 'collapsed';

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
          size={isCollapsed ? 'icon' : 'lg'}
          tone="sidebar"
          variant="ghost"
          width="shrink"
        >
          <Logo
            alt={isCollapsed || !showAppName ? undefined : ''}
            className={isCollapsed || showAppName ? undefined : 'h-6 max-w-44'}
          />
          {!isCollapsed && showAppName && (
            <span className="truncate font-semibold" dir="auto">
              {appName}
            </span>
          )}
        </Button>
        <CustomTrigger place="sidebar" />
      </SidebarHeader>

      <SidebarNavigation
        isCollapsed={isCollapsed}
        onNavigate={closeMobileSidebar}
        openSections={openSections}
        pathname={pathname}
        setOpenSections={setOpenSections}
      />

      <SidebarFooter>
        <div className="max-h-64 scroll-py-2 overflow-y-auto overscroll-contain pb-2">
          <SidebarNotices />
        </div>
        <div className="flex items-center group-data-[collapsible=icon]:flex-col">
          <ThemeSwitcher tone="sidebar" tooltipSide={railTooltipSide} />
          <LanguageSwitcher tone="sidebar" tooltipSide={railTooltipSide} />
          <div className="ms-auto flex items-center group-data-[collapsible=icon]:ms-0 group-data-[collapsible=icon]:flex-col">
            <UpdateButton tooltipSide={railTooltipSide} />
            <BackToLegacyButton tooltipSide={railTooltipSide} />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
});

const findActiveParent = (pathname: string) => {
  const trail = getNavTrail(pathname);
  return trail.length > 1 ? (trail[0]?.titleKey ?? null) : null;
};

const openSectionsSchema = z.array(z.string());

function useOpenNavSections(pathname: string) {
  const activeParent = findActiveParent(pathname);
  const [openSections, setOpenSections] = useStoredState(
    `sidebar.open-sections.${getSessionUserId()}`,
    openSectionsSchema,
    activeParent ? [activeParent] : [],
  );
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (activeParent && !openSections.includes(activeParent)) {
      setOpenSections([...openSections, activeParent]);
    }
  }, [activeParent, openSections, pathname, setOpenSections]);

  return [openSections, setOpenSections] as const;
}

function SidebarNavigation({
  isCollapsed,
  onNavigate,
  openSections,
  pathname,
  setOpenSections,
}: {
  isCollapsed: boolean;
  onNavigate: () => void;
  openSections: string[];
  pathname: string;
  setOpenSections: (sections: string[]) => void;
}) {
  const { t } = useTranslation();
  const navGroups = useNavGroups();
  const accountLinks = useAccountLinks();
  const sidebarGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) =>
      !isNavParent(item) &&
      (item.to === '/offline-events' ||
        (item.to === '/home' &&
          !group.items.some((entry) => !isNavParent(entry) && entry.to === '/offline-events')))
        ? [item, ...accountLinks]
        : [item],
    ),
  }));
  return (
    <SidebarContent>
      {sidebarGroups.map((group) => {
        const sections = group.items.filter(isNavParent).map((item) => item.titleKey);

        return (
          <SidebarGroup key={group.labelKey ?? group.items[0]?.titleKey}>
            {group.labelKey && (
              <SidebarGroupLabel>
                {t(group.labelKey)}
                {!isCollapsed && sections.length > 0 && (
                  <div className="ms-auto flex shrink-0 items-center gap-1">
                    <ActionTooltip reason={t('sidebar.expand-all')}>
                      <Button
                        aria-label={t('sidebar.expand-all')}
                        disabled={sections.every((section) => openSections.includes(section))}
                        focusableWhenDisabled
                        onClick={() => setOpenSections(sections)}
                        size="icon-xs"
                        tone="sidebar"
                        variant="ghost"
                      >
                        <ChevronsUpDownIcon aria-hidden />
                      </Button>
                    </ActionTooltip>
                    <ActionTooltip reason={t('sidebar.collapse-all')}>
                      <Button
                        aria-label={t('sidebar.collapse-all')}
                        disabled={!sections.some((section) => openSections.includes(section))}
                        focusableWhenDisabled
                        onClick={() => setOpenSections([])}
                        size="icon-xs"
                        tone="sidebar"
                        variant="ghost"
                      >
                        <ChevronsDownUpIcon aria-hidden />
                      </Button>
                    </ActionTooltip>
                  </div>
                )}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavMenuItem
                    isCollapsed={isCollapsed}
                    item={item}
                    key={item.titleKey}
                    onNavigate={onNavigate}
                    onOpenChange={(open) =>
                      setOpenSections(
                        open
                          ? [...openSections, item.titleKey]
                          : openSections.filter((section) => section !== item.titleKey),
                      )
                    }
                    open={openSections.includes(item.titleKey)}
                    pathname={pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </SidebarContent>
  );
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

  return item.to === '/offline-events' ? (
    <OfflineEventsNavItem item={item} onNavigate={props.onNavigate} pathname={props.pathname} />
  ) : (
    <NavLinkItem item={item} onNavigate={props.onNavigate} pathname={props.pathname} />
  );
}

type NavLinkItemProps = Pick<NavMenuItemProps, 'pathname' | 'onNavigate'> & { item: LiveNavLink };

function OfflineEventsNavItem(props: NavLinkItemProps) {
  const { pending, refused, uncertain } = useDeviceWork();
  return <NavLinkItem {...props} count={pending} needsAction={refused + uncertain} />;
}

function NavLinkItem({
  item,
  pathname,
  onNavigate,
  count = 0,
  needsAction = 0,
}: NavLinkItemProps & { count?: number; needsAction?: number }) {
  const { t } = useTranslation();
  const title = t(item.titleKey);
  const offline = useOfflineNavigation();
  const label = [
    count ? t('offline-events.nav-count', { count }) : title,
    needsAction ? t('offline-events.action-needed-count', { count: needsAction }) : undefined,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={pathname === item.to || pathname.startsWith(`${item.to}/`)}
        data-unavailable={item.connectionRequired || undefined}
        aria-describedby={item.connectionRequired ? offline.descriptionId : undefined}
        onClick={item.connectionRequired ? (event) => offline.show(event.currentTarget) : undefined}
        aria-label={label}
        render={
          item.connectionRequired ? (
            <button type="button" />
          ) : (
            <Link onClick={onNavigate} to={item.to} />
          )
        }
        tooltip={
          item.connectionRequired
            ? {
                children: (
                  <div>
                    <div>{label}</div>
                    <div>{t('offline.connection-required')}</div>
                  </div>
                ),
              }
            : label
        }
      >
        {item.icon && <item.icon />}
        <span className="truncate">{title}</span>
        {item.connectionRequired && <WifiOffIcon aria-hidden="true" />}
      </SidebarMenuButton>
      {count > 0 && (
        <SidebarMenuBadge collapsed="indicator" aria-hidden>
          <LocalizedCount count={count} />
        </SidebarMenuBadge>
      )}
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
  const offline = useOfflineNavigation();
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
                data-unavailable={child.connectionRequired || undefined}
                isActive={isNavActive(pathname, child.to)}
                onClick={
                  child.connectionRequired
                    ? (event) => offline.show(event.currentTarget)
                    : undefined
                }
                aria-describedby={child.connectionRequired ? offline.descriptionId : undefined}
                aria-label={t(child.titleKey)}
                render={
                  child.connectionRequired ? (
                    <button type="button" />
                  ) : (
                    <Link onClick={onNavigate} to={child.to} />
                  )
                }
              >
                {child.icon && <child.icon />}
                <span className="truncate">{t(child.titleKey)}</span>
                {child.connectionRequired && <WifiOffIcon aria-hidden="true" />}
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
  const offline = useOfflineNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <SidebarMenuItem>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(next) => {
          if (!offline.open) setMenuOpen(next);
        }}
      >
        <DropdownMenuTrigger render={<SidebarMenuButton aria-label={title} isActive={isActive} />}>
          {item.icon && <item.icon />}
          <span>{title}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="inline-end" sideOffset={12} width="wide">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            {item.items.map((child) => (
              <DropdownMenuItem
                key={child.titleKey}
                data-unavailable={child.connectionRequired || undefined}
                closeOnClick={!child.connectionRequired}
                onClick={
                  child.connectionRequired
                    ? (event) => {
                        event.preventDefault();
                        offline.show(event.currentTarget);
                      }
                    : undefined
                }
                aria-describedby={child.connectionRequired ? offline.descriptionId : undefined}
                render={child.connectionRequired ? undefined : <Link to={child.to} />}
              >
                {child.icon && <child.icon />}
                <span className="truncate">{t(child.titleKey)}</span>
                {child.connectionRequired && <WifiOffIcon aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
