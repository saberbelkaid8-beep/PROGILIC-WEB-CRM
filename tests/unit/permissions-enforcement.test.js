import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S, setCurrentUser, setCurrentStaffUser, hasPermission, isGerant, setStaffUsers } from '../../src/state/store.js';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, createDefaultGerant } from '../../src/constants/index.js';

describe('Permissions Enforcement & Control System', () => {
  beforeEach(() => {
    localStorage.clear();
    setCurrentUser(null);
    setCurrentStaffUser(null);
    S.staffUsers = [];
    S.showStaffPortal = false;
  });

  it('ALL_PERMISSIONS and PERMISSION_GROUPS should define all granular permissions', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(70);
    
    // Check that every single permission in the 9 groups belongs to ALL_PERMISSIONS
    let groupPermCount = 0;
    PERMISSION_GROUPS.forEach(group => {
      expect(group.permissions.length).toBeGreaterThan(0);
      group.permissions.forEach(p => {
        expect(ALL_PERMISSIONS).toContain(p.key);
        expect(p.label).toBeTruthy();
        expect(p.desc).toBeTruthy();
        groupPermCount++;
      });
    });
    expect(groupPermCount).toBe(ALL_PERMISSIONS.length);
  });

  it('President / Gérant should have all granular permissions automatically enabled', () => {
    const gerant = createDefaultGerant('tenant-test', 'الرئيس (Gérant)');
    setCurrentUser({ uid: 'tenant-test', email: 'boss@progilic.dz', role: 'gerant', isEmployee: false });
    setCurrentStaffUser(gerant);

    expect(isGerant()).toBe(true);
    ALL_PERMISSIONS.forEach(perm => {
      expect(hasPermission(perm)).toBe(true);
    });
  });

  it('Staff user permissions should be dynamically granted and revoked ("كي تنحي وكي تدير تخدم")', () => {
    const staffUser = {
      id: 'emp-101',
      name: 'كريم تجاري',
      username: 'karim',
      position: 'مسؤول مبيعات',
      department: 'القسم التجاري',
      role: 'employee',
      permissions: {
        'clients.view': true,
        'clients.create': true,
        'clients.export': false, // Explicitly revoked
        'programs.delete': false  // Explicitly revoked
      }
    };

    setCurrentUser({ uid: 'tenant-test', email: 'boss@progilic.dz', role: 'gerant', isEmployee: false });
    setCurrentStaffUser(staffUser);

    expect(isGerant()).toBe(false);
    
    // When granted:
    expect(hasPermission('clients.view')).toBe(true);
    expect(hasPermission('clients.create')).toBe(true);
    
    // When revoked:
    expect(hasPermission('clients.export')).toBe(false);
    expect(hasPermission('programs.delete')).toBe(false);
    expect(hasPermission('clients.delete')).toBe(false);
    expect(hasPermission('backup.create')).toBe(false);

    // Dynamic grant: President grants clients.export and backup.create
    staffUser.permissions['clients.export'] = true;
    staffUser.permissions['backup.create'] = true;
    setCurrentStaffUser({ ...staffUser });

    expect(hasPermission('clients.export')).toBe(true);
    expect(hasPermission('backup.create')).toBe(true);

    // Dynamic revoke: President revokes clients.create
    staffUser.permissions['clients.create'] = false;
    setCurrentStaffUser({ ...staffUser });

    expect(hasPermission('clients.create')).toBe(false);
  });

  it('should grant and revoke global timeline access independently', async () => {
    const { setView } = await import('../../src/business/actions/uiActions.js');
    const employee = {
      id: 'timeline-employee',
      name: 'موظف',
      role: 'employee',
      permissions: { 'timeline.view': false }
    };
    setCurrentUser({ uid: 'tenant-test', role: 'gerant', isEmployee: false });
    setCurrentStaffUser(employee);
    S.view = 'list';

    setView('global-timeline');
    expect(S.view).toBe('list');

    employee.permissions['timeline.view'] = true;
    setCurrentStaffUser({ ...employee, permissions: { ...employee.permissions } });
    expect(hasPermission('timeline.view')).toBe(true);
    setView('global-timeline');
    expect(S.view).toBe('global-timeline');

    employee.permissions['timeline.view'] = false;
    setCurrentStaffUser({ ...employee, permissions: { ...employee.permissions } });
    expect(hasPermission('timeline.view')).toBe(false);
    setView('global-timeline');
    expect(S.view).toBe('global-timeline');
  });

  it('grantStaffGroupPermissions should grant and revoke entire category batches', async () => {
    await import('../../src/business/actions/staffActions.js');

    const gerant = createDefaultGerant('tenant-test', 'الرئيس');
    setCurrentUser({ uid: 'tenant-test', email: 'boss@progilic.dz', role: 'gerant', isEmployee: false });
    setCurrentStaffUser(gerant);

    const employee = {
      id: 'emp-tech-1',
      name: 'فني الصيانة',
      role: 'employee',
      permissions: {}
    };

    setStaffUsers([gerant, employee], 'tenant-test');

    // Grant all issues permissions (group: 'issues')
    await window.grantStaffGroupPermissions('emp-tech-1', 'issues', true);
    
    const updatedStaff = S.staffUsers.find(s => s.id === 'emp-tech-1');
    expect(updatedStaff.permissions['issues.view']).toBe(true);
    expect(updatedStaff.permissions['issues.create']).toBe(true);
    expect(updatedStaff.permissions['issues.resolve']).toBe(true);
    expect(updatedStaff.permissions['issues.delete']).toBe(true);
    // Unrelated groups should not be granted
    expect(updatedStaff.permissions['backup.create']).toBeFalsy();

    // Revoke all issues permissions
    await window.grantStaffGroupPermissions('emp-tech-1', 'issues', false);
    const revokedStaff = S.staffUsers.find(s => s.id === 'emp-tech-1');
    expect(revokedStaff.permissions['issues.view']).toBeFalsy();
    expect(revokedStaff.permissions['issues.create']).toBeFalsy();
    expect(revokedStaff.permissions['issues.resolve']).toBeFalsy();
  });

  it('openModal should block unauthorized modal popups when permission is missing', async () => {
    const { openModal } = await import('../../src/business/actions/uiActions.js');

    const restrictedStaff = {
      id: 'emp-restricted',
      name: 'موظف مقيد',
      role: 'employee',
      permissions: {
        'clients.create': false,
        'programs.create': false,
        'issues.create': true // only allowed to report issues
      }
    };

    setCurrentUser({ uid: 'tenant-test', email: 'boss@progilic.dz', role: 'gerant', isEmployee: false });
    setCurrentStaffUser(restrictedStaff);

    // Try to open addClient modal without permission -> blocked!
    S.modal = null;
    openModal('addClient');
    expect(S.modal).toBeNull();

    // Try to open addProgram modal without permission -> blocked!
    S.modal = null;
    openModal('addProgram');
    expect(S.modal).toBeNull();

    // Try to open addIssue modal WITH permission -> allowed!
    S.modal = null;
    openModal('addIssue');
    expect(S.modal).toBe('addIssue');
  });
});
