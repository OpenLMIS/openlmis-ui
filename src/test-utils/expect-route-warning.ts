import { expect, vi } from 'vitest';

export function expectRouteWarning(matchId: string) {
  const message = `Warning: Error in route match: ${matchId}`;
  const forward = console.warn.bind(console);
  const warning = vi.spyOn(console, 'warn').mockImplementation((...args) => {
    if (args.length !== 1 || args[0] !== message) forward(...args);
  });
  return () => {
    expect(warning).toHaveBeenCalled();
    for (const args of warning.mock.calls) expect(args).toEqual([message]);
  };
}
