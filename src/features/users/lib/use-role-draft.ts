import { useCallback, useMemo, useState } from 'react';
import {
  assignmentKey,
  countChanges,
  mergeAssignments,
  rebaseDraft,
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
  /** Adds another user's roles; returns how many were new and how many were already held. */
  const merge = useCallback(
    (incoming: RoleAssignment[]) => {
      const result = mergeAssignments(draft, incoming);
      setDraft(result.assignments);
      return result;
    },
    [draft],
  );
  /** After a save of `sent`, keeps any change made while it was on its way. */
  const commit = useCallback(
    (sent: RoleAssignment[], next: RoleAssignment[]) =>
      setDraft((current) => rebaseDraft(sent, next, current)),
    [],
  );

  return useMemo(
    () => ({ draft, changes, add, remove, merge, commit }),
    [draft, changes, add, remove, merge, commit],
  );
}
