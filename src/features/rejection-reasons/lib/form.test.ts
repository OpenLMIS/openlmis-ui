import { describe, expect, it } from 'vitest';
import { toCategoryBody } from '@/features/rejection-reasons/lib/category-form';
import { toReasonBody } from '@/features/rejection-reasons/lib/reason-form';

const category = {
  id: 'c1',
  name: 'Old category',
  code: 'C',
  active: true,
  extraData: { keep: 'category' },
};
const saved = {
  id: 'r1',
  name: 'Old reason',
  code: 'R',
  active: true,
  rejectionReasonCategory: category,
  extraData: { keep: 'reason' },
};

describe('rejection reason save bodies', () => {
  it('retains the saved category id and unrendered fields while preserving entered text and explicit false', () => {
    expect(
      toCategoryBody({ name: ' Entered name ', code: ' Entered code ', active: false }, category),
    ).toEqual({ ...category, name: ' Entered name ', code: ' Entered code ', active: false });
  });

  it('resolves the whole latest category by id, including inactive choices, and retains unrendered reason fields', () => {
    const latest = {
      ...category,
      name: 'Latest category',
      active: false,
      extraData: { keep: 'latest' },
    };
    const values = {
      name: ' Entered name ',
      code: ' Entered code ',
      active: true,
      categoryId: category.id,
    };
    expect(toReasonBody(values, [latest], saved)).toEqual({
      ...saved,
      name: values.name,
      code: values.code,
      active: true,
      rejectionReasonCategory: latest,
    });
  });

  it('refuses a saved category absent from the loaded collection instead of sending a stale reference', () => {
    expect(() =>
      toReasonBody(
        { name: saved.name, code: saved.code, active: false, categoryId: category.id },
        [],
        saved,
      ),
    ).toThrow();
  });
});
