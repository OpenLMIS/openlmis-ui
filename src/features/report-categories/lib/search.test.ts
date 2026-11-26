import { expect, it } from 'vitest';
import { reportCategoriesSearchSchema } from '@/features/report-categories/lib/search';

it('normalizes dialog target UUIDs so saves and lookups match the server ids', () => {
  const id = '8b46ed1e-bc42-4af5-9bce-721bb71bb4db';
  expect(
    reportCategoriesSearchSchema.parse({ category: id.toUpperCase(), delete: id.toUpperCase() }),
  ).toEqual({ category: id, delete: id });
});
