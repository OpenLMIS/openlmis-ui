import { describe, expect, it } from 'vitest';
import type { Right, Role } from '@/features/reference-data/lib/types';
import {
  EMPTY_ROLE_FORM,
  roleFormSchema,
  toRoleBody,
  toRoleFormValues,
} from '@/features/roles/lib/role-form';

const view: Right = { id: 'r1', name: 'REQUISITION_VIEW', type: 'SUPERVISION' };
const approve: Right = { id: 'r2', name: 'REQUISITION_APPROVE', type: 'SUPERVISION' };

const supervisor: Role = {
  id: 'role1',
  name: 'Program Supervisor',
  description: 'Approves requisitions',
  count: 3,
  rights: [view, approve],
};

const others: Role[] = [supervisor, { id: 'role2', name: 'Storeroom Manager', rights: [view] }];

const messages = (values: typeof EMPTY_ROLE_FORM, editingId?: string) =>
  roleFormSchema(others, editingId)
    .safeParse(values)
    .error?.issues.map((issue) => [issue.path[0], issue.message]);

describe('roleFormSchema', () => {
  it('requires a name, a description and at least one right', () => {
    expect(messages({ ...EMPTY_ROLE_FORM, name: ' ' })).toEqual([
      ['name', 'roles.form.name-required'],
      ['description', 'roles.form.description-required'],
      ['rightIds', 'roles.form.rights-required'],
    ]);
  });

  it('rejects a name another role has, ignoring case and spaces around it', () => {
    expect(messages({ name: ' storeroom manager ', description: 'x', rightIds: ['r1'] })).toEqual([
      ['name', 'roles.form.name-taken'],
    ]);
  });

  it('lets a role keep its own name', () => {
    expect(
      messages({ name: 'Program Supervisor', description: 'x', rightIds: ['r1'] }, 'role1'),
    ).toBeUndefined();
  });
});

describe('toRoleFormValues', () => {
  it("fills the form from a role, with its rights' ids", () => {
    expect(toRoleFormValues(supervisor)).toEqual({
      name: 'Program Supervisor',
      description: 'Approves requisitions',
      rightIds: ['r1', 'r2'],
    });
  });

  it('treats a missing description as empty', () => {
    expect(toRoleFormValues({ ...supervisor, description: null }).description).toBe('');
  });
});

describe('toRoleBody', () => {
  it('sends the trimmed text and the chosen rights of the type', () => {
    expect(
      toRoleBody({ name: ' Approver ', description: ' Approves ', rightIds: ['r2'] }, [
        view,
        approve,
      ]),
    ).toEqual({
      name: 'Approver',
      description: 'Approves',
      rights: [{ id: 'r2', name: 'REQUISITION_APPROVE', type: 'SUPERVISION' }],
    });
  });

  it('keeps the id when editing and drops rights not in the list', () => {
    expect(
      toRoleBody({ name: 'A', description: 'B', rightIds: ['r1', 'gone'] }, [view], 'role1'),
    ).toEqual({ id: 'role1', name: 'A', description: 'B', rights: [view] });
  });

  it('sends only the fields the API reads for a right', () => {
    const extra = { ...view, description: 'x', attachments: [] } as Right;
    expect(toRoleBody({ name: 'A', description: 'B', rightIds: ['r1'] }, [extra]).rights).toEqual([
      view,
    ]);
  });
});
