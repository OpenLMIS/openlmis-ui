import { describe, expect, it } from 'vitest';
import { addTag, tagSuggestions } from '@/components/form/tags';

describe('addTag', () => {
  it('adds the text, trimmed, after the tags already there', () => {
    expect(addTag(['credit'], '  New Tag ')).toEqual({ tags: ['credit', 'New Tag'] });
  });

  it('adds nothing for empty text or spaces', () => {
    expect(addTag(['credit'], '   ')).toBeNull();
  });

  it('takes a tag of any length when no limits are given', () => {
    expect(addTag([], 'a')).toEqual({ tags: ['a'] });
  });

  it('refuses a tag shorter than the minimum', () => {
    expect(addTag([], 'ab', { min: 3 })).toEqual({ refused: 'too-short' });
    expect(addTag([], 'abc', { min: 3 })).toEqual({ tags: ['abc'] });
  });

  it('refuses a tag longer than the maximum', () => {
    expect(addTag([], 'a'.repeat(256), { max: 255 })).toEqual({ refused: 'too-long' });
    expect(addTag([], 'a'.repeat(255), { max: 255 })).toEqual({ tags: ['a'.repeat(255)] });
  });

  it('refuses a tag already there, whatever its case', () => {
    expect(addTag(['cancelMovement'], 'CANCELMOVEMENT')).toEqual({ refused: 'duplicate' });
  });
});

describe('tagSuggestions', () => {
  const tags = ['adjustment', 'cancelAdjustment', 'cancelMovement', 'consumed'];

  it('offers the tags that contain the text, whatever its case', () => {
    expect(tagSuggestions(tags, [], 'CA')).toEqual(['cancelAdjustment', 'cancelMovement']);
    expect(tagSuggestions(tags, [], 'adj')).toEqual(['adjustment', 'cancelAdjustment']);
  });

  it('leaves out the tags already added, whatever their case', () => {
    expect(tagSuggestions(tags, ['CancelMovement'], 'cancel')).toEqual(['cancelAdjustment']);
  });

  it('offers nothing until something is typed', () => {
    expect(tagSuggestions(tags, [], ' ')).toEqual([]);
  });
});
