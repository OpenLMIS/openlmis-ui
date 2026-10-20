import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { expect, it } from 'vitest';
import { DownloadedAt } from '@/components/downloaded-at';
import en from '../../public/locales/en.json';

it.each([
  ['Pacific/Honolulu', 'Downloaded Jan 1, 2026, 2:30:00 PM'],
  [undefined, 'Downloaded Jan 2, 2026, 12:30:00 AM'],
])(
  'shows the snapshot time offline using deployment zone %s with UTC fallback',
  async (zone, expected) => {
    const previous = localStorage.getItem('openlmis-ui.time-zone');
    if (zone) localStorage.setItem('openlmis-ui.time-zone', zone);
    else localStorage.removeItem('openlmis-ui.time-zone');
    onlineManager.setOnline(false);
    const i18n = createInstance();
    await i18n.use(ICU).init({
      lng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
    const client = new QueryClient();
    try {
      render(
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={client}>
            <DownloadedAt timestamp={Date.UTC(2026, 0, 2, 0, 30)} />
          </QueryClientProvider>
        </I18nextProvider>,
      );
      expect(screen.getByText(expected)).toBeInTheDocument();
    } finally {
      cleanup();
      client.clear();
      if (previous) localStorage.setItem('openlmis-ui.time-zone', previous);
      else localStorage.removeItem('openlmis-ui.time-zone');
    }
  },
);
