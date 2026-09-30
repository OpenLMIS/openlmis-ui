import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_CONFIGURATION,
  parseAppConfiguration,
  setAppConfiguration,
} from '@/lib/app-configuration';
import { setAppearanceChoice, useAppearanceStore } from '@/lib/appearance';
import { startApplyingAppConfiguration } from '@/lib/apply-app-configuration';

let stop: () => void = () => {};

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML =
    '<title id="app-title">OpenLMIS UI</title><link rel="icon" href="/olmis.png" />';
  document.documentElement.className = '';
  useAppearanceStore.setState({ choice: null, systemDark: false });
  setAppConfiguration(
    parseAppConfiguration({
      appName: 'SIGECA',
      theme: { preset: 'teal', defaultAppearance: 'dark' },
    }),
  );
});

afterEach(() => {
  stop();
  setAppConfiguration(DEFAULT_APP_CONFIGURATION);
});

describe('startApplyingAppConfiguration', () => {
  it('applies the branding, preset and default appearance before anything renders', () => {
    stop = startApplyingAppConfiguration();

    expect(document.title).toBe('SIGECA');
    expect(document.getElementById('app-theme')?.textContent).toContain('195');
    expect(document.documentElement).toHaveClass('dark');
  });

  it("follows the user's own choice over the default", () => {
    stop = startApplyingAppConfiguration();

    setAppearanceChoice('light');

    expect(document.documentElement).not.toHaveClass('dark');
  });

  it("leaves a page's own title alone when the appearance changes", () => {
    stop = startApplyingAppConfiguration();
    const pageTitle = document.createElement('title');
    pageTitle.textContent = 'Sign In - SIGECA';
    document.head.prepend(pageTitle);

    setAppearanceChoice('light');
    setAppConfiguration(parseAppConfiguration({ appName: 'Malawi LMIS' }));

    expect(document.title).toBe('Sign In - SIGECA');
    expect(document.getElementById('app-title')?.textContent).toBe('Malawi LMIS');
  });

  it('applies a saved configuration at once', () => {
    stop = startApplyingAppConfiguration();

    setAppConfiguration(parseAppConfiguration({ appName: 'Malawi LMIS' }));

    expect(document.title).toBe('Malawi LMIS');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('follows a choice made in another tab', () => {
    stop = startApplyingAppConfiguration();

    localStorage.setItem('theme', 'light');
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'light' }));

    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('saves the configuration again when the legacy UI wipes the whole storage', () => {
    stop = startApplyingAppConfiguration();
    localStorage.clear();

    window.dispatchEvent(new StorageEvent('storage', { key: null }));

    const cached = JSON.parse(localStorage.getItem('openlmis-ui.app-configuration') ?? 'null');
    expect(parseAppConfiguration(cached).appName).toBe('SIGECA');
  });
});
