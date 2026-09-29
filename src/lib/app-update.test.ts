import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadWhenUpdated } from '@/lib/app-update';

afterEach(() => vi.unstubAllGlobals());

function stubServiceWorker() {
  const target = new EventTarget();
  vi.stubGlobal('navigator', { ...navigator, serviceWorker: target });
  return () => target.dispatchEvent(new Event('controllerchange'));
}

describe('reloadWhenUpdated', () => {
  it('reloads once the new version takes over the page, and only once', () => {
    const takeOver = stubServiceWorker();
    const reload = vi.fn();

    reloadWhenUpdated(reload);
    expect(reload).not.toHaveBeenCalled();
    takeOver();
    takeOver();

    expect(reload).toHaveBeenCalledOnce();
  });
});
