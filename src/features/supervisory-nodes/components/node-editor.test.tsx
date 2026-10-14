import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import { supervisoryNodesByIdsOptions } from '@/features/supervisory-nodes/api/queries';
import { NodeEditor } from '@/features/supervisory-nodes/components/node-editor';
import type { SupervisoryNode } from '@/features/supervisory-nodes/lib/types';
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
function renderEditor(node: SupervisoryNode = saved, path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const ids = [
    ...new Set([
      ...node.childNodes.map(({ id }) => id),
      ...node.partnerNodes.map(({ id }) => id),
      ...(node.parentNode ? [node.parentNode.id] : []),
    ]),
  ].sort();
  queryClient.setQueryData(
    supervisoryNodesByIdsOptions(ids).queryKey,
    ids.map((id) => ({ id, code: id, name: `Child ${id}`, childNodes: [], partnerNodes: [] })),
  );
  const onSaved = vi.fn();
  const onReload = vi.fn();
  const router = renderPage(
    <TranslatedFormMessages>
      <NodeEditor saved={node} onCancel={vi.fn()} onSaved={onSaved} onReload={onReload} />
    </TranslatedFormMessages>,
    {
      queryClient,
      path,
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
  it('returns to the previous page and focuses its last row after removing the last page row', async () => {
    const node = {
      ...saved,
      childNodes: Array.from({ length: 11 }, (_, index) => ({ id: String(index + 1) })),
    };
    const { user, router } = renderEditor(node, '/?childPage=2');
    const section = await screen.findByRole('region', { name: 'Child Nodes' });
    await user.click(await within(section).findByRole('button', { name: 'Actions For Child 11' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove Child Node' }));
    const alert = await screen.findByRole('alertdialog', { name: 'Remove Child Node' });
    await user.click(within(alert).getByRole('button', { name: 'Remove Child Node' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('childPage'));
    await waitFor(() =>
      expect(within(section).getByRole('button', { name: 'Actions For Child 10' })).toHaveFocus(),
    );
    expect(within(section).queryByText('Child 11')).not.toBeInTheDocument();
    expect(client.put).not.toHaveBeenCalled();
  });

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
