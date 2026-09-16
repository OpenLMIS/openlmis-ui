import * as React from 'react';

import { cn } from '@/lib/utils';

function Card({
  className,
  size = 'default',
  surface = 'card',
  padding = 'default',
  ...props
}: React.ComponentProps<'div'> & {
  size?: 'default' | 'sm';
  surface?: 'card' | 'background';
  padding?: 'default' | 'flush-bottom';
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'group/card flex flex-col gap-4 overflow-hidden rounded-none bg-card py-4 text-xs/relaxed text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-2 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-none *:[img:last-child]:rounded-none',
        surface === 'background' && 'bg-background',
        padding === 'flush-bottom' && 'pb-0',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({
  className,
  spacing = 'default',
  ...props
}: React.ComponentProps<'div'> & { spacing?: 'default' | 'tight' }) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-none px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3',
        spacing === 'tight' && 'pb-2',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  variant = 'default',
  gap = 'default',
  ...props
}: React.ComponentProps<'div'> & {
  variant?: 'default' | 'metric';
  gap?: 'default' | 'sm';
}) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        'font-heading text-sm font-medium group-data-[size=sm]/card:text-sm',
        variant === 'metric' && 'text-2xl font-semibold tabular-nums @[250px]/card:text-3xl',
        gap === 'sm' && 'gap-2',
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-xs/relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  padding = 'default',
  ...props
}: React.ComponentProps<'div'> & { padding?: 'default' | 'flush' | 'roomy' }) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        'px-4 group-data-[size=sm]/card:px-3',
        padding === 'flush' && 'px-0',
        padding === 'roomy' && 'px-2 pt-4 sm:px-6 sm:pt-6',
        className,
      )}
      {...props}
    />
  );
}

function CardFooter({
  className,
  variant = 'default',
  gap = 'default',
  ...props
}: React.ComponentProps<'div'> & {
  variant?: 'default' | 'metric';
  gap?: 'default' | 'xs' | 'sm';
}) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center rounded-none border-t p-4 group-data-[size=sm]/card:p-3',
        variant === 'metric' && 'text-sm',
        gap === 'xs' && 'gap-1.5',
        gap === 'sm' && 'gap-2',
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
