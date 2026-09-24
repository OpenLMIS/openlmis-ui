import { Link, useLocation, useMatches } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getNavTrail, type NavTrailItem } from '@/lib/config';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: router types extend by interface merging.
  interface StaticDataRouteOption {
    /** The last crumb of a page below a nav entry, e.g. a user's roles below Users. */
    crumbKey?: ParseKeys;
  }
}

/** Home, then the current page's place in the nav. Hidden on Home itself and off-nav pages. */
export function AppBreadcrumbs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const crumbKey = useMatches({ select: (matches) => matches.at(-1)?.staticData.crumbKey });
  const navTrail = getNavTrail(pathname).filter((item) => item.to !== '/home');
  const trail: NavTrailItem[] =
    crumbKey && navTrail.length > 0 ? [...navTrail, { titleKey: crumbKey }] : navTrail;

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
              ) : item.to && item.to !== '#' ? (
                <BreadcrumbLink render={<Link to={item.to} />}>{t(item.titleKey)}</BreadcrumbLink>
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
