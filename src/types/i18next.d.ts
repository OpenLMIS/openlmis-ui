// Type-only import of the source catalog in `public/locales/`; it is never bundled.
import type en from '../../public/locales/en.json';

declare module 'i18next' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: This is the recommended way to extend i18next types.
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
