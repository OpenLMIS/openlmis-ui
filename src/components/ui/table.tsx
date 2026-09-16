'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-xs', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({
  className,
  tone = 'default',
  interactive = true,
  ...props
}: React.ComponentProps<'tr'> & {
  tone?: 'default' | 'header';
  interactive?: boolean;
}) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
        interactive && 'hover:bg-muted/50',
        tone === 'header' && 'bg-muted/30',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({
  className,
  gutter = 'none',
  ...props
}: React.ComponentProps<'th'> & { gutter?: 'none' | 'start' | 'end' }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0',
        gutter === 'start' && 'pl-6',
        gutter === 'end' && 'pr-6',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  size = 'default',
  tone = 'default',
  emphasis = 'default',
  numeric = false,
  gutter = 'none',
  ...props
}: React.ComponentProps<'td'> & {
  size?: 'default' | 'sm';
  tone?: 'default' | 'muted';
  emphasis?: 'default' | 'medium';
  numeric?: boolean;
  gutter?: 'none' | 'start' | 'end';
}) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        size === 'sm' && 'text-sm',
        tone === 'muted' && 'text-muted-foreground',
        emphasis === 'medium' && 'font-medium',
        numeric && 'tabular-nums',
        gutter === 'start' && 'pl-6',
        gutter === 'end' && 'pr-6',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
