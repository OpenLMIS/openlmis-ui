import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyKeyButton } from '@/features/service-accounts/components/copy-key-button';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: {
      en: {
        translation: {
          'service-accounts.copy': 'Copy Key',
          'service-accounts.copied': 'Key Copied',
          'service-accounts.copy-error-title': 'Could Not Copy Key',
          'service-accounts.copy-error': 'Select the key and copy it by hand.',
        },
      },
    },
  });
});

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('CopyKeyButton', () => {
  it('copies the key, says so, then offers to copy again', async () => {
    writeText.mockResolvedValueOnce();
    render(<CopyKeyButton token="k1" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy Key' })));
    expect(writeText).toHaveBeenCalledWith('k1');
    expect(screen.getByRole('button', { name: 'Key Copied' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('button', { name: 'Copy Key' })).toBeInTheDocument();
  });

  it('says how to copy by hand when the browser refuses', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<CopyKeyButton token="k1" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy Key' })));
    expect(toast.error).toHaveBeenCalledWith('Could Not Copy Key', {
      description: 'Select the key and copy it by hand.',
    });
    expect(screen.getByRole('button', { name: 'Copy Key' })).toBeInTheDocument();
  });
});
