import { useState } from 'react';
import type { z } from 'zod';

/** A UI preference that survives reloads. A stored value that fails `schema` falls back to `initial`. */
export function useStoredState<T>(key: string, schema: z.ZodType<T>, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return initial;
      const parsed = schema.safeParse(JSON.parse(stored));
      return parsed.success ? parsed.data : initial;
    } catch {
      return initial;
    }
  });

  const update = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage can be full or blocked; the preference then lasts for this visit only.
    }
  };

  return [value, update] as const;
}
