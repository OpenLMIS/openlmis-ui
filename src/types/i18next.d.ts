import type en from '@/messages/en.json';

declare module 'i18next' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: This is the recommended way to extend i18next types.
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
