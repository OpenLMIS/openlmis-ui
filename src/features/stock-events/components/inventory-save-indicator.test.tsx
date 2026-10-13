import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { InventorySaveIndicator } from '@/features/stock-events/components/inventory-save-indicator';

it('keeps keystroke saving and saved transitions out of the live region', () => {
  const view = render(<InventorySaveIndicator status="saved" />);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  for (let i = 0; i < 3; i++) {
    view.rerender(<InventorySaveIndicator status="saving" />);
    expect(screen.getByText('physical-inventory.saving')).toBeVisible();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    view.rerender(<InventorySaveIndicator status="saved" />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  }
});
it('announces a failed write and its recovery', () => {
  const view = render(<InventorySaveIndicator status="failed" />);
  expect(screen.getByRole('status')).toHaveTextContent('physical-inventory.not-saved-local');
  view.rerender(<InventorySaveIndicator status="saving" />);
  expect(screen.getByRole('status')).toHaveTextContent('physical-inventory.not-saved-local');
  view.rerender(<InventorySaveIndicator status="saved" />);
  expect(screen.getByRole('status')).toHaveTextContent('physical-inventory.saved-local');
});
