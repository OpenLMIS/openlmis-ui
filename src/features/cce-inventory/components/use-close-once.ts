import { useRef, useState } from 'react';

function useOpeningKey(open: boolean) {
  const [opening, setOpening] = useState({ open, key: 0 });
  if (opening.open === open) return opening.key;
  const next = { open, key: open ? opening.key + 1 : opening.key };
  setOpening(next);
  return next.key;
}

export function useCloseOnce(open: boolean, onClose: () => void) {
  const opening = useOpeningKey(open);
  const closed = useRef<number | null>(null);
  return {
    opening,
    requestClose: () => {
      if (closed.current === opening) return;
      closed.current = opening;
      onClose();
    },
    cancelClose: () => {
      closed.current = null;
    },
  };
}
