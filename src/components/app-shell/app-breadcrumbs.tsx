import { Link, useLocation, useMatches } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanOpen } from '@/components/app-shell/nav-access';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { hiddenBreadcrumbCount } from '@/lib/breadcrumb-fit';
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
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const canOpen = useCanOpen();
  const match = useMatches({ select: (matches) => matches.at(-1) });
  const trail = getBreadcrumbTrail(pathname, match?.staticData.crumbKey);
  const parentIndex = trail.findLastIndex(
    (item, index) => index < trail.length - 1 && item.to && item.to !== '#' && canOpen(item.to),
  );
  const parentSearch = match?.staticData.crumbParentSearch?.(match.search);

  const labels = [t('home.title'), ...trail.map((item) => t(item.titleKey))];
  const labelsKey = JSON.stringify(labels);
  const [measureContainer, width] = useElementWidth<HTMLDivElement>();
  const measurements = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ widths: [] as number[], separatorSpace: 0, ellipsisWidth: 0 });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Remeasure when translated trail content changes.
  useLayoutEffect(() => {
    const element = measurements.current;
    if (!element) return;
    const measure = () => {
      const list = element.querySelector('ol');
      if (!list) return;
      const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0;
      const widths = Array.from(
        element.querySelectorAll('[data-measure-label]'),
        (label) => label.getBoundingClientRect().width,
      );
      const separatorSpace =
        (element.querySelector('[data-slot="breadcrumb-separator"]')?.getBoundingClientRect()
          .width ?? 0) +
        2 * gap;
      const ellipsisWidth =
        element.querySelector('[data-slot="breadcrumb-ellipsis"]')?.getBoundingClientRect().width ??
        0;
      setFit((previous) =>
        JSON.stringify(previous) === JSON.stringify({ widths, separatorSpace, ellipsisWidth })
          ? previous
          : { widths, separatorSpace, ellipsisWidth },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element.querySelector('ol') ?? element);
    return () => observer.disconnect();
  }, [labelsKey, i18n.resolvedLanguage]);

  const hidden = hiddenBreadcrumbCount(
    fit.widths,
    width ?? Number.POSITIVE_INFINITY,
    fit.separatorSpace,
    fit.ellipsisWidth,
  );
  const currentPage = useRef<HTMLSpanElement>(null);
  const [currentTruncated, setCurrentTruncated] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: The current span can remount when middle crumbs collapse.
  useLayoutEffect(() => {
    const element = currentPage.current;
    if (!element) return;
    const measure = () => setCurrentTruncated(element.scrollWidth > element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [labelsKey, hidden]);

  if (trail.length === 0) return null;

  const linkFor = (index: number) => {
    const item = trail[index];
    return item.to && item.to !== '#' && canOpen(item.to) ? (
      <Link to={item.to} search={index === parentIndex ? parentSearch : undefined} />
    ) : undefined;
  };

  const hiddenCrumbs = trail.slice(0, hidden).map((item, index) => ({
    key: item.titleKey,
    label: labels[index + 1],
    link: linkFor(index),
  }));

  return (
    <div ref={measureContainer} className="relative min-w-0">
      <div
        ref={measurements}
        aria-hidden="true"
        inert
        className="invisible absolute inset-0 overflow-hidden pointer-events-none"
      >
        <div className="w-max">
          <BreadcrumbList>
            {labels.map((label, index) => (
              <BreadcrumbItem key={index === 0 ? 'home.title' : trail[index - 1].titleKey}>
                <span data-measure-label>{label}</span>
              </BreadcrumbItem>
            ))}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
          </BreadcrumbList>
        </div>
      </div>
      <Breadcrumb aria-label={t('breadcrumbs.label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/home" />}>{labels[0]}</BreadcrumbLink>
          </BreadcrumbItem>
          {hidden > 0 && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {hiddenCrumbs.some((item) => item.link) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label={t('breadcrumbs.show-more')}>
                      <BreadcrumbEllipsis />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" width="auto">
                      <DropdownMenuGroup>
                        {hiddenCrumbs.map((item) =>
                          item.link ? (
                            <DropdownMenuItem key={item.key} render={item.link}>
                              {item.label}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuLabel key={item.key}>{item.label}</DropdownMenuLabel>
                          ),
                        )}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <>
                    <BreadcrumbEllipsis />
                    <span className="sr-only">
                      {hiddenCrumbs.map((item) => item.label).join(', ')}
                    </span>
                  </>
                )}
              </BreadcrumbItem>
            </>
          )}
          {trail.slice(hidden).map((item, offset) => {
            const index = offset + hidden;
            const current = index === trail.length - 1;
            const link = linkFor(index);
            return (
              <Fragment key={item.titleKey}>
                <BreadcrumbSeparator />
                <BreadcrumbItem current={current}>
                  {current ? (
                    <BreadcrumbPage
                      ref={currentPage}
                      title={currentTruncated ? labels[index + 1] : undefined}
                    >
                      {labels[index + 1]}
                    </BreadcrumbPage>
                  ) : link ? (
                    <BreadcrumbLink render={link}>{labels[index + 1]}</BreadcrumbLink>
                  ) : (
                    <span>{labels[index + 1]}</span>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
