import type { ReactNode } from 'react';
import { AppBreadcrumbs } from '@/components/app-breadcrumbs';
import { cn } from '@/lib/utils';

// Page layout inside the app shell; no part takes a `className`, so every page lines up.

type WorkspaceProps = {
  children: ReactNode;
};

type WorkspaceWidthProps = WorkspaceProps & {
  /** `narrow` for a page of settings, which reads better as one short column. */
  width?: 'default' | 'narrow' | 'wide';
};

const MAX_WIDTH = { default: 'max-w-6xl', narrow: 'max-w-4xl', wide: 'max-w-none' } as const;

export function Workspace({ children, width = 'default' }: WorkspaceWidthProps) {
  return (
    <div
      className={cn(
        '@container/main mx-auto flex w-full flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6',
        MAX_WIDTH[width],
      )}
    >
      <AppBreadcrumbs />
      {children}
    </div>
  );
}

export function WorkspaceHeader({ children }: WorkspaceProps) {
  return (
    <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:items-start @2xl/main:justify-between">
      {children}
    </div>
  );
}

// With an icon, the icon spans both text rows; without one, the heading is a single column.
export function WorkspaceHeading({ children }: WorkspaceProps) {
  return (
    <div className="grid min-w-0 content-start gap-y-1 has-data-[slot=workspace-icon]:grid-cols-label-value has-data-[slot=workspace-icon]:gap-x-3">
      {children}
    </div>
  );
}

export function WorkspaceIcon({ children }: WorkspaceProps) {
  return (
    <div
      className="row-span-2 flex size-10 items-center justify-center self-center rounded-lg border bg-card text-muted-foreground shadow-xs [&_svg]:size-5"
      data-slot="workspace-icon"
    >
      {children}
    </div>
  );
}

export function WorkspaceTitle({ children }: WorkspaceProps) {
  return (
    <h1 className="font-heading font-semibold text-xl leading-none tracking-tight">{children}</h1>
  );
}

export function WorkspaceDescription({ children }: WorkspaceProps) {
  return (
    <p className="min-w-0 break-words text-muted-foreground text-sm @2xl/main:truncate">
      {children}
    </p>
  );
}

// Under a stacked header the actions share the full width; beside it they take their own.
export function WorkspaceActions({ children }: WorkspaceProps) {
  return (
    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 *:flex-1 @2xl/main:w-auto @2xl/main:*:flex-none">
      {children}
    </div>
  );
}

export function WorkspaceContent({ children }: WorkspaceProps) {
  return <div className="flex flex-1 flex-col gap-4 lg:gap-6">{children}</div>;
}

/** Rendered after `Workspace`: full width, stuck to the bottom, buttons aligned with the page. */
export function WorkspaceFooter({ children, width = 'default' }: WorkspaceWidthProps) {
  return (
    <div
      className="sticky bottom-0 z-10 border-t bg-muted/80 backdrop-blur-sm"
      data-slot="workspace-footer"
    >
      <div
        className={cn(
          'mx-auto flex w-full items-center justify-between gap-2 px-4 py-3 lg:px-6',
          MAX_WIDTH[width],
        )}
      >
        {children}
      </div>
    </div>
  );
}
