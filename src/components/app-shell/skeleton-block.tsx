import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** A placeholder whose size belongs to the layout around it, set by `className`. */
export function Block({ className, shape }: { className: string; shape?: 'circle' }) {
  return (
    <span className={cn('block', className)}>
      <Skeleton fill shape={shape} />
    </span>
  );
}
