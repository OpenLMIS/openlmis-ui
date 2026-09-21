import type { LinkProps } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  titleKey: ParseKeys;
  /** `'#'` marks a placeholder that renders as a non-navigating button. */
  to: LinkProps['to'] | '#';
  icon?: LucideIcon;
};

export type NavGroup = {
  labelKey: ParseKeys;
  items: NavItem[];
};

export type TextDirection = 'ltr' | 'rtl';

export type SupportedLanguage = {
  code: string;
  /** Endonym, so the switcher reads in the language it selects. */
  name: string;
  dir: TextDirection;
};
