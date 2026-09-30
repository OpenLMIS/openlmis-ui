import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Logo } from '@/components/logo';
import {
  DEFAULT_APP_CONFIGURATION,
  DEFAULT_LOGO_URL,
  parseAppConfiguration,
  setAppConfiguration,
} from '@/lib/app-configuration';

const custom = parseAppConfiguration({
  appName: 'SIGECA',
  logo: { url: '/api/appConfiguration/logo?v=abc', contentType: 'image/png' },
});

beforeEach(() => setAppConfiguration(DEFAULT_APP_CONFIGURATION));

describe('Logo', () => {
  it('shows the configured logo, named after the app', () => {
    setAppConfiguration(custom);

    render(<Logo />);

    expect(screen.getByRole('img', { name: 'SIGECA' })).toHaveAttribute(
      'src',
      '/api/appConfiguration/logo?v=abc',
    );
  });

  it('falls back to the built-in logo when the configured one cannot load', () => {
    setAppConfiguration(custom);
    render(<Logo />);

    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByRole('img')).toHaveAttribute('src', DEFAULT_LOGO_URL);
  });

  it('shows the built-in logo when nothing is configured', () => {
    render(<Logo />);

    expect(screen.getByRole('img', { name: 'OpenLMIS' })).toHaveAttribute('src', DEFAULT_LOGO_URL);
  });
});
