import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { PageVisibility } from '@/components/page-visibility';
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

it.each(['dialog', 'alert'] as const)(
  'releases retained %s content after closing visibly',
  async (kind) => {
    const Root = kind === 'dialog' ? Dialog : AlertDialog;
    const Content = kind === 'dialog' ? DialogContent : AlertDialogContent;
    const Title = kind === 'dialog' ? DialogTitle : AlertDialogTitle;
    function Example({ hidden }: { hidden: boolean }) {
      const [open, setOpen] = useState(true);
      return (
        <PageVisibility hidden={hidden}>
          <Root open={open} onOpenChange={setOpen}>
            <Content>
              <Title>Draft</Title>
              <input aria-label="Retained input" defaultValue="saved" />
              <button type="button" onClick={() => setOpen(false)}>
                Close draft
              </button>
            </Content>
          </Root>
        </PageVisibility>
      );
    }
    const view = render(<Example hidden={false} />);
    await userEvent.type(screen.getByLabelText('Retained input'), ' changed');
    await act(async () => view.rerender(<Example hidden />));
    await act(async () => view.rerender(<Example hidden={false} />));
    expect(screen.getByLabelText('Retained input')).toHaveValue('saved changed');
    await userEvent.click(screen.getByRole('button', { name: 'Close draft' }));
    await waitFor(() => expect(screen.queryByLabelText('Retained input')).not.toBeInTheDocument());
  },
);

it.each(['sheet', 'menu', 'popover', 'select', 'combobox'] as const)(
  'suppresses an open %s while its page is hidden',
  async (kind) => {
    const contents = {
      select: (
        <Select defaultOpen>
          <SelectTrigger>Select choice</SelectTrigger>
          <SelectContent>
            <SelectItem value="one">One choice</SelectItem>
          </SelectContent>
        </Select>
      ),
      combobox: (
        <Combobox defaultOpen items={['One choice']}>
          <ComboboxInput />
          <ComboboxContent>
            <ComboboxList>
              {(item) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      ),
      sheet: (
        <Sheet defaultOpen>
          <SheetContent>
            <SheetTitle>Sheet draft</SheetTitle>
          </SheetContent>
        </Sheet>
      ),
      menu: (
        <DropdownMenu defaultOpen>
          <DropdownMenuContent>
            <DropdownMenuItem>Menu choice</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      popover: (
        <Popover defaultOpen>
          <PopoverContent>Popover choice</PopoverContent>
        </Popover>
      ),
    };
    const view = render(<PageVisibility hidden={false}>{contents[kind]}</PageVisibility>);
    const role = ['select', 'combobox'].includes(kind)
      ? 'listbox'
      : kind === 'menu'
        ? 'menu'
        : 'dialog';
    await screen.findByRole(role);
    await act(() => view.rerender(<PageVisibility hidden>{contents[kind]}</PageVisibility>));
    await waitFor(() => expect(screen.queryByRole(role)).not.toBeInTheDocument());
  },
);
