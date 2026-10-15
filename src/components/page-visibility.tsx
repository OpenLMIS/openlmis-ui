import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
} from 'react';

const PageHiddenContext = createContext(false);

export function PageVisibility({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return <PageHiddenContext value={hidden}>{children}</PageHiddenContext>;
}

export const usePageHidden = () => useContext(PageHiddenContext);

function pageHiddenDetails() {
  return {
    reason: 'none' as const,
    event: new Event('page-hidden'),
    trigger: undefined,
    isCanceled: false,
    isPropagationAllowed: false,
    cancel() {
      this.isCanceled = true;
    },
    allowPropagation() {
      this.isPropagationAllowed = true;
    },
    preventUnmountOnClose() {},
  };
}

export function useCloseOnPageHidden(
  open: boolean,
  onClose: (details: ReturnType<typeof pageHiddenDetails>) => void,
) {
  const hidden = usePageHidden();
  const notified = useRef(false);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!hidden) {
      notified.current = false;
      return;
    }
    if (!open || notified.current) return;
    notified.current = true;
    close(pageHiddenDetails());
  }, [hidden, open]);
  return hidden;
}
