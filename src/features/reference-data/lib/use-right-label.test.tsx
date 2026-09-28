import { renderHook } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { useRightLabel } from '@/features/reference-data/lib/use-right-label';
import en from '../../../../public/locales/en.json';

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: { en: { translation: en } },
  });
});

describe('useRightLabel', () => {
  it("uses the right's translated label, including the ones legacy showed as raw keys", () => {
    const { result } = renderHook(() => useRightLabel());

    expect(result.current('USERS_MANAGE')).toBe('Manage Users');
    expect(result.current('PRICE_CHANGES_VIEW')).toBe('View Price Changes');
    expect(result.current('MANAGE_DHIS2_SUPERVISORY_NODES')).toBe('Manage DHIS2 Supervisory Nodes');
  });

  it('turns a right it has no label for into words, as a deployment can add report rights', () => {
    const { result } = renderHook(() => useRightLabel());

    expect(result.current('MALARIA_DASHBOARD_RIGHT')).toBe('Malaria Dashboard Right');
  });
});
