import type { Tour } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const reportsTour: Tour = {
  id: 'reports',
  routeIds: ['/(protected)/_protected/reports'],
  steps: [
    {
      anchor: TOUR_ANCHORS.reportsCategory,
      spotlight: TOUR_ANCHORS.reportsCatalog,
      title: 'onboarding.reports.categories.title',
      content: 'onboarding.reports.categories.content',
    },
    {
      anchor: TOUR_ANCHORS.reportsLink,
      title: 'onboarding.reports.open.title',
      content: 'onboarding.reports.open.content',
    },
  ],
};

const reportGenerateTour: Tour = {
  id: 'report-generate',
  routeIds: ['/(protected)/_protected/reports_/$module/$reportId/generate'],
  steps: [
    {
      // A long form leaves no room below it, so the tooltip hangs from the first option.
      anchor: TOUR_ANCHORS.reportFirstOption,
      spotlight: TOUR_ANCHORS.reportOptions,
      title: 'onboarding.report-generate.options.title',
      content: 'onboarding.report-generate.options.content',
    },
    {
      anchor: TOUR_ANCHORS.reportFormat,
      title: 'onboarding.report-generate.format.title',
      content: 'onboarding.report-generate.format.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.reportGenerate,
      title: 'onboarding.report-generate.generate.title',
      content: 'onboarding.report-generate.generate.content',
      placement: 'top',
    },
  ],
};

export const reportsTours: readonly Tour[] = [reportsTour, reportGenerateTour];
