import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DatabaseEntity } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function autoSyncDatabaseTemplateMetrics<TD extends DatabaseEntity = DatabaseEntity>(
  dbs: TD[],
  grps: { id: string; templateIds?: string[] }[],
  tpls: { id: string; targetDbType?: any }[],
  mets: { id: string; isEnabled?: boolean; templateId?: string | null; templateIds?: string[] }[]
): { syncedDatabases: TD[]; updatedDbIds: string[] } {
  const groupMap = new Map(grps.map((g) => [g.id, g]));
  const templateMap = new Map(tpls.map((t) => [t.id, t]));
  const updatedDbIds: string[] = [];

  const syncedDatabases: TD[] = dbs.map((db) => {
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
  if (typeof dateString === 'string') {
    const trimmed = dateString.trim();
    // If it's already a standard formatted date string without timezone indicator, preserve it
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match && !trimmed.endsWith('Z')) {
      const [, y, m, d, hh, mm, ss] = match;
      return `${d}/${m}/${y} ${hh}:${mm}:${ss || '00'}`;
    }
  }

  const date = typeof dateString === 'string' || typeof dateString === 'number' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return typeof dateString === 'string' ? dateString : 'N/A';

  try {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch (e) {
    return date.toLocaleString();
  }
}
