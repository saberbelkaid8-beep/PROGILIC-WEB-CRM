import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const cloudMocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
const activityStorageMocks = vi.hoisted(() => ({
  items: [],
  get: vi.fn(),
  add: vi.fn(),
  delete: vi.fn()
}));
vi.mock('../../src/firebase/service.js', () => ({
  getTenantActivities: cloudMocks.get,
  saveTenantActivity: cloudMocks.save
}));
vi.mock('../../src/business/idbStorage.js', () => ({
  getActivities: activityStorageMocks.get,
  addActivity: activityStorageMocks.add,
  deleteActivity: activityStorageMocks.delete
}));
import { buildTimelineReport, getFilteredTimelineList } from '../../src/business/actions/timelineActions.js';
import { ActivityType } from '../../src/business/timelineService.js';
import { loadGlobalActivities, logActivity, syncCrmServicesToTimeline, syncPendingActivities, retryFailedTimelineActivities } from '../../src/business/timelineService.js';
import { S, setCurrentStaffUser, setCurrentUser, updateState, setClients } from '../../src/state/store.js';

const activities = [
  { id: 1, timestamp: '2026-10-22T09:00:00.000Z', type: ActivityType.CLIENT_CREATED, userId: 'u1', userName: 'سارة', clientName: 'حمزة بلقايد', category: 'clients' },
  { id: 2, timestamp: '2026-10-23T10:00:00.000Z', type: ActivityType.ISSUE_ADDED, userId: 'u2', userName: 'كريم', clientName: 'زبون آخر', category: 'issues', description: 'مشكلة شبكة' },
  { id: 3, timestamp: '2026-10-23T15:00:00.000Z', type: ActivityType.ISSUE_RESOLVED, userId: 'u1', userName: 'سارة', clientName: 'زبون آخر', category: 'issues', description: 'إغلاق مشكلة شبكة' },
  { id: 4, timestamp: '2026-10-24T00:30:00.000Z', type: ActivityType.CLIENT_DELETED, userId: 'u1', userName: 'سارة', clientName: 'زبون آخر' }
];

describe('Global timeline filters and report', () => {
  beforeEach(() => {
    activityStorageMocks.items = [];
    activityStorageMocks.get.mockImplementation(async () => [...activityStorageMocks.items]);
    activityStorageMocks.add.mockImplementation(async (_uid, activity) => {
      activityStorageMocks.items = activityStorageMocks.items.filter(item => item.id !== activity.id);
      activityStorageMocks.items.push(activity);
      return activity.id;
    });
    activityStorageMocks.delete.mockImplementation(async (_uid, id) => {
      activityStorageMocks.items = activityStorageMocks.items.filter(activity => activity.id !== id);
    });
    updateState({
      globalActivities: [], timelineUserFilter: 'all', timelineDatePreset: 'all',
      timelineDateFrom: '', timelineDateTo: '', timelineCategoryFilter: 'all', timelineSearch: ''
    });
  });

  afterEach(() => {
    setCurrentStaffUser(null);
    setCurrentUser(null);
    updateState({
      globalActivities: [], timelineUserFilter: 'all', timelineDatePreset: 'all',
      timelineDateFrom: '', timelineDateTo: '', timelineCategoryFilter: 'all', timelineSearch: ''
    });
    vi.useRealTimers();
    cloudMocks.get.mockReset().mockResolvedValue([]);
    cloudMocks.save.mockReset().mockImplementation(async (_uid, activity) => activity.id);
    localStorage.removeItem('progilic_crm_pending_activities_timeline-tenant');
    localStorage.removeItem('progilic_crm_activity_migration_timeline-tenant');
  });

  it('combines user, category and every-term search filters', () => {
    updateState({
      globalActivities: activities,
      timelineUserFilter: 'u1',
      timelineCategoryFilter: 'issues',
      timelineSearch: 'زبون شبكة'
    });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual([3]);

    updateState({ timelineSearch: 'زبون مفقود' });
    expect(getFilteredTimelineList()).toEqual([]);
  });

  it('filters the user and category fields independently', () => {
    updateState({ globalActivities: activities, timelineUserFilter: 'سارة' });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual([4, 3, 1]);

    updateState({ timelineUserFilter: 'all', timelineCategoryFilter: 'issues' });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual([3, 2]);
  });

  it('includes the complete local end date in a custom date range', () => {
    updateState({
      globalActivities: activities,
      timelineDatePreset: 'custom',
      timelineDateFrom: '2026-10-23',
      timelineDateTo: '2026-10-23'
    });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual([3, 2]);
  });

  it('filters today, yesterday, week and month presets against local dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    const localTimestamp = (year, month, day, hour = 12) => new Date(year, month, day, hour).toISOString();
    updateState({
      globalActivities: [
        { id: 'today', timestamp: localTimestamp(2026, 9, 24) },
        { id: 'yesterday', timestamp: localTimestamp(2026, 9, 23) },
        { id: 'week', timestamp: localTimestamp(2026, 9, 20) },
        { id: 'month', timestamp: localTimestamp(2026, 9, 1) },
        { id: 'old', timestamp: localTimestamp(2026, 7, 31) },
        { id: 'future', timestamp: localTimestamp(2026, 9, 25) }
      ]
    });

    updateState({ timelineDatePreset: 'today' });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual(['today']);
    updateState({ timelineDatePreset: 'yesterday' });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual(['yesterday']);
    updateState({ timelineDatePreset: 'week' });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual(['today', 'yesterday', 'week']);
    updateState({ timelineDatePreset: 'month' });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual(['today', 'yesterday', 'week', 'month']);
  });

  it('rejects an invalid or reversed custom date range', () => {
    updateState({
      globalActivities: activities,
      timelineDatePreset: 'custom',
      timelineDateFrom: '2026-10-24',
      timelineDateTo: '2026-10-23'
    });
    expect(getFilteredTimelineList()).toEqual([]);
  });

  it('builds the management report from the filtered activity set', () => {
    const report = buildTimelineReport(activities);

    expect(report.total).toBe(4);
    expect(report.users[0]).toMatchObject({ id: 'u1', name: 'سارة', count: 3 });
    expect(report.categories).toEqual(expect.arrayContaining([
      { category: 'clients', count: 2 },
      { category: 'issues', count: 2 }
    ]));
    expect(report.clientsCreated).toBe(1);
    expect(report.clientsDeleted).toBe(1);
    expect(report.issuesCreated).toBe(1);
    expect(report.issuesResolved).toBe(1);
  });

  it('displays a blocked state when global timeline permission is revoked', async () => {
    const { renderGlobalTimeline } = await import('../../src/presentation/render-timeline-view.js');
    setCurrentUser({ uid: 'timeline-tenant', role: 'gerant', isEmployee: false });
    setCurrentStaffUser({ id: 'restricted', role: 'employee', permissions: { 'timeline.view': false } });

    expect(renderGlobalTimeline()).toContain('ليس لديك صلاحية عرض المخطط الزمني');
  });

  it('saves validated activity to the shared tenant log and loads shared records', async () => {
    setCurrentUser({ uid: 'timeline-tenant', role: 'gerant', email: 'owner@example.test' });
    setCurrentStaffUser({ id: 'manager', role: 'GERANT', permissions: { 'timeline.view': true, 'clients.view_timeline': true } });
    const activityId = await logActivity(null, ActivityType.CLIENT_CREATED, 'إضافة عميل', 'تمت إضافة العميل.');
    expect(activityId).toBe(S.globalActivities[0].id);
    expect(cloudMocks.save).toHaveBeenCalledWith(
      'timeline-tenant',
      expect.objectContaining({ type: ActivityType.CLIENT_CREATED, actorUid: 'timeline-tenant' })
    );

    cloudMocks.get.mockResolvedValue([{ id: 'remote-1', type: ActivityType.ISSUE_ADDED, timestamp: '2026-10-24T12:00:00.000Z' }]);
    await loadGlobalActivities();
    expect(S.globalActivities.map(activity => activity.id)).toContain('remote-1');
    expect(S.timelineCloudStatus).toBe('synced');
    expect(localStorage.getItem('progilic_crm_activity_migration_timeline-tenant')).toBe('complete');
  });

  it('durably queues a Timeline event after a cloud write failure and retries it once online', async () => {
    setCurrentUser({ uid: 'timeline-tenant', role: 'gerant' });
    cloudMocks.save.mockRejectedValueOnce(new Error('network unavailable'));

    const savedId = await logActivity(
      401,
      ActivityType.ISSUE_ADDED,
      'تسجيل تذكرة عطل تقني',
      'تم تسجيل تذكرة لطابعة الفواتير'
    );

    expect(savedId).toBeTruthy();
    expect(activityStorageMocks.items).toHaveLength(1);
    expect(S.timelineCloudStatus).toBe('pending');

    cloudMocks.save.mockImplementationOnce(async (_uid, activity) => activity.id);
    await expect(syncPendingActivities('timeline-tenant')).resolves.toBe(true);

    expect(activityStorageMocks.items).toHaveLength(0);
    expect(S.timelineCloudStatus).toBe('synced');
  });

  it('retains permanent Timeline failures for explicit review and retry', async () => {
    setCurrentUser({ uid: 'timeline-tenant', role: 'gerant' });
    cloudMocks.save.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { code: 'permission-denied' })
    );

    await logActivity(401, ActivityType.ISSUE_ADDED, 'تذكرة', 'حدث');

    expect(activityStorageMocks.items[0]).toMatchObject({
      syncState: 'requires-attention',
      attempts: 1,
      errorCode: 'permission-denied'
    });
    expect(S.timelineCloudStatus).toBe('requires-attention');

    cloudMocks.save.mockImplementationOnce(async (_uid, activity) => activity.id);
    await expect(retryFailedTimelineActivities('timeline-tenant')).resolves.toBe(true);

    expect(activityStorageMocks.items).toHaveLength(0);
    expect(S.timelineCloudStatus).toBe('synced');
  });

  it('filters day_before_yesterday preset correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    const localTimestamp = (year, month, day, hour = 12) => new Date(year, month, day, hour).toISOString();
    updateState({
      globalActivities: [
        { id: 'today', timestamp: localTimestamp(2026, 9, 25) },
        { id: 'yesterday', timestamp: localTimestamp(2026, 9, 24) },
        { id: 'dayBefore', timestamp: localTimestamp(2026, 9, 23) },
        { id: 'older', timestamp: localTimestamp(2026, 9, 20) }
      ]
    });

    updateState({ timelineDatePreset: 'day_before_yesterday' });
    expect(getFilteredTimelineList().map(activity => activity.id)).toEqual(['dayBefore']);
  });

  it('extracts and populates existing CRM services and programs into timeline and cloud', async () => {
    setCurrentUser({ uid: 'timeline-tenant', role: 'gerant', email: 'owner@example.test' });
    setClients([
      {
        id: 991,
        fullName: 'متجر الوفاء',
        startDate: '2026-10-25',
        programs: [
          { id: 101, programName: 'PROGILIC POS', platform: 'Desktop', installationsCount: 2, startDate: '2026-10-25' }
        ],
        issues: [
          { id: 201, title: 'عطل طابعة الفواتير', status: 'محلول', date: '2026-10-24' }
        ]
      }
    ]);

    const generated = await syncCrmServicesToTimeline('timeline-tenant');
    expect(generated.length).toBeGreaterThanOrEqual(3);
    expect(cloudMocks.save).toHaveBeenCalled();
    const progAct = S.globalActivities.find(a => a.id === 'act_prog_991_101');
    expect(progAct).toBeDefined();
    expect(progAct.title).toContain('PROGILIC POS');
    expect(progAct.meta).toMatchObject({
      programId: '101',
      program: { id: 101, platform: 'Desktop', installationsCount: 2 }
    });
    expect(progAct.category).toBe('programs');
  });

  it('does not invent missing license fields or timestamps in generated timeline events', async () => {
    setCurrentUser({ uid: 'timeline-tenant', role: 'gerant' });
    setClients([{
      id: 992,
      fullName: 'Legacy License Customer',
      programs: [
        { id: 102, programName: 'Recorded Program', startDate: '2024-01-02' },
        { id: 103, programName: 'Undated Program' }
      ]
    }]);

    await syncCrmServicesToTimeline('timeline-tenant');

    const recordedEvent = S.globalActivities.find(activity => activity.id === 'act_prog_992_102');
    expect(recordedEvent.description).not.toContain('Desktop');
    expect(recordedEvent.description).not.toContain('تجاري');
    expect(recordedEvent.description).not.toContain('1 محطة');
    expect(recordedEvent.meta.program).toEqual({ id: 102, programName: 'Recorded Program', startDate: '2024-01-02' });
    expect(S.globalActivities.some(activity => activity.id === 'act_prog_992_103')).toBe(false);
  });
});
