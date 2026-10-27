import type { ReactNode } from 'react';
import { tableValue } from '@/lib/empty-value';
import { cn } from '@/lib/utils';

export function WrappingCell({
  children,
  empty,
  width = 'full',
}: {
  children: ReactNode;
  empty?: string;
  width?: 'full' | 'bounded';
}) {
  return (
    <span className={cn('block whitespace-normal break-normal', width === 'bounded' && 'max-w-60')}>
      <bdi>{tableValue(children) ?? empty}</bdi>
    </span>
  );
}
