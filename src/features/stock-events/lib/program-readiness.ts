import type { EventDataset } from '@/features/stock-events/lib/event-kinds';
import type { DownloadScopeState } from '@/lib/download-provider';
import type { DownloadStatus } from '@/lib/offline-download-status';

export type ProgramReadiness =
  | { state: 'checking' }
  | { state: 'ready' }
  | { state: 'downloading' }
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
  status: DownloadStatus;
}): ProgramReadiness {
  const entries = input.datasets.map(({ dataset }) => ({
    dataset,
    loaded: input.states[dataset]?.loaded,
    state: input.states[dataset]?.states.get(input.programId),
  }));
  if (entries.some(({ state }) => state === 'ineligible'))
    return { state: 'not-downloaded', reason: 'no-stock-card-right' };
  if (
    input.status.phase === 'running' &&
    entries.some(
      ({ dataset, state }) =>
        state !== 'ready' &&
        input.status.incomplete.some(
          (item) => item.dataset === dataset && item.id === input.programId,
        ),
    )
  )
    return { state: 'downloading' };
  if (entries.some(({ loaded }) => !loaded)) return { state: 'checking' };
  if (entries.some(({ state }) => state === 'outdated'))
    return { state: 'not-downloaded', reason: 'older-download' };
  if (entries.some(({ state }) => state === 'missing'))
    return { state: 'not-downloaded', reason: 'not-downloaded' };
  return { state: 'ready' };
}
