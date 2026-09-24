import { useCallback, useMemo, useState } from 'react';
import {
  assignmentKey,
  countChanges,
  mergeAssignments,
  toSavedAssignment,
} from '@/features/users/lib/role-assignments';
import type { RoleAssignment } from '@/features/users/lib/types';

/** The roles being edited, kept apart from the saved ones until they are saved. */
export function useRoleDraft(saved: RoleAssignment[]) {
  const [draft, setDraft] = useState(saved);
  const changes = useMemo(() => countChanges(saved, draft), [saved, draft]);

  const add = useCallback(
    (assignment: RoleAssignment) =>
      setDraft((current) => mergeAssignments(current, [assignment]).assignments),
    [],
  );
  const remove = useCallback((assignment: RoleAssignment) => {
    const key = assignmentKey(assignment);
    setDraft((current) => current.filter((item) => assignmentKey(item) !== key));
  }, []);

  return {
    draft,
    changes,
    add,
    remove,
    /** Adds another user's roles; returns how many were new and how many were already held. */
    merge: (incoming: RoleAssignment[]) => {
      const result = mergeAssignments(draft, incoming);
      setDraft(result.assignments);
      return result;
    },
    /** Back to the saved roles, or to `next` once a save has replaced them. */
    reset: (next: RoleAssignment[] = saved) => setDraft(next.map(toSavedAssignment)),
  };
}
