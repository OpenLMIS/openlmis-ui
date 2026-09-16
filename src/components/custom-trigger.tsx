import { useTranslation } from 'react-i18next';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type CustomTriggerProps = {
  place: 'sidebar' | 'navbar';
};

export function CustomTrigger({ place }: CustomTriggerProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { open, openMobile } = useSidebar();
  const sidebarOpen = isMobile ? openMobile : open;
  const label = t('sidebar.toggle-sidebar');
  const hidden = sidebarOpen === (place === 'navbar');

  return (
    <Tooltip>
      <span
        className={cn(
          'inline-flex transition-opacity duration-0 ease-out motion-reduce:transition-none',
          !sidebarOpen && place === 'navbar' && 'delay-100 duration-300',
          hidden && 'pointer-events-none opacity-0',
        )}
      >
        <TooltipTrigger
          render={<SidebarTrigger aria-label={label} tabIndex={hidden ? -1 : undefined} />}
        />
      </span>
      <TooltipContent side={place === 'navbar' ? 'bottom' : 'top'}>
        {label}
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>B</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
