import { expect, it } from 'vitest';
import { isDialogCards } from '@/hooks/use-card-view';

it('keeps narrow dialogs as tables at full width and switches once the screen squeezes them', () => {
  expect(isDialogCards(544, 'table')).toBe(false);
  expect(isDialogCards(530, 'table')).toBe(true);
  expect(isDialogCards(736, 'xl')).toBe(false);
  expect(isDialogCards(671, 'xl')).toBe(true);
  expect(isDialogCards(undefined, 'table')).toBe(false);
});
