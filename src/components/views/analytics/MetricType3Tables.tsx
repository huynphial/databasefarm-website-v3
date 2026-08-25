import React from 'react';
import { Cpu, TrendingUp } from 'lucide-react';
import { MetricEntity } from '../../../types';
import { UnifiedMeasurement } from './analyticsUtils';
import { formatTimeVN } from '../../../lib/utils';

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
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Cpu className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Metric Type 3: Multiple Attributes of Multiple Objects
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {type3Metrics.length} Multi-Attribute {type3Metrics.length === 1 ? 'Table' : 'Tables'}
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Rich multi-column analytics tables with per-attribute return types reading from database metric_data_points
          </p>
        </div>
      </div>

      {type3Metrics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs">
          No Type 3 metrics configured for this database instance.
        </div>
      ) : (
        <div className="space-y-4">
          {type3Metrics.map((metric) => {
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

            // Extract dynamic list of attribute names
            const attributeNamesSet = new Set<string>();
            if (metric.thresholdsConfig?.perAttribute) {
              metric.thresholdsConfig.perAttribute.forEach((a) => attributeNamesSet.add(a.attributeName));
            }
            metricMeasurements.forEach((m) => {
              if (m.attributeName) attributeNamesSet.add(m.attributeName);
            });

            const attributeColumns = Array.from(attributeNamesSet);

            // Group by objectName -> object row with attribute key-values
            const objectRowsMap = new Map<
              string,
              {
                objectName: string;
                attributes: Record<string, string>;
                status: string;
                measuredAt: string;
              }
            >();

            metricMeasurements.forEach((m) => {
              const objName = m.objectName || 'GLOBAL';
              if (!objectRowsMap.has(objName)) {
                objectRowsMap.set(objName, {
                  objectName: objName,
                  attributes: {},
                  status: 'NORMAL',
                  measuredAt: m.measuredAt,
                });
              }
              const item = objectRowsMap.get(objName)!;
              if (m.attributeName) {
                item.attributes[m.attributeName] = m.value;
              }
              if (m.status === 'CRITICAL' || m.status === 'DOWN') {
                item.status = m.status;
              } else if (m.status === 'WARNING' && item.status !== 'CRITICAL') {
                item.status = 'WARNING';
              }
              if (new Date(m.measuredAt).getTime() > new Date(item.measuredAt).getTime()) {
                item.measuredAt = m.measuredAt;
              }
            });

            const objectRows = Array.from(objectRowsMap.values());

            return (
              <div
                key={metric.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{metric.name}</h4>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        Type 3 Multi-Attribute
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        ({objectRows.length} {objectRows.length === 1 ? 'object' : 'objects'})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Columns: {attributeColumns.join(', ') || 'Dynamic'} • Cycle: {metric.cycle ?? 1}
                    </p>
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
                          Chart {attr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Multi-Column Table */}
                {objectRows.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No multi-attribute measurements recorded yet for this metric.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3.5">Object Identifier</th>
                          {attributeColumns.map((col) => (
                            <th key={col} className="py-2.5 px-3.5">
                              {col}
                            </th>
                          ))}
                          <th className="py-2.5 px-3.5">Overall Status</th>
                          <th className="py-2.5 px-3.5">Last Measured (UTC+7)</th>
                          <th className="py-2.5 px-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {objectRows.map((row) => {
                          const statusBadge =
                            row.status === 'CRITICAL' || row.status === 'DOWN'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : row.status === 'WARNING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200';

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
                              <td className="py-2.5 px-3.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                                  {row.status}
                                </span>
                              </td>
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
                                  Chart Object
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
