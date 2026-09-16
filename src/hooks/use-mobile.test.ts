import { act, renderHook } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

const MOBILE_BREAKPOINT = 768;

type MatchMediaListener = (event: MediaQueryListEvent) => void;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function mockMatchMedia() {
  const listeners = new Set<MatchMediaListener>();

  const matchMedia = vi.fn((query: string) => ({
    matches: window.innerWidth < MOBILE_BREAKPOINT,
    media: query,
    addEventListener: (_: string, listener: MatchMediaListener) => listeners.add(listener),
    removeEventListener: (_: string, listener: MatchMediaListener) => listeners.delete(listener),
    dispatchEvent: () => true,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
  }));

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    trigger: () => {
      for (const listener of listeners) listener({} as MediaQueryListEvent);
    },
  };
}

describe('useIsMobile', () => {
  beforeEach(() => {
    setViewportWidth(1024);
    mockMatchMedia();
  });

  it('returns false when viewport is wider than the mobile breakpoint', () => {
    setViewportWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true when viewport is narrower than the mobile breakpoint', () => {
    setViewportWidth(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false at exactly the breakpoint width', () => {
    setViewportWidth(MOBILE_BREAKPOINT);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('updates when the viewport crosses the breakpoint', () => {
    setViewportWidth(1024);
    const media = mockMatchMedia();
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(500);
      media.trigger();
    });
    expect(result.current).toBe(true);
  });
});
