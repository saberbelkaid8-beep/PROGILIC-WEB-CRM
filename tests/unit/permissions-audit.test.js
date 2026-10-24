// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ALL_PERMISSIONS } from '../../src/constants/index.js';
import { 
  PERMISSION_DEFINITIONS, 
  getEmployees, 
  upsertEmployee, 
  deleteEmployee,
  deleteEmployeeWithPassword,
  verifyAdminPassword,
  getGerantAccount,
  loginAsEmployeeSession,
  exitEmployeeSession,
  isUserGerant
} from '../../src/business/employeeService.js';
import { setCurrentUser, hasPermission, setStaffUsers, S } from '../../src/state/store.js';
import { hashPassword } from '../../src/utils/crypto.js';

describe('Permissions & Security Access Control Audit (60+ Permissions)', () => {
  const TEST_TENANT = 'tenant_audit_test';

  beforeEach(() => {
    localStorage.clear();
    setStaffUsers([], TEST_TENANT);
    setCurrentUser({
      uid: TEST_TENANT,
      email: 'admin@progilic.dz',
      displayName: 'المدير العام (GERANT)',
      role: 'gerant',
      isEmployee: false
    });
  });

  it('should define and export 60+ distinct permissions in ALL_PERMISSIONS', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(60);
    // Specifically test presence of critical administrative & user operations
    expect(ALL_PERMISSIONS).toContain('users.view');
    expect(ALL_PERMISSIONS).toContain('users.create');
    expect(ALL_PERMISSIONS).toContain('users.edit');
    expect(ALL_PERMISSIONS).toContain('users.disable');
    expect(ALL_PERMISSIONS).toContain('users.delete');

    expect(ALL_PERMISSIONS).toContain('clients.view');
    expect(ALL_PERMISSIONS).toContain('clients.create');
    expect(ALL_PERMISSIONS).toContain('clients.edit');
    expect(ALL_PERMISSIONS).toContain('clients.delete');

    expect(ALL_PERMISSIONS).toContain('backup.view');
    expect(ALL_PERMISSIONS).toContain('backup.create');
    expect(ALL_PERMISSIONS).toContain('backup.restore');
    expect(ALL_PERMISSIONS).toContain('backup.delete');

    expect(ALL_PERMISSIONS).toContain('permissions.view');
    expect(ALL_PERMISSIONS).toContain('permissions.assign');
    expect(ALL_PERMISSIONS).toContain('permissions.revoke');
  });

  it('should define rich metadata in PERMISSION_DEFINITIONS for all permissions', () => {
    expect(PERMISSION_DEFINITIONS.length).toBeGreaterThanOrEqual(60);
    
    // Every permission definition must have key, label, group, and desc
    PERMISSION_DEFINITIONS.forEach(def => {
      expect(def.key).toBeDefined();
      expect(def.label).toBeDefined();
      expect(def.group).toBeDefined();
      expect(def.desc).toBeDefined();
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.group.length).toBeGreaterThan(0);
    });

    const keys = PERMISSION_DEFINITIONS.map(d => d.key);
    expect(keys).toContain('users.delete');
    expect(keys).toContain('clients.delete');
    expect(keys).toContain('backup.delete');
  });

  it('should grant all 60+ permissions to Gérant by default', () => {
    // Current user is Gérant
    expect(isUserGerant()).toBe(true);
    
    ALL_PERMISSIONS.forEach(perm => {
      expect(hasPermission(perm)).toBe(true);
    });

    expect(hasPermission('canDeleteClients')).toBe(true);
    expect(hasPermission('canDeleteEmployees')).toBe(true);
    expect(hasPermission('canManageBackups')).toBe(true);
  });

  it('should strictly enforce permissions for Employee sessions and deny unassigned ones', () => {
    loginAsEmployeeSession({
      id: 'emp_auditor',
      fullName: 'موظف مبيعات',
      username: 'sales.audit',
      department: 'commercial',
      position: 'مسؤول مبيعات',
      permissions: {
        'clients.view': true,
        'clients.create': true,
        'clients.edit': false,
        'clients.delete': false,
        'users.delete': false
      }
    });

    expect(isUserGerant()).toBe(false);

    // Explicitly granted
    expect(hasPermission('clients.view')).toBe(true);
    expect(hasPermission('clients.create')).toBe(true);
    expect(hasPermission('canViewClients')).toBe(true);
    expect(hasPermission('canAddClients')).toBe(true);

    // Explicitly denied or ungranted
    expect(hasPermission('clients.delete')).toBe(false);
    expect(hasPermission('canDeleteClients')).toBe(false);
    expect(hasPermission('users.delete')).toBe(false);
    expect(hasPermission('canDeleteEmployees')).toBe(false);
    expect(hasPermission('backup.delete')).toBe(false);
    expect(hasPermission('permissions.assign')).toBe(false);
  });

  it('should support bidirectional mapping between legacy camelCase and dot notation', () => {
    loginAsEmployeeSession({
      id: 'emp_mapper',
      fullName: 'موظف دعم',
      username: 'tech.support',
      department: 'technique',
      permissions: {
        canViewClients: true,
        canAddClients: false,
        canDeleteClients: false,
        canManageIssues: true,
        canDeleteEmployees: false
      }
    });

    // camelCase in permissions object checked via dot notation
    expect(hasPermission('clients.view')).toBe(true);
    expect(hasPermission('issues.view')).toBe(true);
    expect(hasPermission('clients.create')).toBe(false);
    expect(hasPermission('clients.delete')).toBe(false);
    expect(hasPermission('users.delete')).toBe(false);
  });
});

describe('User Deletion Admin Password Verification Audit', () => {
  const TEST_TENANT = 'tenant_delete_audit';
  const ADMIN_PASSWORD = 'GerantSecureMasterPassword2026!';

  beforeEach(() => {
    localStorage.clear();
    setStaffUsers([], TEST_TENANT);
    setCurrentUser({
      uid: TEST_TENANT,
      email: 'admin@progilic.dz',
      displayName: 'المدير العام (GERANT)',
      role: 'gerant',
      isEmployee: false
    });

    // Seed Gérant with known password hash
    const { hash, salt } = hashPassword(ADMIN_PASSWORD);
    upsertEmployee({
      id: 'gerant',
      name: 'المدير العام (GERANT)',
      fullName: 'المدير العام (GERANT)',
      username: 'gerant',
      role: 'GERANT',
      passwordHash: hash,
      passwordSalt: salt
    });
  });

  it('should verify the correct admin password successfully', () => {
    const res = verifyAdminPassword(ADMIN_PASSWORD);
    expect(res.success).toBe(true);
  });

  it('should reject incorrect admin password attempts', () => {
    const res = verifyAdminPassword('WrongPassword123');
    expect(res.success).toBe(false);
    expect(res.message).toContain('غير صحيحة');
  });

  it('should reject empty or whitespace admin password attempts', () => {
    const res = verifyAdminPassword('');
    expect(res.success).toBe(false);
    expect(res.message).toContain('يرجى إدخال كلمة مرور');
  });

  it('should reject user deletion if admin password is not provided or incorrect', () => {
    // Create target employee to delete
    upsertEmployee({
      id: 'emp_to_be_deleted',
      fullName: 'موظف سيتم حذفه',
      username: 'emp.del',
      department: 'suivi',
      status: 'نشط'
    });

    expect(getEmployees().some(e => e.id === 'emp_to_be_deleted')).toBe(true);

    // 1. Attempt with incorrect password
    const failRes = deleteEmployeeWithPassword('emp_to_be_deleted', 'WrongAdminPassword');
    expect(failRes.success).toBe(false);
    // Employee must still exist in database
    expect(getEmployees().some(e => e.id === 'emp_to_be_deleted')).toBe(true);

    // 2. Attempt with empty password
    const emptyRes = deleteEmployeeWithPassword('emp_to_be_deleted', '');
    expect(emptyRes.success).toBe(false);
    expect(getEmployees().some(e => e.id === 'emp_to_be_deleted')).toBe(true);
  });

  it('should successfully delete user when correct admin password is verified', () => {
    upsertEmployee({
      id: 'emp_valid_deletion',
      fullName: 'موظف محذوف بنجاح',
      username: 'emp.delete.ok',
      department: 'commercial',
      status: 'نشط'
    });

    expect(getEmployees().some(e => e.id === 'emp_valid_deletion')).toBe(true);

    const successRes = deleteEmployeeWithPassword('emp_valid_deletion', ADMIN_PASSWORD);
    expect(successRes.success).toBe(true);
    expect(successRes.message).toContain('تم التحقق');

    // Employee must be removed from the database
    expect(getEmployees().some(e => e.id === 'emp_valid_deletion')).toBe(false);
  });

  it('should prevent deleting the root Gérant account even with valid admin password', () => {
    const res = deleteEmployeeWithPassword('gerant', ADMIN_PASSWORD);
    expect(res.success).toBe(false);
    expect(res.message).toContain('لا يمكن حذف حساب المسؤول العام');
    expect(getEmployees().some(e => e.id === 'gerant')).toBe(true);
  });

  it('should block non-Gérant employees from verifying admin password or deleting users', () => {
    loginAsEmployeeSession({
      id: 'emp_intruder',
      fullName: 'موظف عادي',
      username: 'normal.user',
      department: 'technique',
      permissions: {
        'users.delete': false
      }
    });

    expect(isUserGerant()).toBe(false);

    const res = deleteEmployeeWithPassword('any_emp_id', ADMIN_PASSWORD);
    expect(res.success).toBe(false);
    expect(res.message).toContain('فقط المسؤول العام');
  });
});
