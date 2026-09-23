import { Link, useLocation } from '@tanstack/react-router';
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
import { getNavTrail } from '@/lib/config';

/** Home, then the current page's place in the nav. Hidden on Home itself and off-nav pages. */
export function AppBreadcrumbs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const trail = getNavTrail(pathname).filter((item) => item.to !== '/home');

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
