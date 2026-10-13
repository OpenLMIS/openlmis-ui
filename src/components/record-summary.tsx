import { createContext, type ReactNode, use, useId } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const FIELD_CLASS =
  'flex min-w-0 items-baseline justify-between gap-4 py-2 @2xl/main:flex-col @2xl/main:justify-start @2xl/main:gap-1 @2xl/main:py-0';
const SummaryContext = createContext<{ headingId: string; busy: boolean } | null>(null);

function useSummary() {
  const context = use(SummaryContext);
  if (!context) throw new Error('Record summary parts require RecordSummary');
  return context;
}

export function RecordSummary({
  children,
  'aria-label': label,
  'aria-busy': busy = false,
}: {
  children: ReactNode;
  'aria-label'?: string;
  'aria-busy'?: boolean;
}) {
  const headingId = useId();
  const Frame = busy ? 'div' : 'section';
  return (
    <SummaryContext value={{ headingId, busy }}>
      <Frame
        aria-busy={busy || undefined}
        aria-label={busy ? undefined : label}
        aria-labelledby={busy || label ? undefined : headingId}
        className="flex flex-col overflow-hidden rounded-xl border bg-card @2xl/main:flex-row"
      >
        {children}
      </Frame>
    </SummaryContext>
  );
}

export function RecordSummaryHeading({ children }: { children: ReactNode }) {
  const { headingId, busy } = useSummary();
  const Heading = busy ? 'div' : 'h2';
  return (
    <Heading
      className="flex flex-col justify-center gap-1 bg-muted px-4 py-3 font-semibold text-sm @2xl/main:max-w-64"
      id={busy ? undefined : headingId}
    >
      {children}
    </Heading>
  );
}

export function RecordSummaryFields({ children }: { children: ReactNode }) {
  const { busy } = useSummary();
  const Fields = busy ? 'div' : 'dl';
  return (
    <div className="flex flex-1 items-center px-4 py-1 @2xl/main:py-3">
      <Fields className="flex w-full flex-col divide-y @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:gap-x-8 @2xl/main:gap-y-3 @2xl/main:divide-y-0">
        {children}
      </Fields>
    </div>
  );
}

export function RecordSummaryField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={FIELD_CLASS}>
      <dt className="shrink-0 text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 break-words text-end font-medium text-sm @2xl/main:text-start">
        <bdi>{children}</bdi>
      </dd>
    </div>
  );
}

export function RecordSummaryFieldSkeleton() {
  return (
    <div className={FIELD_CLASS}>
      <div className="flex h-4 items-center">
        <div className="h-3 w-16">
          <Skeleton fill />
        </div>
      </div>
      <div className="flex h-5 items-center">
        <div className="h-4 w-28">
          <Skeleton fill />
        </div>
      </div>
    </div>
  );
}
