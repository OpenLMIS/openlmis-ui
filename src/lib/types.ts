import type { LinkProps } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import type { LucideIcon } from 'lucide-react';

export type NavLink = {
  titleKey: ParseKeys;
  /** `'#'` marks a page that is not migrated yet; it renders disabled. */
  to: LinkProps['to'] | '#';
  icon?: LucideIcon;
};

/** Expands in place in the sidebar and opens as a flyout menu when the sidebar is collapsed. */
export type NavParent = {
  titleKey: ParseKeys;
  icon?: LucideIcon;
  items: NavLink[];
};

export type NavItem = NavLink | NavParent;

export type NavGroup = {
  labelKey?: ParseKeys;
  items: NavItem[];
};

export type TextDirection = 'ltr' | 'rtl';

export type SupportedLanguage = {
  code: string;
  /** Endonym, so the switcher reads in the language it selects. */
  name: string;
  dir: TextDirection;
};

/** A Spring Data page, the shape every paginated OpenLMIS endpoint returns. */
export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};
