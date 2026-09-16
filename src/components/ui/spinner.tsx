import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';

function Spinner({
  className,
  tone = 'default',
  ...props
}: React.ComponentProps<'svg'> & { tone?: 'default' | 'muted' }) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', tone === 'muted' && 'text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Spinner };
