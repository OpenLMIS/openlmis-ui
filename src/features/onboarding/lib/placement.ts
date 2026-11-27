import type { Placement } from 'react-joyride';
import type { TourPlacement } from '@/features/onboarding/lib/types';

export function toJoyridePlacement(
  placement: TourPlacement,
  direction: 'ltr' | 'rtl',
): Placement | 'center' {
  if (placement === 'inline-start') return direction === 'rtl' ? 'right' : 'left';
  if (placement === 'inline-end') return direction === 'rtl' ? 'left' : 'right';
  return placement;
}
