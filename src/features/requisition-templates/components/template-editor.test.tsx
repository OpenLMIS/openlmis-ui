import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { createInstance } from 'i18next';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
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
import { IsolatingICU } from '@/lib/isolate-values';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/components/app-shell/app-breadcrumbs', () => ({ AppBreadcrumbs: () => null }));
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

function Editor({
  initialTab = 'columns',
  template = saved,
}: {
  initialTab?: TemplateTab;
  template?: typeof saved;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <TemplateEditor
      saved={template}
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
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
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
    await waitFor(() => expect(invalidField).toHaveFocus());
    expect(invalidField).toHaveAttribute('aria-invalid', 'true');
    expect(invalidField).toHaveAccessibleDescription(
      'requisition-templates.configure.validation.label-required',
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(saveRequisitionTemplate).not.toHaveBeenCalled();
  });

  it('opens Columns and labels the period input when the server rejects its value', async () => {
    const i18n = createInstance();
    await i18n.use(IsolatingICU).init({
      lng: 'en',
      keySeparator: false,
      nsSeparator: false,
      resources: { en: { translation: en } },
    });
    const user = userEvent.setup();
    vi.mocked(client.put).mockRejectedValueOnce(
      httpError(400, {
        numberOfPeriodsToAverage: {
          messageKey: 'requisition.error.validation.fieldMustBeGreaterOrEqual',
          message: 'Server-language detail',
        },
      }),
    );
    renderPage(
      <I18nextProvider i18n={i18n}>
        <Editor initialTab="settings" />
      </I18nextProvider>,
      { queryClient: seededClient() },
    );
    const save = en['requisition-templates.configure.save'];
    await user.click(await screen.findByRole('button', { name: save }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: save }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: en['requisition-templates.configure.columns'] }),
      ).toHaveAttribute('aria-selected', 'true'),
    );
    const periods = await screen.findByRole('textbox', {
      name: /Number Of Periods To Average/,
    });
    expect(periods).toHaveAttribute('aria-invalid', 'true');
    expect(periods).toHaveAccessibleDescription(
      en['requisition-templates.configure.validation.periods-minimum'],
    );
  });

  it('shows a section alert for a period refusal when the template has no period input', async () => {
    const template = {
      ...saved,
      columnsMap: Object.fromEntries(
        Object.entries(saved.columnsMap).filter(
          ([, column]) => column.columnDefinition.name !== 'averageConsumption',
        ),
      ),
    };
    vi.mocked(client.get).mockResolvedValueOnce({ data: template });
    vi.mocked(client.put).mockRejectedValueOnce(
      httpError(400, { numberOfPeriodsToAverage: { message: 'Invalid period count' } }),
    );
    const user = userEvent.setup();
    renderPage(<Editor initialTab="settings" template={template} />, {
      queryClient: seededClient(),
    });
    const save = 'requisition-templates.configure.save';
    await user.click(await screen.findByRole('button', { name: save }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: save }),
    );
    expect(await screen.findByText('Invalid period count')).toBeVisible();
  });

  it('opens Settings for a duplicate name and clears the refusal on edit', async () => {
    vi.mocked(client.put).mockRejectedValueOnce(
      httpError(400, { messageKey: 'requisition.error.validation.templateNameDuplication' }),
    );
    const user = userEvent.setup();
    renderPage(<Editor />, { queryClient: seededClient() });
    const save = 'requisition-templates.configure.save';
    await user.click(await screen.findByRole('button', { name: save }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: save }),
    );
    const name = await screen.findByRole('textbox', {
      name: /requisition-templates.configure.name/,
    });
    expect(name).toHaveAccessibleDescription('requisition-templates.form.name-taken');
    await user.type(name, ' updated');
    expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('uses read-timeout copy when the fresh template read fails before saving', async () => {
    vi.mocked(client.get).mockRejectedValueOnce(
      new AxiosError('Timeout', 'ECONNABORTED', { method: 'get', headers: new AxiosHeaders() }),
    );
    const user = userEvent.setup();
    renderPage(<Editor />, { queryClient: seededClient() });
    const save = 'requisition-templates.configure.save';
    await user.click(await screen.findByRole('button', { name: save }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: save }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('requisition-templates.configure.save-error-title', {
        description: 'api-error.timeout-read',
      }),
    );
    expect(client.put).not.toHaveBeenCalled();
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
