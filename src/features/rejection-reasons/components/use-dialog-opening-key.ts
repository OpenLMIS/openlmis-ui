import { useState } from 'react';

export function useDialogOpeningKey(target: string | undefined) {
  const [opening, setOpening] = useState({ target, key: 0 });
  if (opening.target !== target) {
    const next = { target, key: target === undefined ? opening.key : opening.key + 1 };
    setOpening(next);
    return next.key;
  }
  return opening.key;
}
