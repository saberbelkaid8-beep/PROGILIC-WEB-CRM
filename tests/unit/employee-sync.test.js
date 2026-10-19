// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  sanitizeEmployeeForFirestore
} from '../../src/firebase/service.js';
import { 
  upsertEmployee, 
  deleteEmployee, 
  getEmployees 
} from '../../src/business/employeeService.js';
import { setCurrentUser, S, setStaffUsers } from '../../src/state/store.js';

describe('Employee Multi-Device Synchronization', () => {
  const TEST_UID = 'user-test-sync-123';

  beforeEach(() => {
    localStorage.clear();
    setCurrentUser({ uid: TEST_UID, email: 'test@progilic.dz', displayName: 'صابر بلقايد' });
    setStaffUsers([], TEST_UID);
  });

  it('sanitizeEmployeeForFirestore should strip unauthorized fields and normalize properties', () => {
    const rawEmp = {
      id: 'emp_101',
      fullName: 'محمد علي',
      name: 'محمد علي',
      username: 'mohamed',
      department: 'commercial',
      status: 'نشط',
      password: 'plaintextSecret123',
      pwd: 'oldPwd',
      badgeClass: 'badge-commercial',
      color: '#10b981',
      _subcollectionsLoaded: true,
      randomGarbage: 'attack'
    };

    const sanitized = sanitizeEmployeeForFirestore(rawEmp, TEST_UID);
    expect(sanitized.id).toBe('emp_101');
    expect(sanitized.tenantId).toBe(TEST_UID);
    expect(sanitized.fullName).toBe('محمد علي');
    expect(sanitized.department).toBe('commercial');
    expect(sanitized.status).toBe('نشط');
    expect(sanitized.password).toBeUndefined();
    expect(sanitized.pwd).toBeUndefined();
    expect(sanitized.randomGarbage).toBeUndefined();
    expect(sanitized._subcollectionsLoaded).toBeUndefined();
  });

  it('upsertEmployee should set tenantId, status, and persist to state store and local storage', () => {
    const employees = upsertEmployee({
      fullName: 'جمال قاسم',
      username: 'djamel.k',
      department: 'technique',
      position: 'مهندس دعم فني',
      password: 'password123',
      status: 'نشط'
    });

    expect(employees.length).toBeGreaterThan(0);
    const added = employees.find(e => e.username === 'djamel.k');
    expect(added).toBeDefined();
    expect(added.tenantId).toBe(TEST_UID);
    expect(added.fullName).toBe('جمال قاسم');
    expect(added.department).toBe('technique');
    expect(added.status).toBe('نشط');

    // Verify stored in localStorage for offline hydration
    const rawCache = localStorage.getItem(`crm_staff_users_${TEST_UID}`);
    expect(rawCache).toBeDefined();
    const parsedCache = JSON.parse(rawCache);
    expect(parsedCache.some(e => e.username === 'djamel.k')).toBe(true);

    // Verify in reactive store
    expect(S.staffUsers.some(e => e.username === 'djamel.k')).toBe(true);
  });

  it('deleteEmployee should remove employee and update store', () => {
    const created = upsertEmployee({
      id: 'emp_to_delete',
      fullName: 'موظف مؤقت',
      username: 'temp.user',
      department: 'pre_vente',
      status: 'نشط'
    });
    expect(created.some(e => e.id === 'emp_to_delete')).toBe(true);

    const remaining = deleteEmployee('emp_to_delete');
    expect(remaining.some(e => e.id === 'emp_to_delete')).toBe(false);
    expect(S.staffUsers.some(e => e.id === 'emp_to_delete')).toBe(false);
  });

  it('switching portal should activate when logoutStaff is called and deactivate on loginStaff or closeStaffPortal', async () => {
    await import('../../src/business/actions/staffActions.js');
    await import('../../src/presentation/render-staff.js');

    // Create a staff user
    const staffList = [
      { id: 'staff_1', name: 'أحمد', username: 'ahmed', position: 'تجاري', department: 'commercial', password: '123', status: 'نشط' }
    ];
    setStaffUsers(staffList, TEST_UID);

    // Call logoutStaff to switch user
    window.logoutStaff();
    expect(S.showStaffPortal).toBe(true);

    // Close portal returns back to gerant view
    window.closeStaffPortal();
    expect(S.showStaffPortal).toBe(false);

    // Open portal again
    window.logoutStaff();
    expect(S.showStaffPortal).toBe(true);

    // Login as staff member
    window.loginStaff('staff_1', '123');
    expect(S.showStaffPortal).toBe(false);
  });
});
