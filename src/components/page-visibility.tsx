import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
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

export function usePageGatedOpen<Details extends { isCanceled: boolean }>({
  open,
  defaultOpen,
  onOpenChange,
  closeOnHide = true,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean, details: Details) => void;
  closeOnHide?: boolean;
}) {
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false);
  const currentOpen = open ?? localOpen;
  const change = (next: boolean, details: Details) => {
    onOpenChange?.(next, details);
    if (!details.isCanceled) setLocalOpen(next);
  };
  const hidden = useCloseOnPageHidden(closeOnHide && currentOpen, (details) => {
    change(false, details as unknown as Details);
  });
  return {
    currentOpen,
    hidden,
    open: !hidden && currentOpen,
    onOpenChange: (next: boolean, details: Details) => {
      if (!hidden) change(next, details);
    },
  };
}
