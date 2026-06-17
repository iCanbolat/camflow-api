import {
  ASSIGNABLE_ROLES,
  can,
  Permission,
  roleDisplayName,
  Role,
} from './permissions';

describe('permissions matrix', () => {
  it('owner can do everything', () => {
    for (const p of Object.values(Permission)) {
      expect(can('owner', p)).toBe(true);
    }
  });

  it('admin can do everything except delete the organization', () => {
    expect(can('admin', Permission.DeleteOrganization)).toBe(false);
    expect(can('admin', Permission.ManageBilling)).toBe(true);
    expect(can('admin', Permission.ChangeRoles)).toBe(true);
  });

  it('manager handles team/taxonomy/tasks/projects but not billing/roles', () => {
    expect(can('manager', Permission.ManageTeam)).toBe(true);
    expect(can('manager', Permission.ManageTasks)).toBe(true);
    expect(can('manager', Permission.DeleteProject)).toBe(true);
    expect(can('manager', Permission.ManageBilling)).toBe(false);
    expect(can('manager', Permission.ChangeRoles)).toBe(false);
    expect(can('manager', Permission.DeleteOrganization)).toBe(false);
  });

  it('standard (member) can only create projects', () => {
    expect(can('member', Permission.CreateProject)).toBe(true);
    expect(can('member', Permission.ManageTasks)).toBe(false);
    expect(can('member', Permission.ManageTeam)).toBe(false);
    expect(can('member', Permission.DeleteProject)).toBe(false);
  });

  it('owner is never assignable; member maps to "Standard"', () => {
    expect(ASSIGNABLE_ROLES).not.toContain<Role>('owner');
    expect(roleDisplayName('member')).toBe('Standard');
    expect(roleDisplayName('owner')).toBe('Owner');
  });
});
