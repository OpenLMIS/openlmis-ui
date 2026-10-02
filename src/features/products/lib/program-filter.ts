import { programName } from '@/features/reference-data/lib/programs';
import type { Program } from '@/features/reference-data/lib/types';

export function toProgramFilter(
  programs: readonly Program[] | undefined,
  selected: string | undefined,
) {
  const options = (programs ?? [])
    .map((program) => ({ value: program.code, label: programName(program) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (!selected) return { value: '', options };
  const match = options.find((option) => option.value.toLowerCase() === selected.toLowerCase());
  if (match) return { value: match.value, options };
  return { value: selected, options: [{ value: selected, label: selected }, ...options] };
}
