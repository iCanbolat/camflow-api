/**
 * Role/permission matrix, ported verbatim from the iOS `Models/Permissions.swift`
 * (`OrgMember.Role.can(_:)`). The raw role 'member' is the iOS "standard" role.
 * This is the single source of truth on the backend; `PermissionsGuard` calls it.
 */
export type Role = 'owner' | 'admin' | 'manager' | 'member';

export enum Permission {
  ManageBilling = 'manageBilling',
  EditCompanyProfile = 'editCompanyProfile',
  DeleteOrganization = 'deleteOrganization',
  ManageTeam = 'manageTeam',
  ChangeRoles = 'changeRoles',
  ManageTaxonomy = 'manageTaxonomy',
  ManageTasks = 'manageTasks',
  CreateProject = 'createProject',
  DeleteProject = 'deleteProject',
}

const MANAGER_PERMISSIONS = new Set<Permission>([
  Permission.ManageTeam,
  Permission.ManageTaxonomy,
  Permission.ManageTasks,
  Permission.CreateProject,
  Permission.DeleteProject,
]);

export function can(role: Role, permission: Permission): boolean {
  switch (role) {
    case 'owner':
      return true;
    case 'admin':
      return permission !== Permission.DeleteOrganization;
    case 'manager':
      return MANAGER_PERMISSIONS.has(permission);
    case 'member':
      return permission === Permission.CreateProject;
  }
}

/** Roles assignable in pickers — never 'owner' (exactly one per org). */
export const ASSIGNABLE_ROLES: Role[] = ['admin', 'manager', 'member'];

export function roleDisplayName(role: Role): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'member':
      return 'Standard';
  }
}
