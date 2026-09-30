import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyAppearance,
  resolveAppearance,
  setAppearanceChoice,
  syncAppearanceFromStorage,
  useAppearanceStore,
  watchSystemAppearance,
} from '@/lib/appearance';

beforeEach(() => {
  localStorage.clear();
  useAppearanceStore.setState({ choice: null });
  document.documentElement.className = '';
});

afterEach(() => vi.restoreAllMocks());

describe('resolveAppearance', () => {
  it("uses the user's own choice first", () => {
    expect(resolveAppearance('light', 'dark', true)).toBe('light');
  });

  it('uses the deployment default when the user has not chosen', () => {
    expect(resolveAppearance(null, 'dark', false)).toBe('dark');
  });

  it('follows the device when that is the default or nothing is set', () => {
    expect(resolveAppearance(null, 'system', true)).toBe('dark');
    expect(resolveAppearance(null, null, false)).toBe('light');
  });
});

describe('setAppearanceChoice', () => {
  it('keeps a light or dark choice for this browser', () => {
    setAppearanceChoice('dark');

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(useAppearanceStore.getState().choice).toBe('dark');
  });

  it('forgets the choice, so the deployment default applies again', () => {
    setAppearanceChoice('dark');

    setAppearanceChoice(null);

    expect(localStorage.getItem('theme')).toBeNull();
    expect(useAppearanceStore.getState().choice).toBeNull();
  });
});

describe('syncAppearanceFromStorage', () => {
  it('follows a choice made in another tab, and its removal, without writing it back', () => {
    localStorage.setItem('theme', 'light');
    syncAppearanceFromStorage('theme');
    expect(useAppearanceStore.getState().choice).toBe('light');

    localStorage.removeItem('theme');
    syncAppearanceFromStorage('theme');

    expect(useAppearanceStore.getState().choice).toBeNull();
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('keeps the choice and saves it again when another page wipes the whole storage', () => {
    setAppearanceChoice('dark');
    localStorage.clear();

    syncAppearanceFromStorage(null);

    expect(useAppearanceStore.getState().choice).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('ignores other keys', () => {
    localStorage.setItem('theme', 'dark');
    syncAppearanceFromStorage('i18nextLng');

    expect(useAppearanceStore.getState().choice).toBeNull();
  });
});

describe('applyAppearance', () => {
  it('sets the dark class and colour scheme on the page', () => {
    applyAppearance('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyAppearance('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

describe('watchSystemAppearance', () => {
  it('follows the device switching to dark, until stopped', () => {
    let onChange: () => void = () => {};
    const query = {
      matches: false,
      addEventListener: (_: string, listener: () => void) => {
        onChange = listener;
      },
      removeEventListener: vi.fn(),
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue(query as unknown as MediaQueryList);

    const stop = watchSystemAppearance();
    query.matches = true;
    onChange();

    expect(useAppearanceStore.getState().systemDark).toBe(true);
    stop();
    expect(query.removeEventListener).toHaveBeenCalledWith('change', onChange);
  });
});
