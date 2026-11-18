import { useCallback, useRef, useState } from 'react';
import { type RequisitionLine, skippedLineIds } from '@/features/requisitions/lib/lines';

const NONE: ReadonlySet<string> = new Set();
const sameKeys = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export function useHiddenSkipped(
  lines: readonly RequisitionLine[],
  enabled: boolean,
  keys: readonly unknown[],
  isSkipped?: (line: RequisitionLine) => boolean,
) {
  const take = (lines: readonly RequisitionLine[], enabled: boolean) =>
    enabled ? skippedLineIds(lines, isSkipped) : NONE;
  const [snapshot, setSnapshot] = useState(() => ({ keys, ids: take(lines, enabled) }));
  const stale = !sameKeys(snapshot.keys, keys);
  const ids = stale ? take(lines, enabled) : snapshot.ids;
  if (stale) setSnapshot({ keys, ids });
  const latest = useRef({ lines, enabled, keys, take });
  latest.current = { lines, enabled, keys, take };
  const refresh = useCallback(() => {
    const { lines, enabled, keys, take } = latest.current;
    setSnapshot({ keys, ids: take(lines, enabled) });
  }, []);
  return { hidden: ids, refresh };
}
