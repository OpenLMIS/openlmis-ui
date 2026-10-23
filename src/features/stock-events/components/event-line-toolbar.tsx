import type { ReactNode } from 'react';

export function EventLineToolbarActions({ children }: { children: ReactNode }) {
  return (
    <div className="ms-auto flex min-w-0 flex-1 basis-full flex-wrap items-center justify-end gap-2 @2xl/main:basis-0">
      {children}
    </div>
  );
}

export function EventLineToolbarStatus({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-9 min-w-0 flex-1 basis-full flex-wrap items-center justify-end gap-2 empty:hidden @2xl/main:basis-48">
      {children}
    </div>
  );
}

export function EventLineToolbarControls({ children }: { children: ReactNode }) {
  return (
    <div className="ms-auto flex max-w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2 @2xl/main:flex-none">
      {children}
    </div>
  );
}
