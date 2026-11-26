import { expect, it } from 'vitest';
import { isDisplayed } from '@/features/system-notifications/lib/displayed';

const startDate = '2026-01-01T12:00:00Z';
const expiryDate = '2026-01-01T13:00:00Z';
const now = Date.parse(startDate);

it('requires an active notification and treats missing bounds as open', () => {
  expect(isDisplayed({ active: false }, now)).toBe(false);
  expect(isDisplayed({ active: true }, now)).toBe(true);
  expect(isDisplayed({ active: true, startDate }, now - 1)).toBe(false);
  expect(isDisplayed({ active: true, expiryDate }, Date.parse(expiryDate) + 1)).toBe(false);
});

it('includes both ends of the display window', () => {
  const notice = { active: true, startDate, expiryDate };
  expect(isDisplayed(notice, now)).toBe(true);
  expect(isDisplayed(notice, Date.parse(expiryDate))).toBe(true);
});
