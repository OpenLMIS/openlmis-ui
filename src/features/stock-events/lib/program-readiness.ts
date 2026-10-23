import type { EventDataset } from '@/features/stock-events/lib/event-kinds';
import type { DownloadScopeState } from '@/lib/download-provider';

export type ProgramReadiness =
  | { state: 'checking' }
  | { state: 'ready' }
  | {
      state: 'not-downloaded';
      reason: 'no-stock-card-right' | 'older-download' | 'not-downloaded';
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
    loaded: input.states[dataset]?.loaded,
    state: input.states[dataset]?.states.get(input.programId),
  }));
  if (entries.some(({ state }) => state === 'ineligible'))
    return { state: 'not-downloaded', reason: 'no-stock-card-right' };
  if (entries.some(({ loaded }) => !loaded)) return { state: 'checking' };
  if (entries.some(({ state }) => state === 'outdated'))
    return { state: 'not-downloaded', reason: 'older-download' };
  if (entries.some(({ state }) => state === 'missing' || state === undefined))
    return { state: 'not-downloaded', reason: 'not-downloaded' };
  return { state: 'ready' };
}
