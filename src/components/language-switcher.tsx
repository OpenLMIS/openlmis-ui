import { GlobeIcon } from 'lucide-react';
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
import { SUPPORTED_LANGUAGES } from '@/lib/config';

type LanguageSwitcherProps = {
  tone?: 'default' | 'sidebar';
};

export function LanguageSwitcher({ tone = 'default' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const label = t('sidebar.change-language');

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
          <GlobeIcon />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={i18n.resolvedLanguage}
          onValueChange={(value) => i18n.changeLanguage(value)}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <DropdownMenuRadioItem key={lang.code} value={lang.code}>
              {lang.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
