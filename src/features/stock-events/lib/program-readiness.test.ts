import { expect, it } from 'vitest';
import { programReadiness } from '@/features/stock-events/lib/program-readiness';
import type { DownloadScopeState } from '@/lib/download-provider';

it.each([
  ['ineligible', false, 'p', 'not-downloaded', 'no-stock-card-right'],
  ['missing', true, 'p', 'downloading', undefined],
  ['outdated', true, 'p', 'downloading', undefined],
  [undefined, false, 'p', 'downloading', undefined],
  ['missing', true, 'other', 'not-downloaded', 'not-downloaded'],
  ['missing', false, null, 'checking', undefined],
  ['outdated', true, null, 'not-downloaded', 'older-download'],
  ['missing', true, null, 'not-downloaded', 'not-downloaded'],
  [undefined, true, null, 'not-downloaded', 'not-downloaded'],
  ['ready', true, 'p', 'ready', undefined],
] as const)(
  'resolves state %s loaded=%s downloading=%s',
  (state, loaded, downloading, expected, reason) => {
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
        phase: downloading ? 'running' : 'idle',
        incomplete: [
          {
            id: downloading ?? 'p',
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
