import type { EventDataset } from '@/features/stock-events/lib/event-kinds';
import type { DownloadScopeState } from '@/lib/download-provider';

export type ProgramReadiness =
  | { state: 'checking' }
  | { state: 'ready' }
  | {
      state: 'not-downloaded';
      reason: 'no-stock-card-right' | 'older-download' | 'not-downloaded' | 'catalog-missing';
    };

export function programReadiness(input: {
  programId: string;
  datasets: readonly EventDataset[];
  states: Partial<
    Record<
      EventDataset['dataset'],
      { loaded: boolean; states: ReadonlyMap<string, DownloadScopeState> }
    >
  >;
}): ProgramReadiness {
  const entries = input.datasets.map(({ dataset }) => ({
    dataset,
    loaded: input.states[dataset]?.loaded,
    state: input.states[dataset]?.states.get(input.programId),
  }));
  if (entries.some(({ state }) => state === 'ineligible'))
    return { state: 'not-downloaded', reason: 'no-stock-card-right' };
  if (entries.some(({ loaded }) => !loaded)) return { state: 'checking' };
  if (entries.some(({ state }) => state === 'outdated'))
    return { state: 'not-downloaded', reason: 'older-download' };
  const missing = entries.find(({ state }) => state === 'missing' || state === undefined);
  if (missing)
    return {
      state: 'not-downloaded',
      reason: missing.dataset === 'receive-catalog' ? 'catalog-missing' : 'not-downloaded',
    };
  return { state: 'ready' };
}
