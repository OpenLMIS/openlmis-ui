import { render, screen, within } from '@testing-library/react';
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

const view: CardAction = {
  id: 'view',
  icon: <EyeIcon />,
  label: 'View',
  name: 'View Admin',
  primary: true,
  onSelect: vi.fn(),
};

it('keeps the main row action one click away and only secondaries in the menu', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<RowActions actions={[edit, view]} label="Actions For Admin" />);
  const group = screen.getByRole('group', { name: 'Actions For Admin' });
  expect(within(group).getByRole('button', { name: 'View Admin' })).toHaveTextContent('View');
  expect(buttonNames(group)).toEqual(['View Admin', 'Edit']);

  rerender(<RowActions actions={[view, edit, remove]} label="Actions For Admin" slots={1} />);
  expect(buttonNames(screen.getByRole('group'))).toEqual(['View Admin', 'Actions For Admin']);
  await user.click(screen.getByRole('button', { name: 'Actions For Admin' }));
  expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual([
    'Edit',
    'Remove',
  ]);
});

it('reserves secondary slots so the main action stays aligned across rows', () => {
  render(
    <>
      <RowActions actions={[view]} label="Actions For Admin" slots={1} />
      <RowActions actions={[view, remove]} label="Actions For Guest" slots={1} />
    </>,
  );
  const [admin, guest] = screen.getAllByRole('group');
  expect(admin.children).toHaveLength(2);
  expect(guest.children).toHaveLength(2);
});
