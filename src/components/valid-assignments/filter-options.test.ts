import { describe, expect, it } from 'vitest';
import { withPicked } from '@/components/valid-assignments/filter-options';

const options = [{ value: 'p1', label: 'EPI' }];

describe('withPicked', () => {
  it('offers the list as it is with nothing picked', () => {
    expect(withPicked(options, undefined, 'Unknown')).toEqual({ value: '', options });
  });

  it('keeps a pick the list has', () => {
    expect(withPicked(options, 'p1', 'Unknown')).toEqual({ value: 'p1', options });
  });

  it('keeps a pick from the URL the list does not have, named as unknown', () => {
    expect(withPicked(options, 'gone', 'Unknown')).toEqual({
      value: 'gone',
      options: [{ value: 'gone', label: 'Unknown' }, ...options],
    });
  });

  it('keeps the pick while the list is still loading', () => {
    expect(withPicked(undefined, 'p1', 'Unknown')).toEqual({ value: 'p1', options: [] });
  });
});
