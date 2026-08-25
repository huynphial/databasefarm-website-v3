import { RawMeasurementEntity, MetricHistoryEntity } from '../../../types';
import { formatTimeVN } from '../../../lib/utils';

export interface UnifiedMeasurement {
  id: string;
  dbId: string;
  metricId: string;
  metricName?: string;
  objectName: string;
  attributeName: string;
  value: string;
  status: 'NORMAL' | 'WARN' | 'WARNING' | 'HIGH' | 'CRITICAL' | 'FATAL' | 'DOWN' | string;
  triggeredThreshold?: string | null;
  measuredAt: string;
}

export const OBJECT_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
];

export const parseNumericValue = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export function combineTelemetryDataPoints(
  rawMeasurements: RawMeasurementEntity[],
  metricHistory: MetricHistoryEntity[],
  selectedDbId: string,
  selectedDbName?: string
): UnifiedMeasurement[] {
  if (!selectedDbId) return [];

  const points: UnifiedMeasurement[] = [];
  const targetIdStr = String(selectedDbId).trim().toLowerCase();
  const targetNameStr = selectedDbName ? selectedDbName.trim().toLowerCase() : '';

  const isMatchingDb = (dbIdVal?: string | null, dbNameVal?: string | null) => {
    const idStr = String(dbIdVal || '').trim().toLowerCase();
    if (idStr && idStr === targetIdStr) return true;
    const nameStr = String(dbNameVal || '').trim().toLowerCase();
    if (targetNameStr && nameStr && nameStr === targetNameStr) return true;
    return false;
  };

  // 1. Process Raw Measurements
  const relevantRaws = rawMeasurements.filter((m) =>
    isMatchingDb(m.dbId || (m as any).databaseId, m.dbName)
  );
  relevantRaws.forEach((m) => {
    points.push({
      id: m.id,
      dbId: m.dbId || (m as any).databaseId || selectedDbId,
      metricId: m.metricId,
      metricName: m.metricName,
      objectName: m.objectName || 'INSTANCE',
      attributeName: m.attributeName || 'value',
      value: String(m.value !== undefined && m.value !== null ? m.value : ''),
      status: m.status || 'NORMAL',
      triggeredThreshold: m.triggeredThreshold || null,
      measuredAt: m.measuredAt || new Date().toISOString(),
    });
  });

  // 2. Process Metric History Data Points (database table metric_data_points)
  const relevantHistory = metricHistory.filter((h) =>
    isMatchingDb(h.dbId || (h as any).databaseId, h.dbName)
  );
  relevantHistory.forEach((h) => {
    const timeVal = (h as any).measuredAt || h.createdAt || new Date().toISOString();
    const hTime = new Date(timeVal).getTime();
    const objName = h.objectName || 'INSTANCE';
    const attrName = h.attributeName || 'value';

    // Avoid duplicate point if raw measurements already recorded it within 2 seconds
    const isDuplicate = points.some(
      (p) =>
        (p.metricId === h.metricId || (p.metricName && h.metricName && p.metricName.toLowerCase() === h.metricName.toLowerCase())) &&
        p.objectName === objName &&
        p.attributeName === attrName &&
        Math.abs(new Date(p.measuredAt).getTime() - hTime) < 2000
    );

    if (!isDuplicate) {
      points.push({
        id: h.id,
        dbId: h.dbId || (h as any).databaseId || selectedDbId,
        metricId: h.metricId,
        metricName: h.metricName,
        objectName: objName,
        attributeName: attrName,
        value: String(h.value !== undefined && h.value !== null ? h.value : ''),
        status: (h as any).status || 'NORMAL',
        triggeredThreshold: (h as any).triggeredThreshold || null,
        measuredAt: timeVal,
      });
    }
  });

  // Sort chronologically descending (newest first) by default
  points.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());

  return points;
}
