import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EyeIcon, PencilIcon, ShieldIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { expect, it, vi } from 'vitest';
import { type CardAction, CardActions, RowActions } from '@/components/display/card-actions';

const edit: CardAction = { id: 'edit', icon: <PencilIcon />, label: 'Edit', onSelect: vi.fn() };
const roles: CardAction = { id: 'roles', icon: <ShieldIcon />, label: 'Roles', onSelect: vi.fn() };
const remove: CardAction = {
  id: 'remove',
  icon: <Trash2Icon />,
  label: 'Remove',
  name: 'Remove Admin',
  destructive: true,
  onSelect: vi.fn(),
};
const members: CardAction = { id: 'members', icon: <UsersIcon />, label: 'Members' };

const buttonNames = (group: HTMLElement) =>
  within(group)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));

it('shows up to three actions as buttons, destructive first and the main action last', () => {
  render(<CardActions actions={[edit, remove, roles]} label="Actions For Admin" />);

  const group = screen.getByRole('group', { name: 'Actions For Admin' });
  expect(buttonNames(group)).toEqual(['Remove Admin', 'Roles', 'Edit']);
});

it('keeps the main action and one other as buttons and moves the rest, destructive last, to a menu', async () => {
  const user = userEvent.setup();
  render(<CardActions actions={[edit, remove, roles, members]} label="Actions For Admin" />);

  const group = screen.getByRole('group', { name: 'Actions For Admin' });
  expect(buttonNames(group)).toEqual(['Actions For Admin', 'Roles', 'Edit']);

  await user.click(within(group).getByRole('button', { name: 'Actions For Admin' }));
  const items = await screen.findAllByRole('menuitem');
  expect(items.map((item) => item.textContent)).toEqual(['Members', 'Remove']);
  await user.click(screen.getByRole('menuitem', { name: 'Remove Admin' }));
  expect(remove.onSelect).toHaveBeenCalledOnce();
});

it('returns keyboard focus to the menu trigger after a non-dialog action', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <RowActions
      label="Order Actions"
      actions={[{ ...edit, opensDialog: false, onSelect }]}
      variant="menu"
    />,
  );
  const trigger = screen.getByRole('button', { name: 'Order Actions' });
  trigger.focus();
  await user.keyboard('{Enter}');
  await screen.findByRole('menuitem', { name: 'Edit' });
  await user.keyboard('{ArrowDown}{Enter}');
  expect(onSelect).toHaveBeenCalledOnce();
  await waitFor(() => expect(trigger).toHaveFocus());
});

const view: CardAction = {
  id: 'view',
  icon: <EyeIcon />,
  label: 'View',
  name: 'View Admin',
  onSelect: vi.fn(),
};

it('shows one or two reference actions as icons and more than two in a menu', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<RowActions actions={[view]} label="Actions For Admin" />);
  expect(screen.getByRole('button', { name: 'View Admin' })).not.toHaveTextContent('View');
  rerender(<RowActions actions={[view, edit]} label="Actions For Admin" />);
  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'Actions For Admin' })).toBeNull();
  rerender(<RowActions actions={[view, edit, remove]} label="Actions For Admin" />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Actions For Admin' }));
  expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual([
    'View',
    'Edit',
    'Remove',
  ]);
});

it('preserves an explicit menu for stock recovery and disables reference icon actions', () => {
  const { rerender } = render(
    <RowActions actions={[view, remove]} label="Recovery" variant="menu" />,
  );
  expect(screen.getByRole('button', { name: 'Recovery' })).toHaveAttribute('aria-haspopup', 'menu');
  rerender(<RowActions actions={[view, remove]} label="Reference" disabled />);
  expect(screen.getByRole('button', { name: 'View Admin' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove Admin' })).toBeDisabled();
});
