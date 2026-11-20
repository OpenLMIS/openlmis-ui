import { CheckIcon, TriangleAlertIcon } from 'lucide-react';
import type { Tour } from '@/features/onboarding/lib/types';
import { sortStep, viewSortStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const profileTour: Tour = {
  id: 'profile',
  routeIds: [
    '/(protected)/_protected/profile/',
    '/(protected)/_protected/profile/notifications',
    '/(protected)/_protected/profile/roles',
  ],
  steps: [
    {
      anchor: TOUR_ANCHORS.profilePassword,
      title: 'onboarding.profile.password.title',
      content: 'onboarding.profile.password.content',
    },
    {
      anchor: TOUR_ANCHORS.editorTabs,
      title: 'onboarding.profile.sections.title',
      content: 'onboarding.profile.sections.content',
    },
    {
      // A tall form under the tabs leaves no room above it, so the tooltip hangs from the tabs.
      anchor: TOUR_ANCHORS.editorTabs,
      spotlight: TOUR_ANCHORS.profileDetails,
      title: 'onboarding.profile.details.title',
      content: 'onboarding.profile.details.content',
      legend: [
        {
          label: 'users.form.email-verified',
          text: 'onboarding.profile.legend.verified',
          tone: 'success',
          icon: CheckIcon,
        },
        {
          label: 'users.form.email-unverified',
          text: 'onboarding.profile.legend.unverified',
          tone: 'secondary',
        },
      ],
    },
    {
      anchor: TOUR_ANCHORS.editorTabs,
      spotlight: TOUR_ANCHORS.profileNotifications,
      title: 'onboarding.profile.notifications.title',
      content: 'onboarding.profile.notifications.content',
    },
    {
      anchor: TOUR_ANCHORS.roleTypes,
      title: 'onboarding.profile.role-types.title',
      content: 'onboarding.profile.role-types.content',
    },
    {
      anchor: TOUR_ANCHORS.listSearch,
      title: 'onboarding.profile.role-search.title',
      content: 'onboarding.profile.role-search.content',
    },
    viewSortStep,
    {
      // A tall list leaves no room above it, so the tooltip hangs from the role types above it.
      anchor: TOUR_ANCHORS.roleTypes,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.profile.roles.title',
      content: 'onboarding.profile.roles.content',
      legend: [
        {
          label: 'users.roles.ignored',
          text: 'onboarding.profile.legend.ignored',
          tone: 'warning',
          icon: TriangleAlertIcon,
        },
      ],
    },
    sortStep,
    {
      anchor: TOUR_ANCHORS.accountSave,
      title: 'onboarding.profile.save.title',
      content: 'onboarding.profile.save.content',
      placement: 'top',
    },
  ],
};

const settingsTour: Tour = {
  id: 'settings',
  routeIds: [
    '/(protected)/_protected/settings/',
    '/(protected)/_protected/settings/theme',
    '/(protected)/_protected/settings/feature-flags',
  ],
  steps: [
    {
      anchor: TOUR_ANCHORS.settingsReset,
      title: 'onboarding.settings.reset.title',
      content: 'onboarding.settings.reset.content',
    },
    {
      anchor: TOUR_ANCHORS.editorTabs,
      title: 'onboarding.settings.sections.title',
      content: 'onboarding.settings.sections.content',
    },
    {
      // Tall settings under the tabs leave no room above them, so the tooltip hangs from the tabs.
      anchor: TOUR_ANCHORS.editorTabs,
      spotlight: TOUR_ANCHORS.settingsBranding,
      title: 'onboarding.settings.branding.title',
      content: 'onboarding.settings.branding.content',
    },
    {
      anchor: TOUR_ANCHORS.editorTabs,
      spotlight: TOUR_ANCHORS.settingsTheme,
      title: 'onboarding.settings.theme.title',
      content: 'onboarding.settings.theme.content',
    },
    {
      anchor: TOUR_ANCHORS.settingsPreview,
      title: 'onboarding.settings.preview.title',
      content: 'onboarding.settings.preview.content',
    },
    {
      anchor: TOUR_ANCHORS.listSearch,
      title: 'onboarding.settings.flags-search.title',
      content: 'onboarding.settings.flags-search.content',
    },
    {
      anchor: TOUR_ANCHORS.listSearch,
      spotlight: TOUR_ANCHORS.settingsFlags,
      title: 'onboarding.settings.flags.title',
      content: 'onboarding.settings.flags.content',
    },
    {
      anchor: TOUR_ANCHORS.accountSave,
      title: 'onboarding.settings.save.title',
      content: 'onboarding.settings.save.content',
      placement: 'top',
    },
  ],
};

export const accountTours: readonly Tour[] = [profileTour, settingsTour];
