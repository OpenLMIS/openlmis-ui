import { Link, useLocation } from '@tanstack/react-router';
import { SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CustomTrigger } from '@/components/custom-trigger';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Logo } from '@/components/logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NAV_GROUPS } from '@/lib/config';

export function AppSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const settingsLabel = t('sidebar.settings');

  // The rail only has room for a smaller mark; the mobile sheet is always full width.
  const isCollapsed = !isMobile && state === 'collapsed';

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader bordered layout="bar">
        <Button
          nativeButton={false}
          render={<Link onClick={closeMobileSidebar} to="/dashboard" />}
          size={isCollapsed ? 'icon' : 'icon-lg'}
          tone="sidebar"
          variant="ghost"
        >
          <Logo />
        </Button>
        <CustomTrigger place="sidebar" />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const title = t(item.titleKey);
                  return (
                    <SidebarMenuItem key={`${group.labelKey}-${item.titleKey}`}>
                      {item.to === '#' ? (
                        <SidebarMenuButton tooltip={title}>
                          {item.icon && <item.icon />}
                          <span>{title}</span>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          isActive={pathname === item.to}
                          render={<Link onClick={closeMobileSidebar} to={item.to} />}
                          tooltip={title}
                        >
                          {item.icon && <item.icon />}
                          <span>{title}</span>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
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
