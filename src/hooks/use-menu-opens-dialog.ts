import { useCallback, useRef } from 'react';

export function useMenuOpensDialog() {
  const opened = useRef(false);

  const onOpenChange = useCallback((open: boolean) => {
    if (open) opened.current = false;
  }, []);
  const finalFocus = useCallback(() => !opened.current, []);
  const opensDialog = useCallback(
    (open: () => void) => () => {
      opened.current = true;
      open();
    },
    [],
  );

  return { onOpenChange, finalFocus, opensDialog };
}
