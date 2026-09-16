import { Link, useLocation } from '@tanstack/react-router';
import { SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CustomTrigger } from '@/components/custom-trigger';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LatestChange } from '@/components/latest-change';
import { Logo } from '@/components/logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
  const { isMobile, setOpenMobile } = useSidebar();
  const settingsLabel = t('sidebar.settings');

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar surface="background" collapsible="offcanvas" variant="sidebar">
      <SidebarHeader
        bordered
        className="h-(--app-header-height,3rem) flex-row items-center justify-between"
      >
        <Button
          padding="wide"
          className="h-10"
          variant="ghost"
          render={<Link to="/dashboard" onClick={closeMobileSidebar} />}
          nativeButton={false}
        >
          <Logo />
        </Button>
        <CustomTrigger place="sidebar" />
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const title = t(item.titleKey);
                return (
                  <SidebarMenuItem key={`${group.labelKey}-${item.titleKey}`}>
                    {item.to === '#' ? (
                      // Mocked placeholder item: renders as a non-navigating button.
                      <SidebarMenuButton tooltip={title}>
                        {item.icon && <item.icon />}
                        <span>{title}</span>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        isActive={pathname === item.to}
                        tooltip={title}
                        render={<Link to={item.to} onClick={closeMobileSidebar} />}
                      >
                        {item.icon && <item.icon />}
                        <span>{title}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter padding="wide">
        <LatestChange />
        <div className="flex items-center pt-4 pb-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
          {/* TODO: Wire up onClick (open settings dialog or navigate to /settings). */}
          <Tooltip>
            <TooltipTrigger
              render={<Button aria-label={settingsLabel} size="icon-sm" variant="ghost" />}
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
