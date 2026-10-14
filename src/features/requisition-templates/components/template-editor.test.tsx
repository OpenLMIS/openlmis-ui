import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { facilityTypesOptions } from '@/features/reference-data/api/queries';
import { saveRequisitionTemplate } from '@/features/requisition-templates/api/api';
import {
  requisitionTemplatesOptions,
  templateReasonTagsOptions,
} from '@/features/requisition-templates/api/queries';
import {
  TemplateEditor,
  type TemplateTab,
} from '@/features/requisition-templates/components/template-editor';
import { liveTemplates } from '@/features/requisition-templates/lib/test-templates';
import { client } from '@/integrations/axios';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), put: vi.fn() } }));
vi.mock('@/features/requisition-templates/api/api', async (original) => {
  const actual = await original<typeof import('@/features/requisition-templates/api/api')>();
  return {
    ...actual,
    saveRequisitionTemplate: vi.fn(actual.saveRequisitionTemplate),
    fetchRequisitionTemplates: vi.fn(async () => []),
    fetchReasonTags: vi.fn(async () => []),
  };
});

const saved = liveTemplates[0];

function Editor({ initialTab = 'columns' }: { initialTab?: TemplateTab }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <TemplateEditor
      saved={saved}
      programName="ARV"
      tab={tab}
      onTabChange={setTab}
      onCancel={vi.fn()}
      onSaved={vi.fn()}
    />
  );
}

function seededClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  for (const options of [
    facilityTypesOptions(),
    facilityTypesOptions({ active: true }),
    requisitionTemplatesOptions(),
    templateReasonTagsOptions(),
  ]) {
    queryClient.setQueryDefaults(options.queryKey, { staleTime: Infinity });
    queryClient.setQueryData(options.queryKey, []);
  }
  return queryClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.get).mockResolvedValue({ data: structuredClone(saved) });
  vi.mocked(client.put).mockResolvedValue({ data: saved });
});

describe('TemplateEditor', () => {
  it('saves both tabs once, only after confirmation and a fresh read', async () => {
    const user = userEvent.setup();
    renderPage(<Editor />, { queryClient: seededClient() });
    const label = (
      await screen.findAllByRole('textbox', { name: 'requisition-templates.configure.row-label' })
    )[0];
    await user.clear(label);
    await user.paste('Changed column');
    await user.click(screen.getByRole('tab', { name: 'requisition-templates.configure.settings' }));
    const name = screen.getByRole('textbox', { name: /requisition-templates.configure.name/ });
    await user.clear(name);
    await user.paste('Changed template');
    await user.click(screen.getByRole('button', { name: 'requisition-templates.configure.save' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(client.get).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole('button', { name: 'requisition-templates.configure.save' }),
    );
    await waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    expect(client.get).toHaveBeenCalledWith(`/requisitionTemplates/${saved.id}`);
    expect(vi.mocked(client.get).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(client.put).mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const body = vi.mocked(client.put).mock.calls[0][1] as typeof saved;
    expect(body.name).toBe('Changed template');
    expect(Object.values(body.columnsMap).some((column) => column.label === 'Changed column')).toBe(
      true,
    );
  });

  it('sends nothing for an invalid draft and opens Columns', async () => {
    const user = userEvent.setup();
    renderPage(<Editor />, { queryClient: seededClient() });
    await user.clear(
      (
        await screen.findAllByRole('textbox', { name: 'requisition-templates.configure.row-label' })
      )[0],
    );
    await user.click(screen.getByRole('tab', { name: 'requisition-templates.configure.settings' }));
    await user.click(screen.getByRole('button', { name: 'requisition-templates.configure.save' }));
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: 'requisition-templates.configure.columns' }),
      ).toHaveAttribute('aria-selected', 'true'),
    );
    expect(toast.error).toHaveBeenCalledWith('requisition-templates.configure.invalid-title', {
      description: 'requisition-templates.configure.invalid',
    });
    const invalidField = screen.getAllByRole('textbox', {
      name: 'requisition-templates.configure.row-label',
    })[0];
    expect(invalidField).toHaveAttribute('aria-invalid', 'true');
    expect(invalidField).toHaveAccessibleDescription(
      'requisition-templates.configure.validation.label-required',
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(saveRequisitionTemplate).not.toHaveBeenCalled();
  });

  it('refuses a previous user draft after confirmation', async () => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'ada', username: 'ada', accessToken: 'token' });
    const user = userEvent.setup();
    renderPage(<Editor />, { queryClient: seededClient() });
    await user.click(
      await screen.findByRole('button', { name: 'requisition-templates.configure.save' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    act(() =>
      useLoginData
        .getState()
        .setLoginData({ referenceDataUserId: 'alan', username: 'alan', accessToken: 'other' }),
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'requisition-templates.configure.save' }),
    );
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'requisition-templates.configure.save' }),
      ).not.toBeDisabled(),
    );
    expect(saveRequisitionTemplate).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });
});
