import type { LinkProps } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import type { LucideIcon } from 'lucide-react';

export type ApiResponse<T> = {
  data: T;
  message: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type NavItem = {
  titleKey: ParseKeys;
  // Use a real typed route for functional links; use '#' to mark a mocked/placeholder
  // item that renders as a non-navigating button (see AppSidebar).
  to: LinkProps['to'] | '#';
  icon?: LucideIcon;
};

export type NavGroup = {
  labelKey: ParseKeys;
  items: NavItem[];
};
