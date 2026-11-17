import type { ParseKeys } from 'i18next';
import type { TourAnchor } from '@/lib/tour-anchors';
import type { FileRoutesById } from '@/route-tree.gen';

export type TourPlacement = 'top' | 'bottom' | 'inline-start' | 'inline-end' | 'center';

export type TourStep = {
  anchor: TourAnchor;
  title: ParseKeys;
  content: ParseKeys;
  placement?: TourPlacement;
  /** Opens the anchored menu section for this step and closes it afterwards. */
  expand?: boolean;
  /** Highlights this part instead of the anchor, which still positions the tooltip. */
  spotlight?: TourAnchor;
};

export type Tour = {
  id: string;
  routeIds: readonly (keyof FileRoutesById)[];
  steps: readonly TourStep[];
};
