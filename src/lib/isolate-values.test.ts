import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { IsolatingICU, isolateValues } from '@/lib/isolate-values';

const isolated = (text: string) => `⁨${text}⁩`;

describe('isolateValues', () => {
  it('isolates a name put into a sentence, so its own direction is kept', () => {
    expect(isolateValues('Edit {product}', { product: '2 in 1 Dandruff' })).toEqual({
      product: isolated('2 in 1 Dandruff'),
    });
  });

  it('leaves the values that choose a branch, a plural or a number format as they are', () => {
    const values = { type: 'SUPERVISION', count: 2, total: 3 };

    expect(
      isolateValues(
        '{type, select, SUPERVISION {A} other {B}} {count, plural, one {# row} other {# rows}} {total, number}',
        values,
      ),
    ).toBe(values);
  });

  it('isolates a name inside a branch, but not the value that chose it', () => {
    expect(
      isolateValues('{type, select, SUPERVISION {Add {role}} other {Add}}', {
        type: 'SUPERVISION',
        role: 'Store Manager',
      }),
    ).toEqual({ type: 'SUPERVISION', role: isolated('Store Manager') });
  });

  it('leaves numbers, empty text and values the message does not use', () => {
    const values = { count: 3, name: '', lng: 'ar' };

    expect(isolateValues('{count} {name}', values)).toBe(values);
  });
});

describe('IsolatingICU', () => {
  async function translator(lng: string) {
    const i18n = i18next.createInstance();
    await i18n.use(IsolatingICU).init({
      lng,
      resources: {
        ar: { translation: { title: 'تعديل {product}', kind: '{type, select, A {أ} other {ب}}' } },
        en: { translation: { title: 'Edit {product}' } },
      },
    });
    return i18n.t as (key: string, values: Record<string, string>) => string;
  }

  it('isolates the names put into a right-to-left message', async () => {
    const t = await translator('ar');

    expect(t('title', { product: '2 in 1 Dandruff' })).toBe(`تعديل ${isolated('2 in 1 Dandruff')}`);
    expect(t('kind', { type: 'A' })).toBe('أ');
  });

  it('leaves a left-to-right message as it is', async () => {
    const t = await translator('en');

    expect(t('title', { product: '2 in 1 Dandruff' })).toBe('Edit 2 in 1 Dandruff');
  });
});
