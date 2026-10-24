import { afterEach, describe, expect, it, vi } from 'vitest';
const cloudMocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../src/firebase/service.js', () => ({
  getTenantActivities: cloudMocks.get,
  saveTenantActivity: cloudMocks.save
}));
import { buildTimelineReport, getFilteredTimelineList } from '../../src/business/actions/timelineActions.js';
import { ActivityType } from '../../src/business/timelineService.js';
import { loadGlobalActivities, logActivity } from '../../src/business/timelineService.js';
import { S, setCurrentStaffUser, setCurrentUser, updateState } from '../../src/state/store.js';

const activities = [
  { id: 1, timestamp: '2026-10-22T09:00:00.000Z', type: ActivityType.CLIENT_CREATED, userId: 'u1', userName: 'سارة', clientName: 'حمزة بلقايد', category: 'clients' },
  { id: 2, timestamp: '2026-10-23T10:00:00.000Z', type: ActivityType.ISSUE_ADDED, userId: 'u2', userName: 'كريم', clientName: 'زبون آخر', category: 'issues', description: 'مشكلة شبكة' },
  { id: 3, timestamp: '2026-10-23T15:00:00.000Z', type: ActivityType.ISSUE_RESOLVED, userId: 'u1', userName: 'سارة', clientName: 'زبون آخر', category: 'issues', description: 'إغلاق مشكلة شبكة' },
  { id: 4, timestamp: '2026-10-24T00:30:00.000Z', type: ActivityType.CLIENT_DELETED, userId: 'u1', userName: 'سارة', clientName: 'زبون آخر' }
];

describe('Global timeline filters and report', () => {
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
});
