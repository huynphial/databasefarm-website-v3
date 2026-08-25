import React, { useState, useMemo, ForwardedRef } from 'react';
import {
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  Table as TableIcon,
  Gauge,
  TrendingUp,
  Layers,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { MetricEntity } from '../../../types';
import { UnifiedMeasurement, OBJECT_COLORS, parseNumericValue } from './analyticsUtils';
import { formatTimeVN } from '../../../lib/utils';

interface TelemetryVisualizerProps {
  applicableMetrics: MetricEntity[];
  unifiedMeasurements: UnifiedMeasurement[];
  chartMetricId: string;
  setChartMetricId: (id: string) => void;
  chartAttributeName: string;
  setChartAttributeName: (attr: string) => void;
  chartObjectName: string;
  setChartObjectName: (obj: string) => void;
}

export const TelemetryVisualizer = React.forwardRef<HTMLDivElement, TelemetryVisualizerProps>(
  (
    {
      applicableMetrics,
      unifiedMeasurements,
      chartMetricId,
      setChartMetricId,
      chartAttributeName,
      setChartAttributeName,
      chartObjectName,
      setChartObjectName,
    },
    ref
  ) => {
    const [chartType, setChartType] = useState<'area' | 'line' | 'table'>('area');
    const [historyPage, setHistoryPage] = useState<number>(1);
    const [historySearch, setHistorySearch] = useState<string>('');
    const [historySortOrder, setHistorySortOrder] = useState<'desc' | 'asc'>('desc');
    const pageSize = 10;

    const selectedMetric = applicableMetrics.find((m) => m.id === chartMetricId) || applicableMetrics[0];

    // Discover numeric attribute names for selected metric from unified measurements (includes metric_data_points)
    const numericAttributesForChart = useMemo(() => {
      if (!selectedMetric) return [{ key: 'value', label: 'value' }];

      const metricPoints = unifiedMeasurements.filter((m) => m.metricId === selectedMetric.id);
      const attrSet = new Set<string>();

      // Check perAttribute threshold configs if available
      if (selectedMetric.thresholdsConfig?.perAttribute) {
        selectedMetric.thresholdsConfig.perAttribute.forEach((a) => {
          if (a.valueType === 'NUMBER' || !a.valueType) {
            attrSet.add(a.attributeName);
          }
        });
      }

      metricPoints.forEach((p) => {
        if (p.attributeName) {
          attrSet.add(p.attributeName);
        }
      });

      if (attrSet.size === 0) {
        attrSet.add('value');
      }

      return Array.from(attrSet).map((attr) => ({ key: attr, label: attr }));
    }, [selectedMetric, unifiedMeasurements]);

    // Discover target objects for selected metric from unified measurements (includes metric_data_points)
    const availableObjectsForChart = useMemo(() => {
      if (!selectedMetric) return [];
      const metricPoints = unifiedMeasurements.filter((m) => m.metricId === selectedMetric.id);
      const objSet = new Set<string>();
      metricPoints.forEach((p) => {
        if (p.objectName) objSet.add(p.objectName);
      });
      return Array.from(objSet);
    }, [selectedMetric, unifiedMeasurements]);

    // Build time-series chart data points
    const chartDataResult = useMemo(() => {
      if (!selectedMetric) {
        return { timeSeriesData: [], objects: [], stats: { latest: '0', max: '0', min: '0', avg: '0', count: 0 } };
      }

      let filtered = unifiedMeasurements.filter((m) => m.metricId === selectedMetric.id);

      if (chartAttributeName) {
        filtered = filtered.filter((m) => m.attributeName === chartAttributeName || !m.attributeName);
      }

      const objectsSet = new Set<string>();
      filtered.forEach((m) => {
        if (m.objectName) objectsSet.add(m.objectName);
      });
      const objectList = Array.from(objectsSet);
      if (objectList.length === 0) objectList.push('INSTANCE');

      // Group points by formatted timestamp
      const timeGroupMap = new Map<string, Record<string, any>>();
      const numericValues: number[] = [];

      // Process points in chronological order (oldest first for chart)
      const chronPoints = [...filtered].reverse();

      chronPoints.forEach((point) => {
        const timeKey = formatTimeVN(point.measuredAt);
        if (!timeGroupMap.has(timeKey)) {
          timeGroupMap.set(timeKey, { time: timeKey, rawTime: point.measuredAt });
        }
        const item = timeGroupMap.get(timeKey)!;
        const objKey = point.objectName || 'INSTANCE';
        const numVal = parseNumericValue(point.value);
        item[objKey] = numVal;
        numericValues.push(numVal);
      });

      const timeSeriesData = Array.from(timeGroupMap.values());

      // Calculate statistical metrics
      let latest = '0';
      let max = '0';
      let min = '0';
      let avg = '0';
      if (numericValues.length > 0) {
        latest = String(numericValues[numericValues.length - 1]);
        max = String(Math.max(...numericValues));
        min = String(Math.min(...numericValues));
        const sum = numericValues.reduce((a, b) => a + b, 0);
        avg = (sum / numericValues.length).toFixed(1);
      }

      return {
        timeSeriesData,
        objects: chartObjectName === 'ALL' ? objectList : [chartObjectName],
        stats: { latest, max, min, avg, count: numericValues.length },
      };
    }, [selectedMetric, unifiedMeasurements, chartAttributeName, chartObjectName]);

    // Threshold values for guide line
    const chartThresholds = useMemo(() => {
      if (!selectedMetric) return { warn: null, high: null, crit: null };
      return {
        warn: selectedMetric.thresholdWarn ? parseNumericValue(selectedMetric.thresholdWarn) : null,
        high: selectedMetric.thresholdHigh ? parseNumericValue(selectedMetric.thresholdHigh) : null,
        crit: selectedMetric.thresholdCritical ? parseNumericValue(selectedMetric.thresholdCritical) : null,
      };
    }, [selectedMetric]);

    // Detailed history table data
    const historyTableItems = useMemo(() => {
      if (!selectedMetric) return [];
      let items = unifiedMeasurements.filter((m) => m.metricId === selectedMetric.id);

      if (chartAttributeName) {
        items = items.filter((m) => m.attributeName === chartAttributeName || !m.attributeName);
      }
      if (chartObjectName !== 'ALL') {
        items = items.filter((m) => m.objectName === chartObjectName);
      }

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        items = items.filter(
          (m) =>
            m.objectName.toLowerCase().includes(q) ||
            m.value.toLowerCase().includes(q) ||
            m.status.toLowerCase().includes(q)
        );
      }

      items.sort((a, b) => {
        const tA = new Date(a.measuredAt).getTime();
        const tB = new Date(b.measuredAt).getTime();
        return historySortOrder === 'desc' ? tB - tA : tA - tB;
      });

      return items;
    }, [selectedMetric, unifiedMeasurements, chartAttributeName, chartObjectName, historySearch, historySortOrder]);

    const totalPages = Math.ceil(historyTableItems.length / pageSize) || 1;
    const paginatedHistory = historyTableItems.slice((historyPage - 1) * pageSize, historyPage * pageSize);

    const handleExportCSV = () => {
      if (historyTableItems.length === 0) return;
      const headers = ['Measured At (UTC+7)', 'Metric Name', 'Object Identifier', 'Attribute Name', 'Measured Value', 'Status'];
      const rows = historyTableItems.map((item) => [
        `"${formatTimeVN(item.measuredAt)}"`,
        `"${item.metricName || selectedMetric?.name || ''}"`,
        `"${item.objectName}"`,
        `"${item.attributeName}"`,
        `"${item.value}"`,
        `"${item.status}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `telemetry_${selectedMetric?.name || 'metric'}_${chartAttributeName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div
        ref={ref}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-5"
      >
        {/* Chart Control Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <LineChartIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Interactive Performance & Telemetry Visualizer
              </h3>
              <p className="text-xs text-slate-500">
                Plot responsive time-series trends reading directly from database metric_data_points
              </p>
            </div>
          </div>

          {/* Chart View Toggle */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartType === 'area' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <AreaChartIcon className="w-3.5 h-3.5" />
                Area
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartType === 'line' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
                Line
              </button>
              <button
                type="button"
                onClick={() => setChartType('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartType === 'table' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                History Table
              </button>
            </div>
          </div>
        </div>

        {/* 3 Selectors: Metric, Attribute, Object */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selector 1: Choose Metric */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-indigo-500" />
              1. Choose Metric Check *
            </label>
            <div className="relative">
              <select
                value={chartMetricId}
                onChange={(e) => setChartMetricId(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
              >
                {applicableMetrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.metricQueryType ? `Type ${m.metricQueryType}` : 'Type 1'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Selector 2: Choose Attribute (Number Only) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              2. Choose Attribute (Only Number) *
            </label>
            <div className="relative">
              <select
                value={chartAttributeName}
                onChange={(e) => setChartAttributeName(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
              >
                {numericAttributesForChart.map((attr) => (
                  <option key={attr.key} value={attr.key}>
                    {attr.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Selector 3: Choose Object */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              3. Choose Object (Optional)
            </label>
            <div className="relative">
              <select
                value={chartObjectName}
                onChange={(e) => setChartObjectName(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
              >
                <option value="ALL">ALL (Compare All Objects)</option>
                {availableObjectsForChart.map((obj) => (
                  <option key={obj} value={obj}>
                    Object: {obj}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Quick Stat Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latest Value</div>
            <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">{chartDataResult.stats.latest}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maximum Peak</div>
            <div className="text-base font-extrabold text-rose-600 font-mono mt-0.5">{chartDataResult.stats.max}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Minimum Value</div>
            <div className="text-base font-extrabold text-emerald-600 font-mono mt-0.5">{chartDataResult.stats.min}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Value</div>
            <div className="text-base font-extrabold text-indigo-600 font-mono mt-0.5">{chartDataResult.stats.avg}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Samples Collected</div>
            <div className="text-base font-extrabold text-slate-700 font-mono mt-0.5">{chartDataResult.stats.count} pts</div>
          </div>
        </div>

        {/* Chart Canvas or Data Table */}
        {chartType === 'table' ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search history data points..."
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-1.5 focus:outline-none focus:border-indigo-500 w-64"
              />
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th
                      className="py-2.5 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => setHistorySortOrder(historySortOrder === 'desc' ? 'asc' : 'desc')}
                    >
                      <div className="flex items-center gap-1">
                        Measured At (UTC+7)
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3.5">Object Identifier</th>
                    <th className="py-2.5 px-3.5">Attribute Name</th>
                    <th className="py-2.5 px-3.5">Measured Value</th>
                    <th className="py-2.5 px-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                        No telemetry history points found in metric_data_points table for this selection.
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono text-slate-600">{formatTimeVN(row.measuredAt)}</td>
                        <td className="py-2.5 px-3.5 font-bold font-mono text-slate-900">{row.objectName}</td>
                        <td className="py-2.5 px-3.5 font-mono text-slate-600">{row.attributeName}</td>
                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">{row.value}</td>
                        <td className="py-2.5 px-3.5 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            row.status === 'CRITICAL' || row.status === 'DOWN'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : row.status === 'WARNING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <div>
                  Showing {(historyPage - 1) * pageSize + 1} to {Math.min(historyPage * pageSize, historyTableItems.length)} of {historyTableItems.length} records
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="px-2 font-bold font-mono text-slate-800">
                    {historyPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={historyPage === totalPages}
                    onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-72 w-full pt-2">
            {chartDataResult.timeSeriesData.length === 0 ? (
              <div className="h-full bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                No telemetry time-series points available in database table metric_data_points.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={chartDataResult.timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      {chartDataResult.objects.map((obj, i) => (
                        <linearGradient key={obj} id={`grad_${obj}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={OBJECT_COLORS[i % OBJECT_COLORS.length]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={OBJECT_COLORS[i % OBJECT_COLORS.length]} stopOpacity={0.0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    {chartThresholds.warn !== null && (
                      <ReferenceLine y={chartThresholds.warn} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `Warn (${chartThresholds.warn})`, fill: '#d97706', fontSize: 10 }} />
                    )}
                    {chartThresholds.high !== null && (
                      <ReferenceLine y={chartThresholds.high} stroke="#f97316" strokeDasharray="3 3" label={{ value: `High (${chartThresholds.high})`, fill: '#ea580c', fontSize: 10 }} />
                    )}
                    {chartThresholds.crit !== null && (
                      <ReferenceLine y={chartThresholds.crit} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: `Crit (${chartThresholds.crit})`, fill: '#e11d48', fontSize: 10 }} />
                    )}
                    {chartDataResult.objects.map((obj, i) => (
                      <Area
                        key={obj}
                        type="monotone"
                        dataKey={obj}
                        name={obj}
                        stroke={OBJECT_COLORS[i % OBJECT_COLORS.length]}
                        fill={`url(#grad_${obj})`}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                ) : (
                  <LineChart data={chartDataResult.timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    {chartThresholds.warn !== null && (
                      <ReferenceLine y={chartThresholds.warn} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `Warn (${chartThresholds.warn})`, fill: '#d97706', fontSize: 10 }} />
                    )}
                    {chartThresholds.high !== null && (
                      <ReferenceLine y={chartThresholds.high} stroke="#f97316" strokeDasharray="3 3" label={{ value: `High (${chartThresholds.high})`, fill: '#ea580c', fontSize: 10 }} />
                    )}
                    {chartThresholds.crit !== null && (
                      <ReferenceLine y={chartThresholds.crit} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: `Crit (${chartThresholds.crit})`, fill: '#e11d48', fontSize: 10 }} />
                    )}
                    {chartDataResult.objects.map((obj, i) => (
                      <Line
                        key={obj}
                        type="monotone"
                        dataKey={obj}
                        name={obj}
                        stroke={OBJECT_COLORS[i % OBJECT_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    );
  }
);

TelemetryVisualizer.displayName = 'TelemetryVisualizer';
