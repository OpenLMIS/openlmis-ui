import { Link, useLocation, useMatches } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanOpen } from '@/components/nav-access';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getBreadcrumbTrail } from '@/lib/config';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router types extend by interface merging.
  interface StaticDataRouteOption {
    /** The last crumb: a page below a nav entry, e.g. a user's roles, or a page off the nav. */
    crumbKey?: ParseKeys;
    crumbParentSearch?: (search: Record<string, unknown>) => Record<string, unknown>;
  }
}

/** Home, then the current page's place in the nav. Hidden on Home and on off-nav pages without a crumb. */
export function AppBreadcrumbs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const canOpen = useCanOpen();
  const match = useMatches({ select: (matches) => matches.at(-1) });
  const trail = getBreadcrumbTrail(pathname, match?.staticData.crumbKey);
  const parentIndex = trail.findLastIndex(
    (item, index) => index < trail.length - 1 && item.to && item.to !== '#' && canOpen(item.to),
  );
  const parentSearch = match?.staticData.crumbParentSearch?.(match.search);

  if (trail.length === 0) return null;

  return (
    <Breadcrumb aria-label={t('breadcrumbs.label')}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link to="/home" />}>{t('home.title')}</BreadcrumbLink>
        </BreadcrumbItem>
        {trail.map((item, index) => (
          <Fragment key={item.titleKey}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {index === trail.length - 1 ? (
                <BreadcrumbPage>{t(item.titleKey)}</BreadcrumbPage>
              ) : item.to && item.to !== '#' && canOpen(item.to) ? (
                <BreadcrumbLink
                  render={
                    <Link to={item.to} search={index === parentIndex ? parentSearch : undefined} />
                  }
                >
                  {t(item.titleKey)}
                </BreadcrumbLink>
              ) : (
                <span>{t(item.titleKey)}</span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
