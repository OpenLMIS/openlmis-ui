import { SidebarMenuSkeleton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { NAV_GROUPS } from '@/lib/config';

export function AppShellSkeleton() {
  return (
    <div className="flex h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex h-12 shrink-0 items-center border-b px-3">
          <Skeleton className="h-6 w-24" />
        </div>

        {/* flex-1 pushes the footer (LatestChange + button row) to the bottom */}
        <div className="flex flex-1 flex-col gap-6 p-3">
          {NAV_GROUPS.map((group) => (
            <div className="flex flex-col gap-2" key={group.labelKey}>
              <Skeleton className="h-3 w-16" />
              {group.items.map((item) => (
                <SidebarMenuSkeleton key={`${group.labelKey}-${item.titleKey}`} showIcon />
              ))}
            </div>
          ))}
        </div>

        <div className="shrink-0 px-4">
          <div className="border bg-muted p-3 dark:bg-background">
            <div className="flex items-start gap-2.5">
              <Skeleton className="mt-0.5 size-6 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-2.5 w-3/4" />
              </div>
            </div>
            <Skeleton className="mt-3 h-7 w-full" />
          </div>
          <div className="flex items-center gap-1 pt-4 pb-2">
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-2 md:px-4">
          <Skeleton className="size-7" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
            <Skeleton className="mx-2 h-4 w-px md:mx-4" />
            <Skeleton shape="circle" className="size-8" />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 bg-muted p-2 dark:bg-background md:p-4">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
