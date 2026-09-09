import React from 'react';
import { Cpu, TrendingUp } from 'lucide-react';
import { MetricEntity } from '../../../types';
import { UnifiedMeasurement, parseTimestampMs } from './analyticsUtils';
import { formatTimeVN } from '../../../lib/utils';
import { useLanguage } from '../../../i18n/LanguageContext';

interface MetricType3TablesProps {
  type3Metrics: MetricEntity[];
  unifiedMeasurements: UnifiedMeasurement[];
  onQuickChart: (metricId: string, attributeName: string, objectName: string) => void;
}

export const MetricType3Tables: React.FC<MetricType3TablesProps> = ({
  type3Metrics,
  unifiedMeasurements,
  onQuickChart,
}) => {
  const { t } = useLanguage();

  // Sort Type 3 metrics alphabetically from A to Z
  const sortedMetrics = React.useMemo(() => {
    return [...type3Metrics].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    );
  }, [type3Metrics]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              {t('analytics.metricType3Title')}
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {t('analytics.metricType3Count', {
                  count: sortedMetrics.length,
                  tables: sortedMetrics.length === 1 ? t('analytics.table') : t('analytics.tables'),
                })}
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {t('analytics.sortedAZ')}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {t('analytics.metricType3Desc')}
            </p>
          </div>
        </div>
      </div>

      {sortedMetrics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs">
          {t('analytics.noType3Metrics')}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMetrics.map((metric, idx) => {
            // Discover all attributes and objects for this metric from unified measurements
            const metricMeasurements = unifiedMeasurements.filter((m) => {
              const mId = String(m.metricId || '').trim();
              const targetId = String(metric.id || '').trim();
              if (mId && targetId && mId === targetId) return true;
              if (m.metricName && metric.name && m.metricName.trim().toLowerCase() === metric.name.trim().toLowerCase()) {
                return true;
              }
              return false;
            });

            // Find newest measurement timestamp for THIS specific metric to respect its individual cycle schedule
            const latestMetricTime = metricMeasurements.reduce((max, m) => {
              const t = parseTimestampMs(m.measuredAt);
              return t > max ? t : max;
            }, 0);

            // Compute cycle tolerance window (minimum 2 minutes, or 40% of the metric's multi-cycle interval)
            const cycleMultiplier = Math.max(1, Number(metric.cycle) || 1);
            const cycleToleranceMs = Math.max(120000, cycleMultiplier * 60000 * 0.4);

            // Filter measurements to only those belonging to the latest execution cycle of this metric
            const latestCycleMeasurements = latestMetricTime > 0
              ? metricMeasurements.filter((m) => Math.abs(latestMetricTime - parseTimestampMs(m.measuredAt)) <= cycleToleranceMs)
              : metricMeasurements;

            // Extract dynamic list of attribute names
            const attributeNamesSet = new Set<string>();
            if (metric.thresholdsConfig?.perAttribute) {
              metric.thresholdsConfig.perAttribute.forEach((a) => attributeNamesSet.add(a.attributeName));
            }
            latestCycleMeasurements.forEach((m) => {
              if (m.attributeName) attributeNamesSet.add(m.attributeName);
            });
            if (attributeNamesSet.size === 0) {
              metricMeasurements.forEach((m) => {
                if (m.attributeName) attributeNamesSet.add(m.attributeName);
              });
            }

            const attributeColumns = Array.from(attributeNamesSet);

            // Sort newest first so freshest values are processed first
            const sortedMeasurements = [...latestCycleMeasurements].sort(
              (a, b) => parseTimestampMs(b.measuredAt) - parseTimestampMs(a.measuredAt)
            );

            // Group by objectName -> object row with attribute key-values
            const objectRowsMap = new Map<
              string,
              {
                objectName: string;
                attributes: Record<string, string>;
                attributeTimes: Record<string, number>;
                measuredAt: string;
                latestTime: number;
              }
            >();

            sortedMeasurements.forEach((m) => {
              const objName = m.objectName || 'GLOBAL';
              const mTime = parseTimestampMs(m.measuredAt);
              const attrName = m.attributeName || 'value';

              if (!objectRowsMap.has(objName)) {
                objectRowsMap.set(objName, {
                  objectName: objName,
                  attributes: {},
                  attributeTimes: {},
                  measuredAt: m.measuredAt,
                  latestTime: mTime,
                });
              }

              const item = objectRowsMap.get(objName)!;
              const existingAttrTime = item.attributeTimes[attrName];

              // Only set attribute value if not set yet, or if this measurement is strictly newer
              if (existingAttrTime === undefined || mTime > existingAttrTime) {
                item.attributes[attrName] = String(m.value !== undefined && m.value !== null ? m.value : '');
                item.attributeTimes[attrName] = mTime;
              }

              if (mTime > item.latestTime) {
                item.latestTime = mTime;
                item.measuredAt = m.measuredAt;
              }
            });

            // Sort object rows alphabetically by objectName A-Z
            const objectRows = Array.from(objectRowsMap.values()).sort((a, b) =>
              (a.objectName || '').localeCompare(b.objectName || '', undefined, { sensitivity: 'base', numeric: true })
            );

            return (
              <div
                key={metric.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 relative overflow-hidden"
              >
                {/* Header with Step-by-Step Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-md bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      {idx + 1}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">{metric.name}</h4>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          {t('analytics.stepIndicator', { current: idx + 1, total: sortedMetrics.length })}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {t('analytics.objectsCount', {
                            count: objectRows.length,
                            objects: objectRows.length === 1 ? t('analytics.object') : t('analytics.objects'),
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {t('analytics.columnsAndCycle', {
                          cols: attributeColumns.join(', ') || 'Dynamic',
                          cycle: metric.cycle ?? 1,
                        })}
                      </p>
                    </div>
                  </div>

                  {attributeColumns.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {attributeColumns.slice(0, 3).map((attr) => (
                        <button
                          key={attr}
                          type="button"
                          onClick={() => onQuickChart(metric.id, attr, 'ALL')}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <TrendingUp className="w-3 h-3" />
                          {t('analytics.chartAttr', { attr })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Multi-Column Table */}
                {objectRows.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    {t('analytics.noMultiAttrMeasurements')}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3.5">{t('analytics.colObjectIdentifier')}</th>
                          {attributeColumns.map((col) => (
                            <th key={col} className="py-2.5 px-3.5">
                              {col}
                            </th>
                          ))}
                          <th className="py-2.5 px-3.5">{t('analytics.colLastMeasured')}</th>
                          <th className="py-2.5 px-3.5 text-right">{t('analytics.colAction')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {objectRows.map((row) => {
                          return (
                            <tr key={row.objectName} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3.5 font-bold font-mono text-slate-900 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                {row.objectName}
                              </td>
                              {attributeColumns.map((col) => {
                                const val = row.attributes[col] || '-';
                                return (
                                  <td key={col} className="py-2.5 px-3.5 font-mono text-slate-800 font-semibold">
                                    {val}
                                  </td>
                                );
                              })}
                              <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                                {formatTimeVN(row.measuredAt)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onQuickChart(
                                      metric.id,
                                      attributeColumns[0] || 'value',
                                      row.objectName
                                    )
                                  }
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <TrendingUp className="w-3 h-3" />
                                  {t('analytics.chartObject')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
