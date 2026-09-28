import { describe, expect, it } from 'vitest';
import type { Right, Role } from '@/features/reference-data/lib/types';
import {
  asksBeforeSaving,
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
    expect(EMPTY_ROLE_FORM.type).toBe('SUPERVISION');
    expect(messages({ ...EMPTY_ROLE_FORM, name: ' ' })).toEqual([
      ['name', 'roles.form.name-required'],
      ['description', 'roles.form.description-required'],
      ['rightIds', 'roles.form.rights-required'],
    ]);
  });

  it('rejects a name another role has, ignoring case and spaces around it', () => {
    expect(
      messages({
        ...EMPTY_ROLE_FORM,
        name: ' storeroom manager ',
        description: 'x',
        rightIds: ['r1'],
      }),
    ).toEqual([['name', 'roles.form.name-taken']]);
  });

  it('lets a role keep its own name', () => {
    expect(
      messages(
        { ...EMPTY_ROLE_FORM, name: 'Program Supervisor', description: 'x', rightIds: ['r1'] },
        'role1',
      ),
    ).toBeUndefined();
  });
});

describe('toRoleFormValues', () => {
  it("fills the form from a role, with its rights' ids", () => {
    expect(toRoleFormValues(supervisor)).toEqual({
      type: 'SUPERVISION',
      name: 'Program Supervisor',
      description: 'Approves requisitions',
      rightIds: ['r1', 'r2'],
    });
  });

  it('treats a missing description as empty', () => {
    expect(toRoleFormValues({ ...supervisor, description: null }).description).toBe('');
  });

  it('leaves out a right of another type, which the form cannot show or keep', () => {
    const admin: Role = {
      id: 'role3',
      name: 'System Administrator',
      rights: [{ id: 'a1', name: 'USERS_MANAGE', type: 'GENERAL_ADMIN' }, view],
    };
    expect(toRoleFormValues(admin)).toMatchObject({ type: 'GENERAL_ADMIN', rightIds: ['a1'] });
  });

  it('starts a role with no rights, and so no type, on the first type', () => {
    expect(toRoleFormValues({ ...supervisor, rights: [] })).toMatchObject({
      type: 'SUPERVISION',
      rightIds: [],
    });
  });
});

describe('toRoleBody', () => {
  it('sends the trimmed text and the chosen rights of the type', () => {
    expect(
      toRoleBody(
        { ...EMPTY_ROLE_FORM, name: ' Approver ', description: ' Approves ', rightIds: ['r2'] },
        [view, approve],
      ),
    ).toEqual({
      name: 'Approver',
      description: 'Approves',
      rights: [{ id: 'r2', name: 'REQUISITION_APPROVE', type: 'SUPERVISION' }],
    });
  });

  it('keeps the id when editing and drops rights not in the list', () => {
    expect(
      toRoleBody(
        { ...EMPTY_ROLE_FORM, name: 'A', description: 'B', rightIds: ['r1', 'gone'] },
        [view],
        'role1',
      ),
    ).toEqual({ id: 'role1', name: 'A', description: 'B', rights: [view] });
  });

  it('sends only the fields the API reads for a right', () => {
    const extra = { ...view, description: 'x', attachments: [] } as Right;
    expect(
      toRoleBody({ ...EMPTY_ROLE_FORM, name: 'A', description: 'B', rightIds: ['r1'] }, [extra])
        .rights,
    ).toEqual([view]);
  });
});

describe('asksBeforeSaving', () => {
  it('asks before changing a role that users hold', () => {
    expect(asksBeforeSaving(supervisor, 3)).toBe(true);
  });

  it('saves at once for a new role or one nobody holds', () => {
    expect(asksBeforeSaving(undefined, 0)).toBe(false);
    expect(asksBeforeSaving(supervisor, 0)).toBe(false);
  });
});
