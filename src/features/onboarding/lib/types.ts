import type { ParseKeys } from 'i18next';
import type { TourAnchor } from '@/lib/tour-anchors';
import type { FileRoutesById } from '@/route-tree.gen';

export type TourPlacement = 'top' | 'bottom' | 'inline-start' | 'inline-end' | 'center';

export type TourStep = {
  anchor: TourAnchor;
  title: ParseKeys;
  content: ParseKeys;
  placement?: TourPlacement;
};

export type Tour = {
  id: string;
  routeIds: readonly (keyof FileRoutesById)[];
  steps: readonly TourStep[];
};
