import { cn } from '@/lib/utils';

function Skeleton({
  className,
  shape = 'default',
  ...props
}: React.ComponentProps<'div'> & { shape?: 'default' | 'circle' }) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-none bg-muted', shape === 'circle' && 'rounded-full', className)}
      {...props}
    />
  );
}

export { Skeleton };
