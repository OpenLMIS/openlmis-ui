import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppHeader } from '@/components/app-shell/app-header';
import { useLoginData } from '@/features/auth/store/login-data';
import { systemNotificationsOptions } from '@/features/system-notifications/api/queries';
import { client } from '@/integrations/axios';
import { IsolatingICU } from '@/lib/isolate-values';
import ar from '../../../public/locales/ar.json';
import en from '../../../public/locales/en.json';

vi.mock('@/components/app-shell/command-palette', () => ({ CommandPalette: () => null }));
vi.mock('@/components/app-shell/custom-trigger', () => ({ CustomTrigger: () => null }));
vi.mock('@/components/app-shell/nav-user', () => ({ NavUser: () => null }));
vi.mock('@/components/app-shell/sidebar-notices', () => ({
  OfflineDot: () => null,
  StatusAnnouncer: () => null,
}));

const get = vi.fn<typeof client.get>();

beforeEach(() => {
  vi.spyOn(client, 'get').mockImplementation(get);
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'u1',
    username: 'ada',
    accessToken: 'token',
  });
  get.mockReset();
});

afterEach(() => {
  cleanup();
  useLoginData.getState().clearLoginData();
});

async function show(language: 'en' | 'ar') {
  const i18n = createInstance();
  await i18n.use(IsolatingICU).init({
    lng: language,
    resources: { en: { translation: en }, ar: { translation: ar } },
    keySeparator: false,
    nsSeparator: false,
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={cache}>
        <AppHeader />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return cache;
}

it('shows a single bell in the top bar through loading, count and zero states', async () => {
  const read = Promise.withResolvers<{ data: { content: unknown[]; totalPages: number } }>();
  get.mockReturnValue(read.promise);
  const cache = await show('en');
  const bell = screen.getByRole('button', { name: 'System Notifications' });
  expect(screen.getByRole('banner')).toContainElement(bell);
  expect(bell).not.toHaveTextContent(/\d/);
  read.resolve({
    data: { content: [{ id: 'one' }, { id: 'two' }], totalPages: 1 },
  });
  expect(await screen.findByRole('button', { name: 'System Notifications (2)' })).toBe(bell);
  expect(bell).toHaveTextContent('2');
  act(() => cache.setQueryData(systemNotificationsOptions().queryKey, []));
  expect(await screen.findByRole('button', { name: 'No System Notifications' })).toBe(bell);
  expect(bell).not.toHaveTextContent(/\d/);
});

it('hides the bell when the shell starts offline without cached notifications', async () => {
  onlineManager.setOnline(false);
  await show('en');
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /System Notifications/ })).not.toBeInTheDocument();
  expect(get).not.toHaveBeenCalled();
});

it('localizes both the accessible name and visible count in Arabic', async () => {
  get.mockResolvedValue({
    data: { content: Array.from({ length: 12 }, (_, id) => ({ id })), totalPages: 1 },
  });
  await show('ar');
  const localizedCount = (12).toLocaleString('ar');
  const bell = await screen.findByRole('button', { name: `إشعارات النظام (${localizedCount})` });
  expect(bell).toHaveTextContent(localizedCount);
});
