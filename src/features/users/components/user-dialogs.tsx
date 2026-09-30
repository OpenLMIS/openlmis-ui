import {
  type PasswordDialogTarget,
  ResetPasswordDialog,
} from '@/features/users/components/reset-password-dialog';
import { UserFormDialog } from '@/features/users/components/user-form-dialog';
import type { UsersSearch } from '@/features/users/lib/search';

type UserDialogsProps = {
  user: UsersSearch['user'];
  password: PasswordDialogTarget | undefined;
  onClose: () => void;
  onCreated: (userId: string) => void;
  onEdited: (userId: string) => void;
};

/** The dialogs the users list opens, loaded together as one chunk. */
export function UserDialogs({ user, password, onClose, onCreated, onEdited }: UserDialogsProps) {
  return (
    <>
      <UserFormDialog onClose={onClose} onCreated={onCreated} onEdited={onEdited} target={user} />
      <ResetPasswordDialog onClose={onClose} target={password} />
    </>
  );
}
