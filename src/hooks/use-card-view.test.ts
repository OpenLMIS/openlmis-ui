import { expect, it } from 'vitest';
import { isDialogCards } from '@/hooks/use-card-view';

it('keeps narrow dialogs as tables at full width and switches once the screen squeezes them', () => {
  expect(isDialogCards(543, 'table')).toBe(false);
  expect(isDialogCards(542, 'table')).toBe(true);
  expect(isDialogCards(undefined, 'table')).toBe(false);
});

it('switches wide dialogs to cards only below the phone width', () => {
  expect(isDialogCards(672, 'xl')).toBe(false);
  expect(isDialogCards(671, 'xl')).toBe(true);
});
