import type { RightType } from '@/features/reference-data/lib/types';
import { AddRoleDialog } from '@/features/users/components/add-role-dialog';
import { ImportRolesDialog } from '@/features/users/components/import-roles-dialog';
import type { RoleAssignment } from '@/lib/user-types';

type RoleDialogsProps = {
  userId: string;
  username: string;
  hasHomeFacility: boolean;
  draft: RoleAssignment[];
  /** The type of role being added, while Add Role is open. */
  addType: RightType | undefined;
  importOpen: boolean;
  onAdd: (assignment: RoleAssignment) => void;
  onImport: (assignments: RoleAssignment[], fromUsername: string) => void;
  onClose: () => void;
};

/** The dialogs the roles page opens, loaded together as one chunk. */
export function RoleDialogs({
  userId,
  username,
  hasHomeFacility,
  draft,
  addType,
  importOpen,
  onAdd,
  onImport,
  onClose,
}: RoleDialogsProps) {
  return (
    <>
      <AddRoleDialog
        assigned={draft}
        hasHomeFacility={hasHomeFacility}
        onAdd={onAdd}
        onClose={onClose}
        type={addType}
        username={username}
      />
      <ImportRolesDialog
        draft={draft}
        onClose={onClose}
        onImport={onImport}
        open={importOpen}
        userId={userId}
        username={username}
      />
    </>
  );
}
