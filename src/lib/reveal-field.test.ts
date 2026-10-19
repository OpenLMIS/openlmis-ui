import { expect, it, vi } from 'vitest';
import { revealField } from '@/lib/reveal-field';

function field() {
  const card = document.createElement('li');
  const input = document.createElement('input');
  card.append(input);
  document.body.append(card);
  card.scrollIntoView = vi.fn();
  input.scrollIntoView = vi.fn();
  const focus = vi.spyOn(input, 'focus');
  return { card, input, focus };
}

it('leaves table fields to the browser focus scroll so sticky bars never cover them', () => {
  const { card, input, focus } = field();
  revealField(input, false);
  expect(focus).toHaveBeenCalledWith();
  expect(input.scrollIntoView).not.toHaveBeenCalled();
  expect(card.scrollIntoView).not.toHaveBeenCalled();
});

it('brings the whole card into view before focusing a card field', () => {
  const { card, input, focus } = field();
  revealField(input, true);
  expect(card.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});
