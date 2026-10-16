import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { toast } from 'sonner';
import { beforeAll, expect, it, vi } from 'vitest';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import {
  exportIdealStockAmounts,
  uploadIdealStockAmounts,
} from '@/features/ideal-stock-amounts/api/api';
import { IdealStockAmountsUpload } from '@/features/ideal-stock-amounts/components/ideal-stock-amounts-upload';
import { httpError, networkError } from '@/tests/http-error';
import { renderPage } from '@/tests/render-page';
import en from '../../../../public/locales/en.json';

vi.mock('@/features/ideal-stock-amounts/api/api', () => ({
  exportIdealStockAmounts: vi.fn(),
  uploadIdealStockAmounts: vi.fn(),
}));

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

async function renderUpload() {
  renderPage(
    <TranslatedFormMessages>
      <IdealStockAmountsUpload />
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
  expect(uploadIdealStockAmounts).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Remove File' }));
  expect(chooser()).toHaveFocus();
  expect(chooser()).not.toBeInvalid();
  expect(screen.queryByText('Choose a .csv file.')).not.toBeInTheDocument();
  expect(submit).toBeDisabled();

  await user.upload(input, new File([], 'empty.csv'));
  await user.click(submit);
  expect(await screen.findByText('Selected file is empty')).toBeVisible();
  expect(uploadIdealStockAmounts).not.toHaveBeenCalled();
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
  vi.mocked(uploadIdealStockAmounts).mockRejectedValueOnce(
    httpError(400, { messageKey: 'referenceData.invalid', message: 'Row 2: unknown facility.' }),
  );
  await user.upload(input, file);
  await user.click(submit);
  expect(await screen.findByRole('alert')).toHaveTextContent('Row 2: unknown facility.');
  expect(chooser()).toHaveAccessibleDescription(/Row 2: unknown facility\./);
  expect(chooser()).toHaveAccessibleName('CSV File Amounts.CSV');
  let rejectExport: (error: Error) => void = () => undefined;
  vi.mocked(exportIdealStockAmounts).mockReturnValueOnce(
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
  expect(exportIdealStockAmounts).toHaveBeenCalledOnce();
  await act(async () => rejectExport(networkError()));
  await waitFor(() => expect(exportError).toHaveBeenCalledWith('Export Failed', expect.anything()));
  expect(exportButton).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Row 2: unknown facility.');
  expect(chooser()).toHaveAccessibleName('CSV File Amounts.CSV');

  await user.upload(input, file);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  let complete: (value: { amount: number }) => void = () => undefined;
  vi.mocked(uploadIdealStockAmounts).mockReturnValueOnce(
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
  expect(uploadIdealStockAmounts).toHaveBeenCalledTimes(2);
  await act(async () => complete({ amount: 7080 }));
  await waitFor(() => expect(chooser()).toHaveAccessibleName('CSV File No File Chosen'));
  expect(success).toHaveBeenLastCalledWith('Upload Complete', {
    description: 'File uploaded successfully. Number of records processed: 7,080',
  });
  expect(submit).toHaveAttribute('aria-disabled', 'true');
  expect(submit).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(uploadIdealStockAmounts).toHaveBeenCalledTimes(2);

  vi.mocked(uploadIdealStockAmounts).mockResolvedValueOnce({ amount: 0 });
  await user.upload(input, file);
  await user.click(submit);
  await waitFor(() => expect(chooser()).toHaveAccessibleName('CSV File No File Chosen'));
  expect(success).toHaveBeenLastCalledWith('Upload Complete', {
    description: 'File uploaded successfully. Number of records processed: 0',
  });
  expect(uploadIdealStockAmounts).toHaveBeenLastCalledWith(file, expect.anything());
});

it.each([
  [
    httpError(400, {
      messageKey: 'referenceData.error.upload.file.empty',
      message: 'referenceData.error.upload.file.empty',
    }),
    'Selected file is empty',
  ],
  [httpError(413, '<html>too large</html>'), en['ideal-stock-amounts.file-too-large']],
  [
    httpError(500, { messageKey: 'referenceData.internal', message: 'Technical exception' }),
    en['ideal-stock-amounts.upload-error'],
  ],
  [httpError(400, { message: 'Framework exception' }), en['ideal-stock-amounts.upload-error']],
  [networkError(), en['ideal-stock-amounts.upload-error']],
])(
  'shows a safe upload error and clears it when removing the retained file (%#)',
  async (error, message) => {
    const { user, input, submit, chooser } = await renderUpload();
    vi.mocked(uploadIdealStockAmounts).mockRejectedValueOnce(error);
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
