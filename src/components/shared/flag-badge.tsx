import { CheckIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
    <Badge variant="success">
      <CheckIcon data-icon="inline-start" />
      {trueLabel}
    </Badge>
  ) : (
    <Badge variant="destructive">
      <XIcon data-icon="inline-start" />
      {falseLabel}
    </Badge>
  );
}
