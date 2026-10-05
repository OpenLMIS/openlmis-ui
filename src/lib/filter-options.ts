type Option = { value: string; label: string; description?: string };

export function withPicked(
  options: Option[] | undefined,
  picked: string | undefined,
  unknownLabel: string,
): { value: string; options: Option[] } {
  const list = options ?? [];
  if (!picked) return { value: '', options: list };
  if (!options || list.some((option) => option.value === picked)) {
    return { value: picked, options: list };
  }
  return { value: picked, options: [{ value: picked, label: unknownLabel }, ...list] };
}
