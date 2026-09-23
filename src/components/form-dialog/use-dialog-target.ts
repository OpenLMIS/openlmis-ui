import { useState } from 'react';

/** The target while set, and the last one until the close animation ends, so nothing blanks out mid-fade. */
export function useDialogTarget<T>(target: T | undefined) {
  const [shown, setShown] = useState(target);
  if (target !== undefined && target !== shown) setShown(target);

  return {
    shown,
    open: target !== undefined,
    onOpenChangeComplete: (open: boolean) => {
      if (!open) setShown(undefined);
    },
  };
}
