import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PencilIcon, ShieldIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { expect, it, vi } from 'vitest';
import { type CardAction, CardActions } from '@/components/card-actions';

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
