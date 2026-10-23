import { expect, it } from 'vitest';
import { programReadiness } from '@/features/stock-events/lib/program-readiness';
import type { DownloadScopeState } from '@/lib/download-provider';

it.each([
  ['ineligible', false, 'not-downloaded', 'no-stock-card-right'],
  ['missing', false, 'checking', undefined],
  ['outdated', true, 'not-downloaded', 'older-download'],
  ['missing', true, 'not-downloaded', 'not-downloaded'],
  [undefined, true, 'not-downloaded', 'not-downloaded'],
  ['ready', true, 'ready', undefined],
] as const)('resolves state %s loaded=%s', (state, loaded, expected, reason) => {
  const result = programReadiness({
    programId: 'p',
    datasets: [{ dataset: 'home-stock', minimumFormat: 4 }],
    states: {
      'home-stock': {
        loaded,
        states: new Map<string, DownloadScopeState>(state ? [['p', state]] : []),
      },
    },
  });
  expect(result).toEqual(reason ? { state: expected, reason } : { state: expected });
});
it('needs no download for kinds without datasets', () => {
  expect(programReadiness({ programId: 'p', datasets: [], states: {} })).toEqual({
    state: 'ready',
  });
});

it.each([
  ['ready', 'ready', true, { state: 'ready' }],
  ['ready', 'missing', true, { state: 'not-downloaded', reason: 'catalog-missing' }],
  ['ready', undefined, false, { state: 'checking' }],
  ['outdated', 'ready', true, { state: 'not-downloaded', reason: 'older-download' }],
] as const)('requires both Receive downloads (%s, %s)', (stock, catalog, loaded, expected) => {
  expect(
    programReadiness({
      programId: 'p',
      datasets: [{ dataset: 'home-stock', minimumFormat: 6 }, { dataset: 'receive-catalog' }],
      states: {
        'home-stock': { loaded: true, states: new Map([['p', stock]]) },
        'receive-catalog': {
          loaded,
          states: new Map<string, DownloadScopeState>(catalog ? [['p', catalog]] : []),
        },
      },
    }),
  ).toEqual(expected);
});
