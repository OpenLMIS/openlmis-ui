import { useState } from 'react';

export function useDeleteRowHint<T extends { id: string }>(target: string | undefined) {
  const [hint, setHint] = useState<T>();
  const [previousTarget, setPreviousTarget] = useState(target);
  if (target !== previousTarget) {
    setPreviousTarget(target);
    if (target !== hint?.id) setHint(undefined);
  }
  return [hint, setHint] as const;
}
