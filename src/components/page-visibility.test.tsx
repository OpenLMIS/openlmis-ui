import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
    await act(() =>
      view.rerender(<PageVisibility hidden={false}>{contents[kind]}</PageVisibility>),
    );
    expect(screen.queryByRole(role)).not.toBeInTheDocument();
  },
);

it.each([false, true])(
  'keeps a popover closed after reconnect (controlled: %s)',
  async (controlled) => {
    const changed = vi.fn();
    function Example({ hidden }: { hidden: boolean }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button">Connection retry</button>
          <PageVisibility hidden={hidden}>
            <Popover
              open={controlled ? open : undefined}
              onOpenChange={(next) => {
                changed(next);
                setOpen(next);
              }}
            >
              <PopoverTrigger>Filters</PopoverTrigger>
              <PopoverContent>
                <input aria-label="Filter value" />
              </PopoverContent>
            </Popover>
          </PageVisibility>
        </>
      );
    }
    const view = render(<Example hidden={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await screen.findByRole('dialog');
    changed.mockClear();
    await act(() => view.rerender(<Example hidden />));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Connection retry' }));
    await act(() => view.rerender(<Example hidden={false} />));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connection retry' })).toHaveFocus();
    expect(changed.mock.calls).toEqual([[false]]);
  },
);

it.each(['popover', 'dialog'] as const)(
  'honors cancelled Escape in an uncontrolled %s',
  async (kind) => {
    const cancel = vi.fn((_open: boolean, details: { cancel: () => void }) => details.cancel());
    render(
      kind === 'popover' ? (
        <Popover defaultOpen onOpenChange={cancel}>
          <PopoverContent>
            <input aria-label="Kept draft" />
          </PopoverContent>
        </Popover>
      ) : (
        <Dialog defaultOpen onOpenChange={cancel}>
          <DialogContent>
            <DialogTitle>Kept draft</DialogTitle>
            <input aria-label="Kept draft" />
          </DialogContent>
        </Dialog>
      ),
    );
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-open');
    expect(screen.getByRole('textbox', { name: 'Kept draft' })).toBeInTheDocument();
  },
);
