import { SunMoonIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type ThemeSwitcherProps = {
  tone?: 'default' | 'sidebar';
};

export function ThemeSwitcher({ tone = 'default' }: ThemeSwitcherProps) {
  const { t } = useTranslation();
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const label = t('sidebar.toggle-theme');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            onClick={toggleTheme}
            size="icon-sm"
            tone={tone}
            variant="ghost"
          />
        }
      >
        <SunMoonIcon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
