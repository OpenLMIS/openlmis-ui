import { useTranslation } from 'react-i18next';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

type CustomTriggerProps = {
  place: 'sidebar' | 'navbar';
};

// One toggle at a time: the inactive placement unmounts so it reserves no space.
export function CustomTrigger({ place }: CustomTriggerProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { open, openMobile } = useSidebar();
  const sidebarOpen = isMobile ? openMobile : open;
  const label = t('sidebar.toggle-sidebar');

  if (sidebarOpen === (place === 'navbar')) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SidebarTrigger aria-label={label} tone={place === 'sidebar' ? 'sidebar' : 'default'} />
        }
      />
      <TooltipContent side={place === 'navbar' ? 'bottom' : 'top'}>
        {label}
        <KbdGroup>
          <Kbd size="sm">Ctrl</Kbd>
          <Kbd size="sm">B</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
