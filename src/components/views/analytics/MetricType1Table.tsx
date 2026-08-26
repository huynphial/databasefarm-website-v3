import React from 'react';
import { Gauge, Check, AlertTriangle, TrendingUp } from 'lucide-react';
import { MetricEntity } from '../../../types';
import { UnifiedMeasurement } from './analyticsUtils';
import { formatTimeVN } from '../../../lib/utils';
import { useLanguage } from '../../../i18n/LanguageContext';

interface MetricType1TableProps {
  type1Metrics: MetricEntity[];
  unifiedMeasurements: UnifiedMeasurement[];
  onQuickChart: (metricId: string, attributeName: string, objectName: string) => void;
}

export const MetricType1Table: React.FC<MetricType1TableProps> = ({
  type1Metrics,
  unifiedMeasurements,
  onQuickChart,
}) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {t('analytics.metricType1Title')}
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {t('analytics.metricsCount', { count: type1Metrics.length })}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {t('analytics.metricType1Desc')}
            </p>
          </div>
        </div>
      </div>

      {type1Metrics.length === 0 ? (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
          {t('analytics.noType1Metrics')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3.5">{t('analytics.colMetricCheckName')}</th>
                <th className="py-2.5 px-3.5">{t('analytics.colValueType')}</th>
                <th className="py-2.5 px-3.5">{t('analytics.colLatestMeasuredValue')}</th>
                <th className="py-2.5 px-3.5">{t('analytics.colEvaluationStatus')}</th>
                <th className="py-2.5 px-3.5">{t('analytics.colThresholdRule')}</th>
                <th className="py-2.5 px-3.5">{t('analytics.colFrequency')}</th>
                <th className="py-2.5 px-3.5">{t('analytics.colLastMeasured')}</th>
                <th className="py-2.5 px-3.5 text-right">{t('analytics.colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {type1Metrics.map((metric) => {
                // Find most recent measurement for this metric from metric_data_points / unified Measurements
                const latestMeasurement = unifiedMeasurements.find((m) => {
                  const mId = String(m.metricId || '').trim();
                  const targetId = String(metric.id || '').trim();
                  if (mId && targetId && mId === targetId) return true;
                  if (m.metricName && metric.name && m.metricName.trim().toLowerCase() === metric.name.trim().toLowerCase()) {
                    return true;
                  }
                  return false;
                });

                const hasData = Boolean(
                  latestMeasurement &&
                  latestMeasurement.value !== undefined &&
                  latestMeasurement.value !== null &&
                  String(latestMeasurement.value).trim() !== ''
                );

                const rawVal = hasData ? String(latestMeasurement!.value).trim() : '';
                const value = hasData ? rawVal : 'N/A';

                // Determine evaluation status
                let status = latestMeasurement?.status || 'NORMAL';
                if (hasData && (!status || status === 'NORMAL')) {
                  const numVal = parseFloat(rawVal.replace(/[^0-9.-]/g, ''));
                  if (!isNaN(numVal)) {
                    const warnVal = metric.thresholdWarn ? parseFloat(metric.thresholdWarn) : NaN;
                    const highVal = metric.thresholdHigh ? parseFloat(metric.thresholdHigh) : NaN;
                    const critVal = metric.thresholdCritical ? parseFloat(metric.thresholdCritical) : NaN;
                    const op = String(metric.thresholdOperator || metric.relationalOperator || '>=');

                    if (op === '>=' || op === '>') {
                      if (!isNaN(critVal) && numVal >= critVal) status = 'CRITICAL';
                      else if (!isNaN(highVal) && numVal >= highVal) status = 'HIGH';
                      else if (!isNaN(warnVal) && numVal >= warnVal) status = 'WARN';
                    } else if (op === '<=' || op === '<') {
                      if (!isNaN(critVal) && numVal <= critVal) status = 'CRITICAL';
                      else if (!isNaN(highVal) && numVal <= highVal) status = 'HIGH';
                      else if (!isNaN(warnVal) && numVal <= warnVal) status = 'WARN';
                    }
                  }
                }

                const statusBadge =
                  status === 'CRITICAL' || status === 'FATAL' || status === 'DOWN'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : status === 'HIGH'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : status === 'WARNING' || status === 'WARN'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                const thresholdText =
                  metric.thresholdWarn || metric.thresholdHigh || metric.thresholdCritical
                    ? t('analytics.thresholdRuleSummary', {
                        warn: metric.thresholdWarn || '-',
                        high: metric.thresholdHigh || '-',
                        crit: metric.thresholdCritical || '-',
                        op: metric.thresholdOperator || metric.relationalOperator || '>=',
                      })
                    : t('analytics.noThreshold');

                const measuredTimestamp = latestMeasurement?.measuredAt || (latestMeasurement as any)?.createdAt;

                return (
                  <tr key={metric.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900">{metric.name}</div>
                      {metric.templateName && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {t('analytics.templatePrefix')} {metric.templateName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                        {metric.valueType || 'NUMBER'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <span className={`font-mono font-bold text-sm ${hasData ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                        {value}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                        {status === 'NORMAL' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600">
                      {thresholdText}
                    </td>
                    <td className="py-3 px-3.5 text-slate-500 font-medium">
                      {t('analytics.cycleCount', { cycle: metric.cycle ?? 1 })}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600">
                      {measuredTimestamp ? (
                        <span className="text-slate-700 font-medium">{formatTimeVN(measuredTimestamp)}</span>
                      ) : (
                        <span className="text-slate-400 italic">{t('analytics.noDataYet')}</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onQuickChart(metric.id, 'value', 'ALL')}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <TrendingUp className="w-3 h-3" />
                        {t('analytics.viewChart')}
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
};
