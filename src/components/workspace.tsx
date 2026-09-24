import type { ReactNode } from 'react';
import { AppBreadcrumbs } from '@/components/app-breadcrumbs';

// Page layout for everything inside the app shell. Parts take only `children` and
// no `className`, which is what keeps padding and heading scale equal across pages.

type WorkspaceProps = {
  children: ReactNode;
};

export function Workspace({ children }: WorkspaceProps) {
  return (
    <div className="@container/main mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
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
  // One line at most, so every header keeps the same height; longer text is cut with an ellipsis.
  return <p className="min-w-0 truncate text-muted-foreground text-sm">{children}</p>;
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
export function WorkspaceFooter({ children }: WorkspaceProps) {
  return (
    <div
      className="sticky bottom-0 z-10 border-t bg-muted/80 backdrop-blur-sm"
      data-slot="workspace-footer"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 lg:px-6">
        {children}
      </div>
    </div>
  );
}
