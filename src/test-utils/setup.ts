import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { onlineManager } from '@tanstack/react-query';
import { configure } from '@testing-library/react';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach } from 'vitest';

await createInstance()
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: { en: { translation: {} } },
  });

configure({ asyncUtilTimeout: 10_000 });

afterEach(() => onlineManager.setOnline(true));
