import { type ConfiguredEventKind, EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';

export type PickerLayout = 'joined' | 'labelled';

const storageKey = (kind: ConfiguredEventKind, programId: string) =>
  `stock-events.picker-layout.${kind}.${programId}`;

export function rememberedPickerLayout(
  kind: ConfiguredEventKind,
  programId: string | undefined,
): PickerLayout {
  if (EVENT_KINDS[kind].products.from !== 'stock-cards') return 'labelled';
  if (!programId) return 'joined';
  try {
    return localStorage.getItem(storageKey(kind, programId)) === 'labelled' ? 'labelled' : 'joined';
  } catch {
    return 'joined';
  }
}

export function rememberPickerLayout(
  kind: ConfiguredEventKind,
  programId: string,
  layout: PickerLayout,
) {
  try {
    localStorage.setItem(storageKey(kind, programId), layout);
  } catch {}
}
