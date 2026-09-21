import { SidebarMenuSkeleton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { NAV_GROUPS } from '@/lib/config';

export function AppShellSkeleton() {
  return (
    <div className="flex h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-e bg-sidebar md:flex">
        <div className="flex h-12 shrink-0 items-center border-b px-3">
          <div className="h-6 w-24">
            <Skeleton fill />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 p-3">
          {NAV_GROUPS.map((group) => (
            <div className="flex flex-col gap-2" key={group.labelKey}>
              <div className="h-3 w-16">
                <Skeleton fill />
              </div>
              {group.items.map((item) => (
                <SidebarMenuSkeleton key={`${group.labelKey}-${item.titleKey}`} showIcon />
              ))}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1 px-3 pt-4 pb-2">
          <div className="size-7">
            <Skeleton fill />
          </div>
          <div className="size-7">
            <Skeleton fill />
          </div>
          <div className="size-7">
            <Skeleton fill />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-2 md:px-4">
          <div className="size-7">
            <Skeleton fill />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-7">
              <Skeleton fill />
            </div>
            <div className="size-7">
              <Skeleton fill />
            </div>
            <div className="mx-2 h-4 w-px md:mx-4">
              <Skeleton fill />
            </div>
            <div className="size-8">
              <Skeleton fill shape="circle" />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-2 md:p-4">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
            <div className="h-8 w-48">
              <Skeleton fill />
            </div>
            <div className="h-4 w-full max-w-md">
              <Skeleton fill />
            </div>
            <div className="h-4 w-full max-w-sm">
              <Skeleton fill />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
