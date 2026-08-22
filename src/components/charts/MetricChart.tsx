import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';
import { formatTimeVN } from '../../lib/utils';

interface MetricChartProps {
  data: {
    id: string;
    createdAt: string;
    value: number;
    formattedTime?: string;
  }[];
  metricName: string;
  chartType?: 'line' | 'area';
  thresholdWarn?: number | null;
  thresholdHigh?: number | null;
  thresholdCritical?: number | null;
}

export const MetricChart: React.FC<MetricChartProps> = ({
  data,
  metricName,
  chartType = 'area',
  thresholdWarn,
  thresholdHigh,
  thresholdCritical,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm font-medium">No time-series data available for the selected filters.</p>
        <span className="text-xs text-slate-400 mt-1">Try selecting a different database, metric, or broader date range.</span>
      </div>
    );
  }

  // Format data timestamps for X-Axis
  const chartData = data.map((item) => ({
    ...item,
    formattedTime: formatTimeVN(item.createdAt),
    shortTime: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(new Date(item.createdAt)),
  }));

  const gridColor = '#f1f5f9';
  const axisTextColor = '#64748b';
  const tooltipBg = '#ffffff';
  const tooltipBorder = '#e2e8f0';
  const tooltipText = '#0f172a';

  return (
    <div className="w-full h-80 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 tracking-tight">{metricName} Trend</h4>
          <p className="text-xs text-slate-500">Values in UTC+7 (Asia/Ho_Chi_Minh)</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {thresholdWarn !== null && thresholdWarn !== undefined && (
            <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
              <span className="w-2.5 h-0.5 bg-amber-500 inline-block" />
              <span>Warn: {thresholdWarn}</span>
            </div>
          )}
          {thresholdHigh !== null && thresholdHigh !== undefined && (
            <div className="flex items-center gap-1.5 text-orange-600 font-semibold">
              <span className="w-2.5 h-0.5 bg-orange-500 inline-block" />
              <span>High: {thresholdHigh}</span>
            </div>
          )}
          {thresholdCritical !== null && thresholdCritical !== undefined && (
            <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
              <span className="w-2.5 h-0.5 bg-rose-500 inline-block" />
              <span>Crit: {thresholdCritical}</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="shortTime"
                stroke={axisTextColor}
                tick={{ fontSize: 10, fill: axisTextColor }}
                tickLine={false}
              />
              <YAxis
                stroke={axisTextColor}
                tick={{ fontSize: 10, fill: axisTextColor }}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderColor: tooltipBorder,
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: tooltipText,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelFormatter={(_, payload) => {
                  if (payload && payload.length > 0) {
                    return payload[0].payload.formattedTime;
                  }
                  return '';
                }}
                formatter={(val: any) => [val, metricName]}
              />
              {thresholdWarn !== null && thresholdWarn !== undefined && (
                <ReferenceLine y={thresholdWarn} stroke="#f59e0b" strokeDasharray="3 3" />
              )}
              {thresholdHigh !== null && thresholdHigh !== undefined && (
                <ReferenceLine y={thresholdHigh} stroke="#f97316" strokeDasharray="3 3" />
              )}
              {thresholdCritical !== null && thresholdCritical !== undefined && (
                <ReferenceLine y={thresholdCritical} stroke="#f43f5e" strokeDasharray="3 3" />
              )}
              <Area
                type="monotone"
                dataKey="value"
                name={metricName}
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#metricGradient)"
                activeDot={{ r: 4, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="shortTime"
                stroke={axisTextColor}
                tick={{ fontSize: 10, fill: axisTextColor }}
                tickLine={false}
              />
              <YAxis
                stroke={axisTextColor}
                tick={{ fontSize: 10, fill: axisTextColor }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderColor: tooltipBorder,
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: tooltipText,
                }}
                formatter={(val: any) => [val, metricName]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
