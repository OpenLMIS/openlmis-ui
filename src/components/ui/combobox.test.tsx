import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

function Picker({ items }: { items: string[] }) {
  return (
    <Combobox items={items} defaultOpen>
      <ComboboxInput aria-label="Product" />
      <ComboboxContent>
        <ComboboxEmpty>Loading Products...</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

it('removes decorative scroll hints when options are empty, including after a list was populated', async () => {
  const { rerender } = render(<Picker items={[]} />);
  await screen.findByText('Loading Products...');
  const hints = () =>
    document.querySelectorAll('[data-slot="combobox-scroll-area"] > span[aria-hidden="true"]');
  expect(hints()).toHaveLength(0);

  const input = screen.getByRole('combobox', { name: 'Product' });
  await userEvent.setup().click(input);
  rerender(<Picker items={['Levora']} />);
  await screen.findByRole('option', { name: 'Levora' });
  expect(input).toHaveFocus();
  rerender(<Picker items={[]} />);
  await waitFor(() => expect(hints()).toHaveLength(0));
  expect(input).toHaveFocus();
});
