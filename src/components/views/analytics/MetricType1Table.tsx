import React from 'react';
import { Gauge, Check, AlertTriangle, TrendingUp } from 'lucide-react';
import { MetricEntity } from '../../../types';
import { UnifiedMeasurement } from './analyticsUtils';
import { formatTimeVN } from '../../../lib/utils';

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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Metric Type 1: Single Attribute of Single Object
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {type1Metrics.length} Metrics
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Consolidated status table for instance-level scalar probes reading from database metric_data_points
            </p>
          </div>
        </div>
      </div>

      {type1Metrics.length === 0 ? (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
          No Type 1 metrics configured for this database.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3.5">Metric Check Name</th>
                <th className="py-2.5 px-3.5">Value Type</th>
                <th className="py-2.5 px-3.5">Latest Measured Value</th>
                <th className="py-2.5 px-3.5">Evaluation Status</th>
                <th className="py-2.5 px-3.5">Threshold Rule</th>
                <th className="py-2.5 px-3.5">Frequency</th>
                <th className="py-2.5 px-3.5">Last Measured (UTC+7)</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {type1Metrics.map((metric) => {
                // Find most recent measurement for this metric from metric_data_points / unified Measurements
                const latestMeasurement = unifiedMeasurements.find((m) => m.metricId === metric.id);

                const value = latestMeasurement ? latestMeasurement.value : 'N/A';
                const status = latestMeasurement ? latestMeasurement.status : 'NORMAL';

                const statusBadge =
                  status === 'CRITICAL' || status === 'DOWN'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : status === 'WARNING'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                const thresholdText =
                  metric.thresholdWarn || metric.thresholdHigh || metric.thresholdCritical
                    ? `Warn: ${metric.thresholdWarn || '-'} / High: ${metric.thresholdHigh || '-'} / Crit: ${metric.thresholdCritical || '-'} (${metric.thresholdOperator || metric.relationalOperator || '>='})`
                    : 'No threshold';

                return (
                  <tr key={metric.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900">{metric.name}</div>
                      {metric.templateName && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Template: {metric.templateName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                        {metric.valueType}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="font-mono font-bold text-slate-900 text-sm">
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
                      Cycle {metric.cycle ?? 1}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">
                      {latestMeasurement ? formatTimeVN(latestMeasurement.measuredAt) : 'No data yet'}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onQuickChart(metric.id, 'value', 'ALL')}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <TrendingUp className="w-3 h-3" />
                        View Chart
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
