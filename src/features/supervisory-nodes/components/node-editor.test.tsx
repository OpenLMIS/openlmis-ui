import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import { NodeEditor } from '@/features/supervisory-nodes/components/node-editor';
import { client } from '@/integrations/axios';
import { httpError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), put: vi.fn() } }));
vi.mock('@/features/reference-data/api/api', () => ({
  fetchSupervisoryNodes: vi.fn(async () => []),
  fetchMinimalFacilities: vi.fn(async () => []),
}));

const saved = { id: 'node', code: 'SN', name: 'Original', childNodes: [], partnerNodes: [] };
function renderEditor() {
  const onSaved = vi.fn();
  const onReload = vi.fn();
  const router = renderPage(
    <TranslatedFormMessages>
      <NodeEditor saved={saved} onCancel={vi.fn()} onSaved={onSaved} onReload={onReload} />
    </TranslatedFormMessages>,
    {
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    },
  );
  return { router, onSaved, onReload, user: userEvent.setup() };
}

beforeAll(async () => {
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(client.get).mockResolvedValue({ data: saved });
});

describe('supervisory node editor', () => {
  it('keeps the draft and location when saving fails and shows the server message', async () => {
    vi.mocked(client.put).mockRejectedValue(httpError(400, { message: 'Code already exists' }));
    const { user, router, onSaved } = renderEditor();
    const name = await screen.findByRole('textbox', { name: /^Supervisory Node Name/ });
    await user.clear(name);
    await user.type(name, 'My draft');
    await user.click(screen.getByRole('button', { name: 'Update Supervisory Node' }));
    const alert = await screen.findByRole('alertdialog', {
      name: 'Failed To Update Supervisory Node',
    });
    expect(within(alert).getByText('Code already exists')).toBeInTheDocument();
    expect(name).toHaveValue('My draft');
    expect(onSaved).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/');
    expect(client.put).toHaveBeenCalledWith(
      '/supervisoryNodes/node',
      expect.objectContaining({ name: 'My draft' }),
    );
  });

  it('shows required errors and returns focus to the first invalid field after Close', async () => {
    const { user } = renderEditor();
    const code = await screen.findByRole('textbox', { name: /^Code/ });
    await user.clear(code);
    await user.clear(screen.getByRole('textbox', { name: /^Supervisory Node Name/ }));
    await user.click(screen.getByRole('button', { name: 'Update Supervisory Node' }));
    const alert = await screen.findByRole('alertdialog', { name: 'This Form Is Invalid' });
    expect(screen.getAllByText('This field is required')).toHaveLength(2);
    expect(client.put).not.toHaveBeenCalled();
    await user.click(within(alert).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(code).toHaveFocus());
  });

  it('refuses a conflicting reread before PUT and offers Reload', async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: { ...saved, parentNode: { id: 'child' }, childNodes: [{ id: 'child' }] },
    });
    const { user, onReload } = renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Update Supervisory Node' }));
    const alert = await screen.findByRole('alertdialog', { name: 'Supervisory Node Changed' });
    expect(client.put).not.toHaveBeenCalled();
    await user.click(within(alert).getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledOnce();
  });
});
