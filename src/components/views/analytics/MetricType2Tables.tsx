import React from 'react';
import { Layers, TrendingUp } from 'lucide-react';
import { MetricEntity } from '../../../types';
import { UnifiedMeasurement } from './analyticsUtils';
import { formatTimeVN } from '../../../lib/utils';
import { useLanguage } from '../../../i18n/LanguageContext';

interface MetricType2TablesProps {
  type2Metrics: MetricEntity[];
  unifiedMeasurements: UnifiedMeasurement[];
  onQuickChart: (metricId: string, attributeName: string, objectName: string) => void;
}

export const MetricType2Tables: React.FC<MetricType2TablesProps> = ({
  type2Metrics,
  unifiedMeasurements,
  onQuickChart,
}) => {
  const { t } = useLanguage();

  // Sort Type 2 metrics alphabetically from A to Z
  const sortedMetrics = React.useMemo(() => {
    return [...type2Metrics].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    );
  }, [type2Metrics]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              {t('analytics.metricType2Title')}
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
                {t('analytics.metricType2Count', {
                  count: sortedMetrics.length,
                  tables: sortedMetrics.length === 1 ? t('analytics.table') : t('analytics.tables'),
                })}
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {t('analytics.sortedAZ')}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {t('analytics.metricType2Desc')}
            </p>
          </div>
        </div>
      </div>

      {sortedMetrics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs">
          {t('analytics.noType2Metrics')}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMetrics.map((metric, idx) => {
            // Filter all measurements for this metric from unified measurements (includes metric_data_points)
            const metricMeasurements = unifiedMeasurements.filter((m) => {
              const mId = String(m.metricId || '').trim();
              const targetId = String(metric.id || '').trim();
              if (mId && targetId && mId === targetId) return true;
              if (m.metricName && metric.name && m.metricName.trim().toLowerCase() === metric.name.trim().toLowerCase()) {
                return true;
              }
              return false;
            });

            // Group by objectName to get latest measurement per object
            const objectMap = new Map<string, UnifiedMeasurement>();
            metricMeasurements.forEach((m) => {
              const objName = m.objectName || 'GLOBAL';
              const existing = objectMap.get(objName);
              if (!existing || new Date(m.measuredAt).getTime() > new Date(existing.measuredAt).getTime()) {
                objectMap.set(objName, m);
              }
            });

            // Sort object rows alphabetically by objectName A-Z
            const objectRows = Array.from(objectMap.values()).sort((a, b) =>
              (a.objectName || '').localeCompare(b.objectName || '', undefined, { sensitivity: 'base', numeric: true })
            );

            const thresholdSummary =
              metric.thresholdWarn || metric.thresholdHigh || metric.thresholdCritical
                ? t('analytics.thresholdRuleSummary', {
                    warn: metric.thresholdWarn || '-',
                    high: metric.thresholdHigh || '-',
                    crit: metric.thresholdCritical || '-',
                    op: metric.thresholdOperator || metric.relationalOperator || '>=',
                  })
                : t('analytics.noExplicitThreshold');

            return (
              <div
                key={metric.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 relative overflow-hidden"
              >
                {/* Metric Header with Step-by-Step Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-md bg-purple-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      {idx + 1}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">{metric.name}</h4>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                          {t('analytics.stepIndicator', { current: idx + 1, total: sortedMetrics.length })}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {t('analytics.objectsCount', {
                            count: objectRows.length,
                            objects: objectRows.length === 1 ? t('analytics.object') : t('analytics.objects'),
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate max-w-xl">
                        {thresholdSummary} • {t('analytics.cycleLabel', { cycle: metric.cycle ?? 1 })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuickChart(metric.id, 'value', 'ALL')}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      {t('analytics.chartMetric', { name: metric.name })}
                    </button>
                  </div>
                </div>

                {/* Objects Table */}
                {objectRows.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    {t('analytics.noObjectTelemetry')}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3.5">{t('analytics.colObjectIdentifier')}</th>
                          <th className="py-2.5 px-3.5">{t('analytics.colMeasuredValue')}</th>
                          <th className="py-2.5 px-3.5">{t('analytics.colThresholdEval')}</th>
                          <th className="py-2.5 px-3.5">{t('analytics.colLastMeasured')}</th>
                          <th className="py-2.5 px-3.5 text-right">{t('analytics.colAction')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {objectRows.map((row) => {
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3.5 font-bold font-mono text-slate-900 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                                {row.objectName || 'INSTANCE'}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <span className="font-mono font-bold text-slate-900 text-sm">
                                  {row.value}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                                {row.triggeredThreshold || thresholdSummary}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                                {formatTimeVN(row.measuredAt)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => onQuickChart(metric.id, row.attributeName || 'value', row.objectName)}
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
