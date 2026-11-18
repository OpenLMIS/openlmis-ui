import { CheckIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export function FlagBadge({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
}) {
  return value ? (
    <Badge data-tour={TOUR_ANCHORS.listFlag} variant="success">
      <CheckIcon data-icon="inline-start" />
      {trueLabel}
    </Badge>
  ) : (
    <Badge data-tour={TOUR_ANCHORS.listFlag} variant="destructive">
      <XIcon data-icon="inline-start" />
      {falseLabel}
    </Badge>
  );
}
