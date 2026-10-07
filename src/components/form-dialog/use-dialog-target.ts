import { useEffect, useRef, useState } from 'react';

/** Open while `target` is set, showing the last target until the close animation ends; an object target must keep its identity. */
export function useDialogTarget<T>(target: T | undefined, onClose: () => void) {
  const [shown, setShown] = useState(target);
  const [closed, setClosed] = useState<T | undefined>(undefined);
  if (target !== undefined && target !== shown) setShown(target);
  if (target === undefined && closed !== undefined) setClosed(undefined);
  const open = target !== undefined && target !== closed;
  const closing = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (target === undefined) closing.current = undefined;
  }, [target]);

  /** Closes once, at once, however often it is asked before the page catches up; false when already closing. */
  const close = () => {
    if (target === undefined || closing.current === target) return false;
    closing.current = target;
    setClosed(target);
    onClose();
    return true;
  };

  return {
    shown,
    close,
    /** The `FormDialog` props; `locked` keeps it open, e.g. while a save runs. */
    dialogProps: (locked = false) => ({
      open,
      onOpenChange: (next: boolean) => {
        if (!next && !locked) close();
      },
      onOpenChangeComplete: (next: boolean) => {
        if (!next) setShown(undefined);
      },
    }),
  };
}
