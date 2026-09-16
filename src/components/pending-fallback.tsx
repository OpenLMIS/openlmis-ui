import { Spinner } from '@/components/ui/spinner';

export function PendingFallback() {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <Spinner tone="muted" className="size-6" />
    </div>
  );
}
