import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductName } from '@/features/stock-events/components/product-name';

it('offers the full truncated name by keyboard focus and touch activation', async () => {
  const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
  try {
    const user = userEvent.setup();
    render(<ProductName label="A long product name - tablets" />);
    const trigger = screen.getByRole('button', { name: 'A long product name - tablets' });
    await user.tab();
    expect(trigger).toHaveFocus();
    expect(
      await screen.findByText('A long product name - tablets', {
        selector: '[data-slot=tooltip-content] bdi',
      }),
    ).toBeVisible();
    await user.tab();
    await waitFor(() =>
      expect(
        screen.queryByText('A long product name - tablets', {
          selector: '[data-slot=tooltip-content] bdi',
        }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(trigger);
    expect(
      await screen.findByText('A long product name - tablets', {
        selector: '[data-slot=tooltip-content] bdi',
      }),
    ).toBeVisible();
  } finally {
    client.mockRestore();
    scroll.mockRestore();
  }
});

it('keeps a name that fits out of the tab sequence', () => {
  render(<ProductName label="Aspirin" />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText('Aspirin')).toBeInTheDocument();
});

it('retains keyboard focus when a resized name fits, then removes the extra tab stop on blur', async () => {
  const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
  const original = globalThis.ResizeObserver;
  let resize!: () => void;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(element: Element) {
        if (element.tagName === 'SPAN')
          resize = () => this.callback([], this as unknown as ResizeObserver);
      }
      disconnect() {}
    },
  );
  try {
    const user = userEvent.setup();
    render(
      <>
        <ProductName label="A long product name - tablets" />
        <button type="button">Next</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'A long product name - tablets' });
    await user.tab();
    expect(trigger).toHaveFocus();
    client.mockReturnValue(250);
    act(resize);
    expect(trigger).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: 'A long product name - tablets' }),
    ).not.toBeInTheDocument();
  } finally {
    client.mockRestore();
    scroll.mockRestore();
    vi.stubGlobal('ResizeObserver', original);
  }
});
