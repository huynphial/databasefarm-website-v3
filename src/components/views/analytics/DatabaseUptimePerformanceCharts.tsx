import React, { useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Timer,
  Activity,
  Zap,
  Clock,
  Radio,
  BarChart2,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Line,
  ComposedChart,
} from 'recharts';
import { DatabasePollLogEntity, DatabaseEntity } from '../../../types';
import { formatTimeVN } from '../../../lib/utils';
import { useLanguage } from '../../../i18n/LanguageContext';

interface DatabaseUptimePerformanceChartsProps {
  selectedDb: DatabaseEntity | undefined;
  pollLogs: DatabasePollLogEntity[];
  timePreset?: string;
  fromDateTime?: string;
  toDateTime?: string;
  isLoading?: boolean;
}

interface PollChartPoint {
  id: string;
  key: string;
  timestamp: number;
  timeLabel: string;
  fullTimeLabel: string;
  dbName: string;
  latencyMs: number;
  status: string;
  isSuccess: boolean;
  uptimeRatio: number; // 0-100%
  errorMessage?: string | null;
}

export const DatabaseUptimePerformanceCharts: React.FC<DatabaseUptimePerformanceChartsProps> = ({
  selectedDb,
  pollLogs,
  timePreset = '24h',
  fromDateTime,
  toDateTime,
  isLoading = false,
}) => {
  const { t } = useLanguage();

  // Compute exact filter boundary timestamps
  const filterBounds = useMemo(() => {
    const now = Date.now();
    let startMs = now - 24 * 3600 * 1000;
    let endMs = now;

    if (timePreset === '1h') {
      startMs = now - 1 * 3600 * 1000;
      endMs = now;
    } else if (timePreset === '6h') {
      startMs = now - 6 * 3600 * 1000;
      endMs = now;
    } else if (timePreset === '24h') {
      startMs = now - 24 * 3600 * 1000;
      endMs = now;
    } else if (timePreset === '7d') {
      startMs = now - 7 * 86400 * 1000;
      endMs = now;
    } else if (timePreset === 'custom') {
      if (fromDateTime) {
        const parsedFrom = new Date(fromDateTime).getTime();
        if (!isNaN(parsedFrom)) startMs = parsedFrom;
      }
      if (toDateTime) {
        const parsedTo = new Date(toDateTime).getTime();
        if (!isNaN(parsedTo)) endMs = parsedTo;
      }
    }

    return { startMs, endMs };
  }, [timePreset, fromDateTime, toDateTime]);

  // Filter logs for the selected database AND strictly within the active time filter range
  const filteredLogs = useMemo(() => {
    if (!pollLogs || pollLogs.length === 0) return [];
    
    const targetId = selectedDb && selectedDb.id && selectedDb.id !== 'ALL'
      ? String(selectedDb.id).trim().toLowerCase()
      : null;
    const targetName = selectedDb && selectedDb.name && selectedDb.id !== 'ALL'
      ? selectedDb.name.trim().toLowerCase()
      : null;

    return pollLogs.filter((log) => {
      // 1. Database matching
      if (targetId) {
        const logId = String(log.dbId || '').trim().toLowerCase();
        const logName = String(log.dbName || '').trim().toLowerCase();
        const matchId = logId === targetId;
        const matchName = targetName && logName === targetName;
        if (!matchId && !matchName) return false;
      }

      // 2. Time range filtering
      const logStartMs = new Date(log.startedAt).getTime();
      if (isNaN(logStartMs)) return false;
      if (logStartMs < filterBounds.startMs || logStartMs > filterBounds.endMs) {
        return false;
      }

      return true;
    });
  }, [pollLogs, selectedDb, filterBounds]);

  // Calculations for overall summary statistics within filtered window
  const metrics = useMemo(() => {
    if (filteredLogs.length === 0) {
      return {
        totalPolls: 0,
        successPolls: 0,
        failedPolls: 0,
        uptimePercentage: 100,
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        p95LatencyMs: 0,
      };
    }

    let successCount = 0;
    let failedCount = 0;
    const latencies: number[] = [];

    filteredLogs.forEach((log) => {
      const isSuccess = (log.status || '').toLowerCase() === 'success';
      if (isSuccess) {
        successCount++;
      } else {
        failedCount++;
      }

      const startMs = new Date(log.startedAt).getTime();
      const finishMs = new Date(log.finishedAt).getTime();
      if (!isNaN(startMs) && !isNaN(finishMs) && finishMs >= startMs) {
        latencies.push(finishMs - startMs);
      } else {
        latencies.push(0);
      }
    });

    const total = filteredLogs.length;
    const uptimePct = total > 0 ? (successCount / total) * 100 : 100;

    let avgLatency = 0;
    let minLatency = 0;
    let maxLatency = 0;
    let p95Latency = 0;

    if (latencies.length > 0) {
      const sum = latencies.reduce((a, b) => a + b, 0);
      avgLatency = Math.round(sum / latencies.length);
      minLatency = Math.min(...latencies);
      maxLatency = Math.max(...latencies);

      const sorted = [...latencies].sort((a, b) => a - b);
      const p95Idx = Math.floor(sorted.length * 0.95);
      p95Latency = sorted[Math.min(p95Idx, sorted.length - 1)];
    }

    return {
      totalPolls: total,
      successPolls: successCount,
      failedPolls: failedCount,
      uptimePercentage: uptimePct,
      avgLatencyMs: avgLatency,
      minLatencyMs: minLatency,
      maxLatencyMs: maxLatency,
      p95LatencyMs: p95Latency,
    };
  }, [filteredLogs]);

  // Generate complete time series data points corresponding directly to the filter
  const timeSeriesData = useMemo(() => {
    if (filteredLogs.length === 0) return [];

    // Sort chronologically (oldest to newest for charting)
    const sorted = [...filteredLogs].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );

    let rollingSuccess = 0;
    let rollingTotal = 0;

    // Direct mapping of all poll log points to preserve high-fidelity filter representation
    const points: PollChartPoint[] = sorted.map((log, idx) => {
      const startMs = new Date(log.startedAt).getTime();
      const finishMs = new Date(log.finishedAt).getTime();
      const latency = !isNaN(startMs) && !isNaN(finishMs) && finishMs >= startMs
        ? finishMs - startMs
        : 0;
      const isSuccess = (log.status || '').toLowerCase() === 'success';

      rollingTotal++;
      if (isSuccess) rollingSuccess++;
      const currentUptime = Number(((rollingSuccess / rollingTotal) * 100).toFixed(2));

      // Friendly time label depending on timePreset span
      const d = new Date(startMs);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;
      const isMultiDay = (filterBounds.endMs - filterBounds.startMs) > 36 * 3600 * 1000;
      const displayLabel = isMultiDay
        ? `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`
        : timeStr;

      return {
        id: log.id || `point-${idx}`,
        key: `${log.id || idx}-${startMs}`,
        timestamp: startMs,
        timeLabel: displayLabel,
        fullTimeLabel: formatTimeVN(log.startedAt),
        dbName: log.dbName || selectedDb?.name || 'Database',
        latencyMs: latency,
        status: log.status || (isSuccess ? 'success' : 'failed'),
        isSuccess,
        uptimeRatio: currentUptime,
        errorMessage: log.errorMessage,
      };
    });

    return points;
  }, [filteredLogs, filterBounds, selectedDb?.name]);

  // Generate visual status timeline strip across the entire selected time filter
  const timelineSlices = useMemo(() => {
    const sliceCount = 40;
    const minTime = filterBounds.startMs;
    const maxTime = filterBounds.endMs;
    const sliceSpan = (maxTime - minTime) / sliceCount || 1;

    const sorted = [...filteredLogs].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );

    const slices = Array.from({ length: sliceCount }, (_, i) => {
      const sliceStart = minTime + i * sliceSpan;
      const sliceEnd = sliceStart + sliceSpan;
      const inSlice = sorted.filter((l) => {
        const t = new Date(l.startedAt).getTime();
        return t >= sliceStart && (i === sliceCount - 1 ? t <= sliceEnd : t < sliceEnd);
      });

      if (inSlice.length === 0) {
        return {
          id: i,
          status: 'NO_DATA' as const,
          pct: 100,
          label: formatTimeVN(new Date(sliceStart).toISOString()),
          total: 0,
          success: 0,
        };
      }

      const success = inSlice.filter((l) => (l.status || '').toLowerCase() === 'success').length;
      const pct = (success / inSlice.length) * 100;
      let status: 'UP' | 'DEGRADED' | 'DOWN' = 'UP';
      if (pct < 50) status = 'DOWN';
      else if (pct < 100) status = 'DEGRADED';

      return {
        id: i,
        status,
        pct: Math.round(pct),
        label: formatTimeVN(new Date(sliceStart).toISOString()),
        total: inSlice.length,
        success,
      };
    });

    return slices;
  }, [filteredLogs, filterBounds]);

  const uptimeClass =
    metrics.uptimePercentage >= 99
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : metrics.uptimePercentage >= 95
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  const latencyClass =
    metrics.avgLatencyMs < 100
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : metrics.avgLatencyMs < 500
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : metrics.avgLatencyMs < 1500
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs animate-pulse h-80 flex flex-col justify-between">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-44 bg-slate-100 rounded-xl"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs animate-pulse h-80 flex flex-col justify-between">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-44 bg-slate-100 rounded-xl"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" id="analytics-uptime-performance-section">
      {/* =========================================================
          CHART 1: Database Uptime & Uptime Ratio
          Base on database_poll_log.started_at and status ('success' vs not 'success')
         ========================================================= */}
      <div
        id="chart-database-uptime"
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
      >
        {/* Header with Title & KPI Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Uptime & Availability Ratio</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                  database_poll_log
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Calculated from probe poll execution status and timestamps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${uptimeClass}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{metrics.uptimePercentage.toFixed(2)}% Uptime</span>
            </div>
          </div>
        </div>

        {/* Metric Counter Summary Cards */}
        <div className="grid grid-cols-4 gap-2 my-3">
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 text-center">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Uptime Ratio</div>
            <div className="text-lg font-black text-slate-900">{metrics.uptimePercentage.toFixed(1)}%</div>
          </div>
          <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-2.5 text-center">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Successful</div>
            <div className="text-lg font-black text-emerald-700">{metrics.successPolls.toLocaleString()}</div>
          </div>
          <div className="bg-rose-50/60 border border-rose-200/60 rounded-xl p-2.5 text-center">
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Failed / Down</div>
            <div className="text-lg font-black text-rose-700">{metrics.failedPolls.toLocaleString()}</div>
          </div>
          <div className="bg-indigo-50/60 border border-indigo-200/60 rounded-xl p-2.5 text-center">
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Filter Data Points</div>
            <div className="text-lg font-black text-indigo-900">{timeSeriesData.length.toLocaleString()}</div>
          </div>
        </div>

        {/* Visual Uptime SLA Strip */}
        <div className="my-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
              Status Timeline Strip
            </span>
            <span className="text-slate-500">
              Showing {timeSeriesData.length} records in filter
            </span>
          </div>
          <div className="flex items-center gap-1 w-full bg-slate-100 p-1.5 rounded-lg border border-slate-200">
            {timelineSlices.map((slice) => {
              let bg = 'bg-emerald-500 hover:bg-emerald-600';
              if (slice.status === 'DEGRADED') bg = 'bg-amber-400 hover:bg-amber-500';
              else if (slice.status === 'DOWN') bg = 'bg-rose-500 hover:bg-rose-600';
              else if (slice.status === 'NO_DATA') bg = 'bg-slate-300';

              return (
                <div
                  key={slice.id}
                  title={`${slice.label}: ${slice.pct}% success (${slice.success || 0}/${slice.total || 0})`}
                  className={`flex-1 h-5 rounded-xs transition-all duration-150 cursor-pointer ${bg}`}
                />
              );
            })}
          </div>
        </div>

        {/* Interactive Uptime Ratio Area Chart */}
        <div className="mt-2 h-44 w-full">
          {timeSeriesData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-4 text-center">
              <Activity className="w-8 h-8 mb-1.5 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No poll log telemetry found for selected filter</p>
              <p className="text-[11px] text-slate-400">Database poll scheduler records will populate automatically upon polling</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as PollChartPoint;
                      return (
                        <div className="bg-slate-900/95 text-white p-2.5 rounded-xl shadow-xl text-xs backdrop-blur-xs border border-slate-800 space-y-1 z-50">
                          <div className="font-bold text-slate-200 border-b border-slate-700/60 pb-1 flex items-center justify-between gap-3">
                            <span>{data.fullTimeLabel}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                data.isSuccess
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {data.isSuccess ? 'PROBE SUCCESS' : 'PROBE FAILED'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-300 pt-0.5">
                            <div>Database: <span className="font-bold text-white">{data.dbName}</span></div>
                            <div>Response Time: <span className="font-bold text-blue-400">{data.latencyMs} ms</span></div>
                            <div className="col-span-2">
                              Cumulative Availability: <span className="font-bold text-emerald-400">{data.uptimeRatio}%</span>
                            </div>
                            {data.errorMessage && (
                              <div className="col-span-2 text-rose-300 font-mono text-[10px] break-words pt-1 border-t border-slate-800">
                                Error: {data.errorMessage}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" opacity={0.6} />
                <Area
                  type="monotone"
                  dataKey="uptimeRatio"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#uptimeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* =========================================================
          CHART 2: Average Response Time of Query
          Base on database_poll_log finished_at - started_at
         ========================================================= */}
      <div
        id="chart-database-response-time"
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
      >
        {/* Header with Title & KPI Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Query & Probe Response Time</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                  finished_at - started_at
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                End-to-end network & execution latency of poll queries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${latencyClass}`}>
              <Zap className="w-3.5 h-3.5" />
              <span>Avg: {metrics.avgLatencyMs} ms</span>
            </div>
          </div>
        </div>

        {/* Metric Counter Summary Cards */}
        <div className="grid grid-cols-4 gap-2 my-3">
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 text-center">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Latency</div>
            <div className="text-lg font-black text-slate-900">
              {metrics.avgLatencyMs >= 1000 ? `${(metrics.avgLatencyMs / 1000).toFixed(2)}s` : `${metrics.avgLatencyMs}ms`}
            </div>
          </div>
          <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-2.5 text-center">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Min Fast</div>
            <div className="text-lg font-black text-emerald-700">{metrics.minLatencyMs}ms</div>
          </div>
          <div className="bg-indigo-50/60 border border-indigo-200/60 rounded-xl p-2.5 text-center">
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">P95 Latency</div>
            <div className="text-lg font-black text-indigo-900">{metrics.p95LatencyMs}ms</div>
          </div>
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-2.5 text-center">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Max Peak</div>
            <div className="text-lg font-black text-amber-800">
              {metrics.maxLatencyMs >= 1000 ? `${(metrics.maxLatencyMs / 1000).toFixed(2)}s` : `${metrics.maxLatencyMs}ms`}
            </div>
          </div>
        </div>

        {/* Latency Threshold Reference Bar */}
        <div className="my-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" />
              Latency Distribution Spectrum
            </span>
            <span className="text-slate-600 font-mono font-semibold">
              Min: {metrics.minLatencyMs}ms | Avg: {metrics.avgLatencyMs}ms | Max: {metrics.maxLatencyMs}ms
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex border border-slate-200">
            <div
              className="bg-emerald-500 h-full"
              style={{
                width: `${Math.min(100, Math.max(10, (metrics.minLatencyMs / Math.max(1, metrics.maxLatencyMs)) * 100))}%`,
              }}
              title="Fastest query window"
            />
            <div
              className="bg-blue-500 h-full"
              style={{
                width: `${Math.min(100, Math.max(15, (metrics.avgLatencyMs / Math.max(1, metrics.maxLatencyMs)) * 100))}%`,
              }}
              title="Average query latency"
            />
            <div className="bg-amber-400 h-full flex-1" title="Peak query latency" />
          </div>
        </div>

        {/* Interactive Response Time Area Chart */}
        <div className="mt-2 h-44 w-full">
          {timeSeriesData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-4 text-center">
              <Timer className="w-8 h-8 mb-1.5 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No response latency data recorded for selected filter</p>
              <p className="text-[11px] text-slate-400">Response time telemetry will be plotted automatically upon database polling</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  unit="ms"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as PollChartPoint;
                      return (
                        <div className="bg-slate-900/95 text-white p-2.5 rounded-xl shadow-xl text-xs backdrop-blur-xs border border-slate-800 space-y-1 z-50">
                          <div className="font-bold text-slate-200 border-b border-slate-700/60 pb-1 flex items-center justify-between gap-3">
                            <span>{data.fullTimeLabel}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                              data.isSuccess
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {data.latencyMs} ms {data.isSuccess ? '' : '(FAILED)'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-300 pt-0.5">
                            <div>Database: <span className="font-bold text-white">{data.dbName}</span></div>
                            <div>Status: <span className={`font-bold ${data.isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>{data.status}</span></div>
                            <div className="col-span-2">Point Latency: <span className="font-bold text-blue-300">{data.latencyMs} ms</span></div>
                            {data.errorMessage && (
                              <div className="col-span-2 text-rose-300 font-mono text-[10px] break-words pt-1 border-t border-slate-800">
                                Error: {data.errorMessage}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {metrics.avgLatencyMs > 0 && (
                  <ReferenceLine
                    y={metrics.avgLatencyMs}
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    label={{
                      value: `Avg: ${metrics.avgLatencyMs}ms`,
                      fill: '#3b82f6',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="latencyMs"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#latencyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
