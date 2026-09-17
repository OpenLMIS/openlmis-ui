import type { ReactNode } from 'react';

// Page layout for everything inside the app shell. Parts take only `children` and
// no `className`, which is what keeps padding and heading scale equal across pages.

type WorkspaceProps = {
  children: ReactNode;
};

export function Workspace({ children }: WorkspaceProps) {
  return (
    <div className="@container/main mx-auto flex w-full flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
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

export function WorkspaceHeading({ children }: WorkspaceProps) {
  return <div className="flex min-w-0 flex-col gap-1">{children}</div>;
}

export function WorkspaceTitle({ children }: WorkspaceProps) {
  return (
    <h1 className="font-heading font-semibold text-xl leading-none tracking-tight">{children}</h1>
  );
}

export function WorkspaceDescription({ children }: WorkspaceProps) {
  return <p className="text-pretty text-muted-foreground text-sm">{children}</p>;
}

export function WorkspaceActions({ children }: WorkspaceProps) {
  return <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>;
}

export function WorkspaceContent({ children }: WorkspaceProps) {
  return <div className="flex flex-1 flex-col gap-4 lg:gap-6">{children}</div>;
}
