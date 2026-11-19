import type { ParseKeys } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import type { TourAnchor } from '@/lib/tour-anchors';
import type { FileRoutesById } from '@/route-tree.gen';

export type TourPlacement = 'top' | 'bottom' | 'inline-start' | 'inline-end' | 'center';

/** A status the step explains, drawn as the screen draws it, so it reads true on an empty list. */
export type TourLegendItem = {
  label: ParseKeys;
  text: ParseKeys;
  tone: 'secondary' | 'success' | 'info' | 'warning' | 'destructive' | 'outline';
  /** Left out where the screen's badge has no icon. */
  icon?: LucideIcon;
};

export type TourStep = {
  anchor: TourAnchor;
  title: ParseKeys;
  content: ParseKeys;
  placement?: TourPlacement;
  /** Opens the anchored menu section for this step and closes it afterwards. */
  expand?: boolean;
  /** Highlights this part instead of the anchor, which still positions the tooltip. */
  spotlight?: TourAnchor;
  /** Clicks this tab first; the tour gives the user's tab back when it ends. */
  select?: TourAnchor;
  legend?: readonly TourLegendItem[];
  /** In a table, highlights this column's header within the spotlit part, found by its label. */
  column?: ParseKeys;
};

export type Tour = {
  id: string;
  routeIds: readonly (keyof FileRoutesById)[];
  steps: readonly TourStep[];
};
