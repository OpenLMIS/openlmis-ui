import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import { fetchMinimalFacilities, fetchSupervisoryNodes } from '@/features/reference-data/api/api';
import { supervisoryNodesByIdsOptions } from '@/features/supervisory-nodes/api/queries';
import { NodeEditor } from '@/features/supervisory-nodes/components/node-editor';
import type { SupervisoryNode } from '@/features/supervisory-nodes/lib/types';
import { visibleSavedIds } from '@/features/supervisory-nodes/lib/visible-saved-ids';
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
  const params = new URL(path, 'http://localhost').searchParams;
  for (const [kind, rows] of [
    ['child', node.childNodes],
    ['partner', node.partnerNodes],
  ] as const) {
    const savedIds = new Set(rows.map(({ id }) => id));
    const size = Number(params.get(`${kind}Size`) ?? 10);
    const page = Number(params.get(`${kind}Page`) ?? 1);
    const ids = visibleSavedIds(rows, page, size, savedIds);
    queryClient.setQueryData(
      supervisoryNodesByIdsOptions(ids).queryKey,
      ids.map((id) => ({ id, code: id, name: `Child ${id}`, childNodes: [], partnerNodes: [] })),
    );
  }
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
    vi.mocked(client.get).mockResolvedValue({
      data: {
        content: node.childNodes
          .slice(0, 10)
          .map(({ id }) => ({ id, code: id, name: `Child ${id}` })),
        totalPages: 1,
      },
    });
    const { user, router } = renderEditor(node, '/?childPage=2');
    const section = await screen.findByRole('region', { name: 'Child Nodes' });
    await user.click(
      await within(section).findByRole('button', { name: 'Remove Child Node Child 11' }),
    );
    const alert = await screen.findByRole('alertdialog', { name: 'Remove Child Node' });
    await user.click(within(alert).getByRole('button', { name: 'Remove Child Node' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('childPage'));
    await waitFor(() =>
      expect(
        within(section).getByRole('button', { name: 'Remove Child Node Child 10' }),
      ).toHaveFocus(),
    );
    expect(within(section).queryByText('Child 11')).not.toBeInTheDocument();
    expect(client.put).not.toHaveBeenCalled();
  });

  it('requests only the next page and keeps the previous rows visible until it arrives', async () => {
    const node = {
      ...saved,
      childNodes: Array.from({ length: 11 }, (_, index) => ({ id: String(index + 1) })),
    };
    let deliver!: () => void;
    vi.mocked(client.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          deliver = () =>
            resolve({
              data: { content: [{ id: '11', code: '11', name: 'Child 11' }], totalPages: 1 },
            });
        }),
    );
    const { user, router } = renderEditor(node);
    const section = await screen.findByRole('region', { name: 'Child Nodes' });
    await within(section).findByRole('button', { name: 'Remove Child Node Child 1' });
    await user.click(within(section).getByRole('button', { name: 'Next Page' }));
    await waitFor(() =>
      expect(client.get).toHaveBeenCalledWith(
        '/supervisoryNodes',
        expect.objectContaining({ params: { id: ['11'], page: 0, size: 100 } }),
      ),
    );
    expect(router.state.location.search).toHaveProperty('childPage', 2);
    expect(
      within(section).getByRole('button', { name: 'Remove Child Node Child 1' }),
    ).toBeInTheDocument();
    expect(
      within(section).queryByRole('button', { name: 'Remove Child Node Child 11' }),
    ).not.toBeInTheDocument();
    await act(async () => deliver());
    await within(section).findByRole('button', { name: 'Remove Child Node Child 11' });
    expect(within(section).queryByText('Child 1')).not.toBeInTheDocument();
  });

  it('adds a picked node to the end, shows its page and sends it on Update', async () => {
    const node = {
      ...saved,
      childNodes: Array.from({ length: 10 }, (_, index) => ({ id: String(index + 1) })),
    };
    vi.mocked(fetchSupervisoryNodes).mockResolvedValue([
      { id: '1', code: '1', name: 'Child 1' },
      { id: 'new', code: 'NEW', name: 'New Node' },
    ]);
    vi.mocked(fetchMinimalFacilities).mockResolvedValue([]);
    vi.mocked(client.get).mockResolvedValue({ data: node });
    const { user, router } = renderEditor(node);
    const section = await screen.findByRole('region', { name: 'Child Nodes' });
    const picker = () => within(section).getByRole('combobox', { name: 'Choose A Child Node' });
    await waitFor(() => expect(picker()).not.toHaveAttribute('data-disabled'));
    await user.type(picker(), 'Node');
    await user.click(await screen.findByRole('option', { name: 'New Node' }));
    await user.click(within(section).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(router.state.location.search).toHaveProperty('childPage', 2));
    expect(
      await within(section).findByRole('button', { name: 'Remove Child Node New Node' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Supervisory Node' }));
    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith(
        '/supervisoryNodes/node',
        expect.objectContaining({ childNodes: [...node.childNodes, { id: 'new' }] }),
      ),
    );
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
