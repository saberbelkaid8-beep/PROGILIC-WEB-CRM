import { S, clients, hasPermission } from '../state/store.js';
import { BACKLOG_STATUSES } from '../constants/index.js';
import { buildUnifiedBacklog } from '../business/backlogService.js';
import { esc, pBdg, rBdg } from '../utils/index.js';
import { t } from '../utils/i18n.js';

const BI = {
  plus: '<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
};

const bIc = (name, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BI[name] || BI.layers}</svg>`;

export function renderBacklogView() {
  if (!hasPermission('backlog.view')) {
    return `
      <div class="dashboard-root">
        <div class="empty" style="max-width:540px;margin:2rem auto">
          <div class="empty-icon">${bIc('lock', 24)}</div>
          <div class="empty-text">${t('⚠️ لا تملك صلاحية عرض قائمة التطوير الموحدة (Backlog).')}</div>
        </div>
      </div>
    `;
  }

  const unified = buildUnifiedBacklog(clients || [], S.backlogItems || []);
  const allItems = unified.items || [];
  const search = (S.backlogSearch || '').trim().toLowerCase();
  const statusFilter = S.backlogStatusFilter || 'all';

  const virtualRepeated = allItems.filter(x => x.isVirtual && x.interestedClientsCount >= 2);
  const completedCount = allItems.filter(x => x.status === 'منفذ').length;

  const filtered = allItems.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (search) {
      const hay = [
        item.title,
        item.description,
        item.category,
        item.assignedStaffName,
        item.targetVersion,
        ...(item.interestedClients || []).map(rc => `${rc.clientName} ${rc.clientCompany}`)
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const canCreate = hasPermission('backlog.create');
  const canEdit = hasPermission('backlog.edit');
  const canDelete = hasPermission('backlog.delete');
  const canManage = canCreate || hasPermission('backlog.manage');

  return `
    <div class="dashboard-root">
      <div class="phead">
        <div>
          <h1>${t('قائمة Backlog التطوير المركزية')}</h1>
          <p class="sub">${t('توحيد الطلبات والاقتراحات المتكررة وترتيب أولويات التطوير حسب عدد العملاء المهتمين')}</p>
        </div>
        <div class="phead-actions">
          ${canCreate ? `
            <button class="btn btn-primary btn-sm" onclick="openModal('addBacklogItem')">
              ${bIc('plus', 14)}
              <span>${t('طلب تطوير موحد')}</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 4 KPI Tiles -->
      <div class="stats-row" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-c sb">
          <div class="stat-v num">${unified.totalBacklogItems}</div>
          <div class="stat-l">${t('إجمالي طلبات التطوير')}</div>
        </div>
        <div class="stat-c">
          <div class="stat-v num" style="color:var(--pt)">${unified.totalInterestedRequests}</div>
          <div class="stat-l">${t('طلبات العملاء المرتبطة')}</div>
        </div>
        <div class="stat-c so">
          <div class="stat-v num">${unified.repeatedClusters.length}</div>
          <div class="stat-l">${t('طلبات متكررة (2+ عملاء)')}</div>
        </div>
        <div class="stat-c sg">
          <div class="stat-v num">${completedCount}</div>
          <div class="stat-l">${t('ميزات منفذة')}</div>
        </div>
      </div>

      <!-- Auto-detected clusters ready to unify -->
      ${virtualRepeated.length > 0 ? `
        <div class="card" style="margin-bottom:14px;padding:14px 18px;border-color:rgba(191,90,242,0.35);background:rgba(191,90,242,0.06)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            <div style="font-size:13.5px;font-weight:800;color:var(--pt)">
              🔗 ${t('طلبات متكررة تلقائياً جاهزة للتوحيد')} (<span class="num">${virtualRepeated.length}</span>)
            </div>
            <span style="font-size:12px;color:var(--t2)">${t('تجميع تلقائي لطلبات العملاء المتشابهة لدمجها في بطاقة تطوير واحدة')}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${virtualRepeated.slice(0, 5).map(cl => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:rgba(255,255,255,0.04);padding:10px 12px;border-radius:var(--r-sm);border:1px solid var(--border)">
                <div style="min-width:0;flex:1">
                  <div style="font-weight:700;font-size:13px;color:var(--t1)">${esc(cl.title)}</div>
                  <div style="font-size:11.5px;color:var(--t3);margin-top:2px">
                    ${t('طلبها')} <strong class="num" style="color:var(--pt)">${cl.interestedClientsCount}</strong> ${t('عملاء مهتمين')}
                  </div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <button type="button" class="btn btn-outline btn-xs" onclick="openBacklogClients('${esc(cl.id)}')">${bIc('users', 12)} <span>${t('عرض العملاء')}</span></button>
                  ${canManage ? `
                    <button type="button" class="btn btn-primary btn-xs" onclick="unifyClusterToBacklog('${esc(cl.id)}')">
                      ${bIc('link', 12)} <span>${t('توحيد في Backlog التطوير')}</span>
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Search & Status Bar -->
      <div class="search-row" style="margin-bottom:12px">
        <div style="position:relative;flex:1;display:flex;align-items:center">
          <span style="position:absolute;inset-inline-start:14px;color:var(--t3);display:flex;pointer-events:none">${bIc('search', 15)}</span>
          <input class="search-input" style="padding-inline-start:40px" placeholder="${t('ابحث في طلبات Backlog أو أسماء العملاء المهتمين...')}" value="${esc(S.backlogSearch || '')}" oninput="setBacklogFilter('backlogSearch', this.value)">
        </div>
      </div>

      <div class="filter-bar" style="margin-bottom:14px;gap:6px">
        ${['all', ...BACKLOG_STATUSES].map(st => `
          <span class="fpill${statusFilter === st ? ' on' : ''}" onclick="setBacklogFilter('backlogStatusFilter','${esc(st)}')">
            ${st === 'all' ? t('الكل') : t(st)}
          </span>
        `).join('')}
      </div>

      <!-- Unified Backlog Items -->
      ${filtered.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">${bIc('layers', 24)}</div>
          <div class="empty-text">${t('لا توجد عناصر مطابقة في قائمة Backlog')}</div>
          ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="openModal('addBacklogItem')">${t('إضافة طلب تطوير موحد')}</button>` : ''}
        </div>
      ` : `
        <div class="backlog-list">
          ${filtered.map(item => `
            <div class="backlog-card">
              <div class="backlog-top">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;flex:1">
                  <span class="backlog-title">${esc(item.title)}</span>
                  ${item.isVirtual
                    ? `<span class="bdg bdg-y">${t('تجميع تلقائي')}</span>`
                    : `<span class="bdg bdg-b">${t('طلب تطوير موحد')}</span>`}
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  ${pBdg(item.priority || 'متوسطة')}
                  ${rBdg(item.status || 'قيد الدراسة')}
                </div>
              </div>

              <div class="backlog-meta">
                <button type="button" class="btn btn-xs" style="background:rgba(191,90,242,0.16);color:var(--pt);border:1px solid rgba(191,90,242,0.35);font-weight:700" onclick="openBacklogClients('${esc(item.id)}')">
                  ${bIc('users', 12)} <span class="num">${item.interestedClientsCount}</span> ${t('عملاء مهتمين')} ↗
                </button>
                ${item.category ? `<span class="bdg bdg-gr">${esc(t(item.category))}</span>` : ''}
                ${item.assignedStaffName ? `<span class="bdg bdg-gr">${bIc('user', 12)} ${t('المكلف')}: ${esc(item.assignedStaffName)}</span>` : ''}
                ${item.targetVersion ? `<span class="bdg bdg-b num">${t('الإصدار المستهدف')}: ${esc(item.targetVersion)}</span>` : ''}
              </div>

              ${item.description ? `<div class="backlog-desc">${esc(item.description)}</div>` : ''}

              <div class="backlog-acts">
                <button type="button" class="btn btn-outline btn-xs" onclick="openBacklogClients('${esc(item.id)}')">
                  ${bIc('users', 12)} <span>${t('استعراض العملاء')} (<span class="num">${item.interestedClientsCount}</span>)</span>
                </button>
                ${item.isVirtual && canManage ? `
                  <button type="button" class="btn btn-primary btn-xs" onclick="unifyClusterToBacklog('${esc(item.id)}')">
                    ${bIc('link', 12)} <span>${t('توحيد وحفظ في Backlog')}</span>
                  </button>
                ` : ''}
                ${!item.isVirtual && canEdit ? `
                  <button type="button" class="btn btn-ghost btn-xs" onclick="editBacklogItem('${esc(item.id)}')">${bIc('edit', 12)} <span>${t('تعديل')}</span></button>
                ` : ''}
                ${!item.isVirtual && canDelete ? `
                  <button type="button" class="btn btn-danger-soft btn-xs" onclick="delBacklogItem('${esc(item.id)}')">${bIc('trash', 12)} <span>${t('حذف')}</span></button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}
