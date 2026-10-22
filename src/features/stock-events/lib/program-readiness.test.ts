import { expect, it } from 'vitest';
import { programReadiness } from '@/features/stock-events/lib/program-readiness';
import type { DownloadScopeState } from '@/lib/download-provider';

it.each([
  ['ineligible', false, true, 'not-downloaded', 'no-stock-card-right'],
  ['missing', true, true, 'downloading', undefined],
  ['outdated', true, true, 'downloading', undefined],
  [undefined, false, true, 'downloading', undefined],
  ['missing', false, false, 'checking', undefined],
  ['outdated', true, false, 'not-downloaded', 'older-download'],
  ['missing', true, false, 'not-downloaded', 'not-downloaded'],
  ['ready', true, true, 'ready', undefined],
] as const)(
  'resolves state %s loaded=%s running=%s',
  (state, loaded, running, expected, reason) => {
    const result = programReadiness({
      programId: 'p',
      datasets: [{ dataset: 'home-stock', minimumFormat: 4 }],
      states: {
        'home-stock': {
          loaded,
          states: new Map<string, DownloadScopeState>(state ? [['p', state]] : []),
        },
      },
      status: {
        phase: running ? 'running' : 'idle',
        incomplete: [
          {
            id: 'p',
            name: 'Program',
            dataset: 'home-stock',
            datasetLabel: 'offline.download.home-stock',
          },
        ],
      },
    });
    expect(result).toEqual(reason ? { state: expected, reason } : { state: expected });
  },
);
it('needs no download for kinds without datasets', () => {
  expect(
    programReadiness({
      programId: 'p',
      datasets: [],
      states: {},
      status: { phase: 'running', incomplete: [] },
    }),
  ).toEqual({ state: 'ready' });
});
