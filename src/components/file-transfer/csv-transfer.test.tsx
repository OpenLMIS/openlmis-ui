import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { toast } from 'sonner';
import { beforeAll, expect, it, vi } from 'vitest';
import { CsvTransfer } from '@/components/file-transfer/csv-transfer';
import type { CsvTransferApi, CsvTransferCopy } from '@/components/file-transfer/types';
import { TranslatedFormMessages } from '@/components/i18n/translated-form-messages';
import { downloadFile } from '@/lib/download-file';
import { httpError, networkError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';
import en from '../../../public/locales/en.json';

vi.mock('@/lib/download-file', () => ({ downloadFile: vi.fn() }));

const api = {
  exportCsv: vi.fn<CsvTransferApi['exportCsv']>(),
  uploadCsv: vi.fn<CsvTransferApi['uploadCsv']>(),
  exportFilename: 'values.csv',
  emptyFileKeys: ['referenceData.error.upload.file.empty'],
} satisfies CsvTransferApi;

const copy = {
  exportLabel: 'Current Values',
  uploadLabel: 'Upload Updated Values',
  uploadError: 'The upload result could not be confirmed.',
} satisfies CsvTransferCopy;

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

async function renderUpload(describeUploadError?: (error: unknown) => string | undefined) {
  renderPage(
    <TranslatedFormMessages>
      <CsvTransfer api={api} copy={copy} describeUploadError={describeUploadError} />
    </TranslatedFormMessages>,
    { queryClient: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) },
  );
  await screen.findByRole('button', { name: 'Upload' });
  return {
    user: userEvent.setup({ applyAccept: false }),
    input: screen.getByLabelText(/^CSV File/, { selector: 'input[type=file]' }),
    submit: screen.getByRole('button', { name: 'Upload' }),
    chooser: () => screen.getByRole('button', { name: /^CSV File/ }),
  };
}

it('validates chosen files, preserves a canceled selection and clears errors with focus restored', async () => {
  const { user, input, submit, chooser } = await renderUpload();
  expect(submit).toBeDisabled();
  expect(chooser()).toHaveAccessibleDescription('Required');

  await user.upload(input, new File(['data'], 'wrong.txt'));
  expect(submit).toBeEnabled();
  await user.click(submit);
  expect(await screen.findByText('Choose a .csv file.')).toBeVisible();
  expect(chooser()).toBeInvalid();
  expect(chooser()).toHaveAccessibleDescription(/Choose a \.csv file\./);
  expect(api.uploadCsv).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Remove File' }));
  expect(chooser()).toHaveFocus();
  expect(chooser()).not.toBeInvalid();
  expect(screen.queryByText('Choose a .csv file.')).not.toBeInTheDocument();
  expect(submit).toBeDisabled();

  await user.upload(input, new File([], 'empty.csv'));
  await user.click(submit);
  expect(await screen.findByText('Selected file is empty')).toBeVisible();
  expect(api.uploadCsv).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [] } });
  expect(chooser()).toHaveAccessibleName('CSV File empty.csv');
  await user.click(screen.getByRole('button', { name: 'Remove File' }));
  expect(chooser()).toHaveFocus();
  expect(screen.queryByText('Selected file is empty')).not.toBeInTheDocument();
  expect(submit).toBeDisabled();
});

it('retains a refused file through export failure, supports same-file retry and resets after success including zero', async () => {
  const success = vi.spyOn(toast, 'success');
  const exportError = vi.spyOn(toast, 'error');
  const { user, input, submit, chooser } = await renderUpload();
  const file = new File(['header\nvalue'], 'Amounts.CSV');
  api.uploadCsv.mockRejectedValueOnce(
    httpError(400, {
      messageKey: 'cce.error.upload.header.invalid',
      message: 'Invalid Headers in upload file: [maker].',
    }),
  );
  await user.upload(input, file);
  await user.click(submit);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid Headers in upload file: [maker].',
  );
  expect(chooser()).toHaveAccessibleDescription(/Invalid Headers in upload file: \[maker\]\./);
  expect(chooser()).toHaveAccessibleName('CSV File Amounts.CSV');
  let rejectExport: (error: Error) => void = () => undefined;
  api.exportCsv.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectExport = reject;
    }),
  );
  const exportButton = screen.getByRole('button', { name: 'Export CSV' });
  exportButton.focus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(exportButton).toHaveAttribute('aria-disabled', 'true'));
  expect(exportButton).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(api.exportCsv).toHaveBeenCalledOnce();
  await act(async () => rejectExport(networkError()));
  await waitFor(() => expect(exportError).toHaveBeenCalledWith('Export Failed', expect.anything()));
  expect(exportButton).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid Headers in upload file: [maker].');
  expect(chooser()).toHaveAccessibleName('CSV File Amounts.CSV');
  const exported = new Blob(['header']);
  api.exportCsv.mockResolvedValueOnce(exported);
  await user.click(exportButton);
  await waitFor(() => expect(downloadFile).toHaveBeenCalledWith(exported, 'values.csv'));

  await user.upload(input, file);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  let complete: (value: { amount: number }) => void = () => undefined;
  api.uploadCsv.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  submit.focus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(chooser()).toBeDisabled());
  expect(submit).toHaveAttribute('aria-disabled', 'true');
  expect(submit).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Remove File' })).toBeDisabled();
  await user.keyboard('{Enter}');
  fireEvent.submit(submit.closest('form') as HTMLFormElement);
  expect(api.uploadCsv).toHaveBeenCalledTimes(2);
  await act(async () => complete({ amount: 7080 }));
  await waitFor(() => expect(chooser()).toHaveAccessibleName('CSV File No File Chosen'));
  expect(success).toHaveBeenLastCalledWith('Upload Complete', {
    description: 'File uploaded successfully. Number of records processed: 7,080',
  });
  expect(submit).toHaveAttribute('aria-disabled', 'true');
  expect(submit).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(api.uploadCsv).toHaveBeenCalledTimes(2);

  api.uploadCsv.mockResolvedValueOnce({ amount: 0 });
  await user.upload(input, file);
  await user.click(submit);
  await waitFor(() => expect(chooser()).toHaveAccessibleName('CSV File No File Chosen'));
  expect(success).toHaveBeenLastCalledWith('Upload Complete', {
    description: 'File uploaded successfully. Number of records processed: 0',
  });
  expect(api.uploadCsv).toHaveBeenLastCalledWith(file, expect.anything());
});

it.each([
  [
    httpError(400, {
      messageKey: 'referenceData.error.upload.file.empty',
      message: 'referenceData.error.upload.file.empty',
    }),
    'Selected file is empty',
  ],
  [httpError(413, '<html>too large</html>'), en['file-transfer.file-too-large']],
  [
    httpError(500, { messageKey: 'referenceData.internal', message: 'Technical exception' }),
    copy.uploadError,
  ],
  [httpError(400, { message: 'Framework exception' }), copy.uploadError],
  [networkError(), copy.uploadError],
])(
  'shows a safe upload error and clears it when removing the retained file (%#)',
  async (error, message) => {
    const { user, input, submit, chooser } = await renderUpload();
    api.uploadCsv.mockRejectedValueOnce(error);
    await user.upload(input, new File(['header'], 'values.csv'));
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(chooser()).toHaveAccessibleName('CSV File values.csv');
    await user.click(screen.getByRole('button', { name: 'Remove File' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(chooser()).toHaveFocus();
    expect(submit).toBeDisabled();
  },
);

it('shows an explained refusal with the server message kept below it', async () => {
  const { user, input, submit, chooser } = await renderUpload(
    () => 'Line 2: "gasoline" is not an energy source.',
  );
  api.uploadCsv.mockRejectedValueOnce(
    httpError(400, {
      messageKey: 'cce.error.upload.record.invalid',
      message:
        "Error found while parsing in row 1: 'gasoline' could not be parsed as an EnergySource.",
    }),
  );
  await user.upload(input, new File(['header'], 'values.csv'));
  await user.click(submit);
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Line 2: "gasoline" is not an energy source.');
  expect(alert).toHaveTextContent(
    "Server message: Error found while parsing in row 1: 'gasoline' could not be parsed as an EnergySource.",
  );
  expect(chooser()).toHaveAccessibleDescription(/Line 2: "gasoline" is not an energy source\./);
});
