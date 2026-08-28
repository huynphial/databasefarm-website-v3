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

function parseDateInput(val: string | Date | number | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const sqlMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
    if (sqlMatch && !trimmed.endsWith('Z')) {
      const [, y, m, d, hh, mm, ss] = sqlMatch;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function formatRelativeDuration(
  startDateOrDuration: string | Date | number | null | undefined,
  endDateOrLang?: string | Date | number | null,
  langArg: string = 'en'
): string {
  if (!startDateOrDuration) return '—';

  let lang = langArg;
  let endInput: string | Date | number | null | undefined = undefined;

  if (typeof endDateOrLang === 'string' && (endDateOrLang === 'en' || endDateOrLang === 'vi')) {
    lang = endDateOrLang;
    endInput = undefined;
  } else if (endDateOrLang !== undefined && endDateOrLang !== null) {
    endInput = endDateOrLang;
  }

  const startDate = parseDateInput(startDateOrDuration);
  if (!startDate) return '—';

  const endDate = endInput !== undefined ? parseDateInput(endInput) : new Date();
  if (!endDate) return '—';

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const isVi = lang === 'vi';

  if (diffSec < 60) {
    return isVi ? `${diffSec} giây` : `${diffSec} second${diffSec !== 1 ? 's' : ''}`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    const remSec = diffSec % 60;
    if (remSec > 0 && diffMin < 5) {
      return isVi
        ? `${diffMin} phút ${remSec} giây`
        : `${diffMin} minute${diffMin !== 1 ? 's' : ''} ${remSec} second${remSec !== 1 ? 's' : ''}`;
    }
    return isVi ? `${diffMin} phút` : `${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    const remMin = diffMin % 60;
    if (remMin > 0) {
      return isVi
        ? `${diffHours} giờ ${remMin} phút`
        : `${diffHours} hour${diffHours !== 1 ? 's' : ''} ${remMin} minute${remMin !== 1 ? 's' : ''}`;
    }
    return isVi ? `${diffHours} giờ` : `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    const remHours = diffHours % 24;
    if (remHours > 0 && diffDays < 7) {
      return isVi
        ? `${diffDays} ngày ${remHours} giờ`
        : `${diffDays} day${diffDays !== 1 ? 's' : ''} ${remHours} hour${remHours !== 1 ? 's' : ''}`;
    }
    return isVi ? `${diffDays} ngày` : `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    const remDays = diffDays % 30;
    if (remDays > 0) {
      return isVi
        ? `${diffMonths} tháng ${remDays} ngày`
        : `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ${remDays} day${remDays !== 1 ? 's' : ''}`;
    }
    return isVi ? `${diffMonths} tháng` : `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  }

  const diffYears = Math.floor(diffDays / 365);
  const remMonths = Math.floor((diffDays % 365) / 30);
  if (remMonths > 0) {
    return isVi
      ? `${diffYears} năm ${remMonths} tháng`
      : `${diffYears} year${diffYears !== 1 ? 's' : ''} ${remMonths} month${remMonths !== 1 ? 's' : ''}`;
  }
  return isVi ? `${diffYears} năm` : `${diffYears} year${diffYears !== 1 ? 's' : ''}`;
}
