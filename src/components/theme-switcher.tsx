import { SunMoonIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { setAppearanceChoice, useAppearanceStore } from '@/lib/appearance';

const DEFAULT_CHOICE = 'default';

type ThemeSwitcherProps = {
  tone?: 'default' | 'sidebar';
};

export function ThemeSwitcher({ tone = 'default' }: ThemeSwitcherProps) {
  const { t } = useTranslation();
  const choice = useAppearanceStore((state) => state.choice ?? DEFAULT_CHOICE);
  const label = t('sidebar.theme');

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={<Button aria-label={label} size="icon-sm" tone={tone} variant="ghost" />}
            />
          }
        >
          <SunMoonIcon />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          onValueChange={(value) =>
            setAppearanceChoice(value === 'light' || value === 'dark' ? value : null)
          }
          value={choice}
        >
          <DropdownMenuRadioItem closeOnClick value="light">
            {t('sidebar.theme.light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem closeOnClick value="dark">
            {t('sidebar.theme.dark')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem closeOnClick value={DEFAULT_CHOICE}>
            {t('sidebar.theme.default')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
