import { useState } from 'react';

let openings = 0;

/** Gives each mount or non-empty target change a key that persists through closing. */
export function useOpening(target?: string) {
  const [previous, setPrevious] = useState(() => ({ target, opening: ++openings }));
  if (target !== previous.target) {
    setPrevious({ target, opening: target === undefined ? previous.opening : ++openings });
  }
  return previous.opening;
}
