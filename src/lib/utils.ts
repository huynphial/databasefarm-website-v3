import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function autoSyncDatabaseTemplateMetrics<
  TD extends { id: string; dbType?: string; groupIds?: string[]; metricIds?: string[]; updatedAt?: string },
  TG extends { id: string; templateIds?: string[] },
  TT extends { id: string; targetDbType?: string },
  TM extends { id: string; isEnabled?: boolean; templateId?: string | null; templateIds?: string[] }
>(
  dbs: TD[],
  grps: TG[],
  tpls: TT[],
  mets: TM[]
): { syncedDatabases: TD[]; updatedDbIds: string[] } {
  const groupMap = new Map(grps.map((g) => [g.id, g]));
  const templateMap = new Map(tpls.map((t) => [t.id, t]));
  const updatedDbIds: string[] = [];

  const syncedDatabases = dbs.map((db) => {
    const attachedGroupIds = db.groupIds || [];
    const attachedTemplateIds = new Set<string>();

    attachedGroupIds.forEach((gid) => {
      const group = groupMap.get(gid);
      if (group && group.templateIds) {
        group.templateIds.forEach((tid) => attachedTemplateIds.add(tid));
      }
    });

    const compatibleTemplateIds = new Set<string>();
    attachedTemplateIds.forEach((tid) => {
      const tpl = templateMap.get(tid);
      if (tpl) {
        const tType = (tpl.targetDbType || 'ALL').toUpperCase();
        const dbEngineType = (db.dbType || '').toUpperCase();
        if (tType === 'ALL' || !tType || tType === dbEngineType) {
          compatibleTemplateIds.add(tid);
        }
      }
    });

    const inheritedMetricIds = mets
      .filter((m) => {
        if (m.isEnabled === false) return false;
        const mTemplateIds = m.templateIds || (m.templateId ? [m.templateId] : []);
        return mTemplateIds.some((tid) => compatibleTemplateIds.has(tid));
      })
      .map((m) => m.id);

    const existingMetricSet = new Set(db.metricIds || []);
    let hasNewMetric = false;
    inheritedMetricIds.forEach((mid) => {
      if (!existingMetricSet.has(mid)) {
        existingMetricSet.add(mid);
        hasNewMetric = true;
      }
    });

    if (hasNewMetric) {
      updatedDbIds.push(db.id);
      return {
        ...db,
        metricIds: Array.from(existingMetricSet),
        updatedAt: new Date().toISOString(),
      };
    }
    return db;
  });

  return { syncedDatabases, updatedDbIds };
}

export function formatTimeVN(dateString: string | Date | number | null | undefined): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  // Timezone formatting for UTC+7 (Asia/Ho_Chi_Minh)
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch (e) {
    return date.toLocaleString();
  }
}
