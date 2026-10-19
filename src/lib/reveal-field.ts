export function revealField(target: HTMLElement, cards: boolean) {
  if (cards) target.closest('li')?.scrollIntoView?.({ block: 'start' });
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  target.focus({ preventScroll: true });
}
