// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  DEPARTMENTS, 
  getEmployees, 
  getDepartment, 
  upsertEmployee, 
  deleteEmployee, 
  updateEmployeePermissions,
  authenticateEmployee,
  hasPermission,
  loginAsEmployeeSession,
  exitEmployeeSession
} from '../../src/business/employeeService.js';
import { setCurrentUser } from '../../src/state/store.js';

describe('Employee and Departments Service', () => {
  beforeEach(() => {
    localStorage.clear();
    setCurrentUser({ uid: 'tenant-1', displayName: 'المدير العام (GERANT)', role: 'gerant', email: 'admin@progilic.dz' });
  });

  it('should define the 4 official PROGILIC departments matching the specification', () => {
    expect(DEPARTMENTS).toHaveLength(4);
    const ids = DEPARTMENTS.map(d => d.id);
    expect(ids).toContain('pre_vente');
    expect(ids).toContain('commercial');
    expect(ids).toContain('suivi');
    expect(ids).toContain('technique');

    const preVente = getDepartment('pre_vente');
    expect(preVente.titleAr).toBe('قسم ما قبل البيع');
    expect(preVente.titleFr).toBe('Service Pré-vente');

    const commercial = getDepartment('commercial');
    expect(commercial.titleAr).toBe('القسم التجاري');

    const suivi = getDepartment('suivi');
    expect(suivi.titleAr).toBe('قسم المتابعة');

    const tech = getDepartment('technique');
    expect(tech.titleAr).toBe('القسم التقني');
  });

  it('should seed default staff members across departments', () => {
    const staff = getEmployees();
    expect(staff.length).toBeGreaterThanOrEqual(1);
    
    // Check specific fields: Name, Position, Department, Supervisor, Tasks, Permissions
    const emp1 = staff[0];
    expect(emp1.fullName || emp1.name).toBeDefined();
    expect(emp1.position).toBeDefined();
    expect(emp1.department).toBeDefined();
    expect(emp1.supervisor).toBeDefined();
    expect(emp1.tasks).toBeDefined();
    expect(emp1.permissions).toBeDefined();
  });

  it('should allow creating and updating an employee with supervisor and tasks', () => {
    const created = upsertEmployee({
      fullName: 'أحمد بن عمار',
      username: 'ahmed.amar',
      department: 'commercial',
      position: 'مسؤول مبيعات أول',
      supervisor: 'صابر بلقايد (Gérant)',
      tasks: 'متابعة الصفقات الكبرى في وهران والجزائر العاصمة',
      password: 'mypassword123',
      status: 'نشط'
    });

    const found = created.find(e => e.username === 'ahmed.amar');
    expect(found).toBeDefined();
    expect(found.fullName).toBe('أحمد بن عمار');
    expect(found.position).toBe('مسؤول مبيعات أول');
    expect(found.supervisor).toBe('صابر بلقايد (Gérant)');

    // Update position
    upsertEmployee({
      id: found.id,
      fullName: 'أحمد بن عمار',
      username: 'ahmed.amar',
      department: 'commercial',
      position: 'رئيس القسم التجاري',
      supervisor: 'صابر بلقايد (Gérant)',
      tasks: 'إدارة الفريق التجاري بالكامل',
      status: 'نشط'
    });

    const updated = getEmployees().find(e => e.id === found.id);
    expect(updated.position).toBe('رئيس القسم التجاري');
  });

  it('should authenticate valid employee credentials and reject invalid ones', () => {
    upsertEmployee({
      id: 'test_emp_auth',
      fullName: 'سعيد بلخير',
      username: 'said.belkheir',
      password: 'securePass99',
      department: 'suivi',
      status: 'نشط'
    });

    // Valid authentication
    const emp = authenticateEmployee('said.belkheir', 'securePass99');
    expect(emp.fullName).toBe('سعيد بلخير');

    // Invalid password
    expect(() => authenticateEmployee('said.belkheir', 'wrongPassword')).toThrow();

    // Disabled account
    upsertEmployee({
      id: 'test_emp_auth',
      fullName: 'سعيد بلخير',
      username: 'said.belkheir',
      password: 'securePass99',
      department: 'suivi',
      status: 'معطل'
    });
    expect(() => authenticateEmployee('said.belkheir', 'securePass99')).toThrow(/معطل/);
  });

  it('should enforce role-based permissions correctly between Gérant and Staff', () => {
    // 1. Gérant has full permissions on everything
    setCurrentUser({
      uid: 'z1FY0kWqOOSe78cFv8rqak0mjV03',
      email: 'saberbelkaid8@gmail.com',
      isEmployee: false,
      role: 'gerant'
    });
    expect(hasPermission('canDeleteClients')).toBe(true);
    expect(hasPermission('canManageEmployees')).toBe(true);
    expect(hasPermission('canAddClients')).toBe(true);

    // 2. Employee with restricted permissions
    const staffSession = loginAsEmployeeSession({
      id: 'emp_demo_restricted',
      fullName: 'موظف تجريبي',
      username: 'emp.demo',
      department: 'technique',
      position: 'دعم فني',
      supervisor: 'صابر بلقايد',
      permissions: {
        canViewClients: true,
        canAddClients: false,
        canDeleteClients: false,
        canManageIssues: true
      }
    });

    expect(hasPermission('canViewClients')).toBe(true);
    expect(hasPermission('canManageIssues')).toBe(true);
    expect(hasPermission('canAddClients')).toBe(false);
    expect(hasPermission('canDeleteClients')).toBe(false);
    expect(hasPermission('canManageEmployees')).toBe(false);
  });
});
