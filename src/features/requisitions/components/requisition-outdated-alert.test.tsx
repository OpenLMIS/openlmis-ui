import { cleanup, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it } from 'vitest';
import { IsolatingICU } from '@/lib/isolate-values';
import ar from '../../../../public/locales/ar.json';
import { RequisitionOutdatedAlert } from './requisition-outdated-alert';

afterEach(cleanup);
it('isolates the facility label in an Arabic outdated title', async () => {
  const i18n = createInstance();
  await i18n.use(IsolatingICU).init({
    lng: 'ar',
    keySeparator: false,
    nsSeparator: false,
    resources: { ar: { translation: ar } },
  });
  render(
    <I18nextProvider i18n={i18n}>
      <RequisitionOutdatedAlert label="Clinic">Update</RequisitionOutdatedAlert>
    </I18nextProvider>,
  );
  expect(screen.getByText(/Clinic/).textContent).toContain('\u2068Clinic\u2069');
});
