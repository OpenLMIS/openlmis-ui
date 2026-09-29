import { SunMoonIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
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
import { useAppConfigurationStore } from '@/lib/app-configuration';

const STORAGE_KEY = 'theme';
const DEFAULT_CHOICE = 'default';

type ThemeSwitcherProps = {
  tone?: 'default' | 'sidebar';
};

function storedChoice(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_CHOICE;
}

export function ThemeSwitcher({ tone = 'default' }: ThemeSwitcherProps) {
  const { t } = useTranslation();
  const { setTheme } = useTheme();
  const defaultAppearance = useAppConfigurationStore(
    (state) => state.configuration.theme.defaultAppearance ?? 'system',
  );
  const label = t('sidebar.toggle-theme');

  const choose = (choice: string) => {
    if (choice === DEFAULT_CHOICE) {
      setTheme(defaultAppearance);
      localStorage.removeItem(STORAGE_KEY);
    } else {
      setTheme(choice);
    }
  };

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
          onValueChange={(value) => choose(String(value))}
          value={storedChoice()}
        >
          <DropdownMenuRadioItem value="light">{t('sidebar.theme.light')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t('sidebar.theme.dark')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={DEFAULT_CHOICE}>
            {t('sidebar.theme.default')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
