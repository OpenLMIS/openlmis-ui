import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { UpdateButton } from '@/components/update-button';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { allowUnload } from '@/hooks/use-leave-guard';
import { applyUpdate } from '@/lib/service-worker';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: () => ({ status: 'idle' }),
}));
vi.mock('@/lib/service-worker', () => ({
  useUpdateReady: () => true,
  applyUpdate: vi.fn(),
}));

function UnsavedEditor() {
  const guard = useDiscardGuard(true);
  return (
    <>
      <UpdateButton />
      <DiscardChangesDialog {...guard.dialog} description="Unsaved edits" />
    </>
  );
}

it('offers neutral discard wording and applies the update only after confirmation', async () => {
  const language = createInstance();
  await language.init({
    lng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: { en: { translation: en } },
  });
  render(
    <I18nextProvider i18n={language}>
      <UnsavedEditor />
    </I18nextProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: en['update.reload-to-update'] }));
  expect(applyUpdate).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Discard And Log Out' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Discard Changes' }));
  expect(applyUpdate).toHaveBeenCalledExactlyOnceWith(allowUnload);
});
