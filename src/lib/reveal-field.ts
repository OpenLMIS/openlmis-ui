export function revealField(
  target: HTMLElement,
  cards: boolean,
  table: 'focus' | 'nearest' = 'focus',
) {
  if (!cards && table === 'focus') {
    target.focus();
    return;
  }
  if (cards) target.closest('li')?.scrollIntoView?.({ block: 'start' });
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  target.focus({ preventScroll: true });
}
