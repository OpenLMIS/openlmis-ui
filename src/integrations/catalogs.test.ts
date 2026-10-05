import {
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTimeElement,
  type MessageFormatElement,
  parse,
} from '@formatjs/icu-messageformat-parser';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { IsolatingICU } from '@/lib/isolate-values';

const languages = ['en', 'pt', 'ar', 'es', 'fr'];
const catalogFiles = import.meta.glob<string>('../../public/locales/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});
function readCatalog(language: string) {
  const raw = catalogFiles[`../../public/locales/${language}.json`];
  if (!raw) throw new Error(`Missing catalogue: ${language}`);
  return raw;
}
const catalog = (language: string) => JSON.parse(readCatalog(language)) as Record<string, string>;

function argumentsIn(elements: MessageFormatElement[], argumentsUsed = new Set<string>()) {
  for (const element of elements) {
    if (
      isArgumentElement(element) ||
      isNumberElement(element) ||
      isDateElement(element) ||
      isTimeElement(element) ||
      isPluralElement(element) ||
      isSelectElement(element)
    ) {
      argumentsUsed.add(`${element.value}:${element.type}`);
    }
    if (isSelectElement(element) || isPluralElement(element)) {
      const selectors = Object.keys(element.options)
        .filter((key) => isSelectElement(element) || key.startsWith('='))
        .sort();
      argumentsUsed.add(`${element.value}:selectors:${selectors.join(',')}`);
      for (const option of Object.values(element.options)) argumentsIn(option.value, argumentsUsed);
    }
  }
  return [...argumentsUsed].sort();
}

describe('language catalogues', () => {
  it.each(languages)(
    '%s has every English key once, sorted, with nonempty flat values',
    (language) => {
      const raw = readCatalog(language);
      const rawKeys = [...raw.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)].map((match) =>
        JSON.parse(match[1]),
      );
      const messages = catalog(language);
      expect(rawKeys).toHaveLength(new Set(rawKeys).size);
      expect(Object.keys(messages)).toEqual(Object.keys(catalog('en')));
      expect(rawKeys).toEqual([...rawKeys].sort());
      for (const [key, message] of Object.entries(messages)) {
        expect(typeof message, key).toBe('string');
        expect(message.trim(), key).not.toBe('');
        expect(() => parse(message, { ignoreTag: true }), key).not.toThrow();
      }
    },
  );

  it.each(['es', 'fr'])('%s preserves names, argument types and select values', (language) => {
    const messages = catalog(language);
    for (const [key, english] of Object.entries(catalog('en'))) {
      expect(argumentsIn(parse(messages[key], { ignoreTag: true })), key).toEqual(
        argumentsIn(parse(english, { ignoreTag: true })),
      );
    }
  });

  it.each(['es', 'fr'])(
    '%s renders real named, numeric, plural and select messages',
    async (language) => {
      const translator = i18next.createInstance();
      await translator.use(IsolatingICU).init({
        lng: language,
        keySeparator: false,
        nsSeparator: false,
        resources: { [language]: { translation: catalog(language) } },
      });
      const t = translator.t as (key: string, values: Record<string, unknown>) => string;
      expect(t('roles.form.updated', { role: 'Clinic A', count: 2 })).toContain('Clinic A');
      expect(t('roles.form.updated', { role: 'Clinic A', count: 2 })).toContain('2');
      expect(t('data-table.selected-count', { count: 12345 })).toContain(
        new Intl.NumberFormat(language).format(12345),
      );
      for (const count of [0, 1, 2, 1000000]) {
        const rendered = t('products.kit.add-picked', { count });
        expect(rendered).not.toMatch(/[{}]/);
        expect(rendered).not.toBe('products.kit.add-picked');
      }
      expect(t('users.roles.form.add-title', { type: 'SUPERVISION' })).not.toBe(
        t('users.roles.form.add-title', { type: 'ORDER_FULFILLMENT' }),
      );
      expect(t('valid-assignments.title', { kind: 'destinations' })).not.toBe(
        t('valid-assignments.title', { kind: 'sources' }),
      );
    },
  );
});
