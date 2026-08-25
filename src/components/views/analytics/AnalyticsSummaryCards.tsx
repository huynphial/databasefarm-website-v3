import React from 'react';
import {
  Server,
  Activity,
  ShieldAlert,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { DatabaseEntity, MetricEntity, ActiveAlertEntity } from '../../../types';
import { getDbEngineBadgeClass } from '../../../config/dbEngines';

interface AnalyticsSummaryCardsProps {
  selectedDb: DatabaseEntity | undefined;
  applicableMetricsCount: number;
  activeAlerts: ActiveAlertEntity[];
  telemetryPointsCount: number;
}

export const AnalyticsSummaryCards: React.FC<AnalyticsSummaryCardsProps> = ({
  selectedDb,
  applicableMetricsCount,
  activeAlerts,
  telemetryPointsCount,
}) => {
  if (!selectedDb) return null;

  const dbStatusUpper = (selectedDb.status || '').toUpperCase();
  const isPaused = selectedDb.isEnabled === false;

  const statusColorClass = isPaused
    ? 'text-slate-500 bg-slate-100 border-slate-200'
    : dbStatusUpper === 'DOWN'
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : dbStatusUpper === 'WARNING' || dbStatusUpper === 'WARN'
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  const statusLabel = isPaused ? 'PAUSED' : dbStatusUpper || 'HEALTHY';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Target Database Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <Server className="w-4 h-4 text-indigo-500" />
            Target Instance
          </span>
          <span className={`px-2 py-0.5 rounded border text-[10px] font-extrabold ${getDbEngineBadgeClass(selectedDb.dbType)}`}>
            {selectedDb.dbType}
          </span>
        </div>
        <div>
          <h4 className="text-base font-bold text-slate-900 truncate">{selectedDb.name}</h4>
          <p className="text-xs text-slate-500 font-mono truncate">{selectedDb.host}:{selectedDb.port}</p>
        </div>
        <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100">
          <span className="text-slate-500 font-medium">Status</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusColorClass}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Card 2: Active Probes */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-500" />
            Configured Probes
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">
            {applicableMetricsCount} Active
          </span>
        </div>
        <div>
          <div className="text-2xl font-extrabold text-slate-900">{applicableMetricsCount}</div>
          <p className="text-xs text-slate-500">Assigned telemetry metrics</p>
        </div>
        <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100">
          <span className="text-slate-500 font-medium">Poll Cycle</span>
          <span className="font-mono text-slate-700 font-bold">{selectedDb.pollIntervalMinutes || 5} min</span>
        </div>
      </div>

      {/* Card 3: Active Alerts */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Active Alerts
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
            activeAlerts.length > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {activeAlerts.length} Fired
          </span>
        </div>
        <div>
          <div className={`text-2xl font-extrabold ${activeAlerts.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {activeAlerts.length}
          </div>
          <p className="text-xs text-slate-500">Open threshold alerts</p>
        </div>
        <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100">
          <span className="text-slate-500 font-medium">Severity Status</span>
          <span className="font-bold text-slate-700">
            {activeAlerts.length > 0 ? `${activeAlerts.filter(a => a.alertLevel === 'CRITICAL' || a.alertLevel === 'DOWN').length} Critical` : 'All Clear'}
          </span>
        </div>
      </div>

      {/* Card 4: Telemetry Data Points */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-indigo-500" />
            metric_data_points
          </span>
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold">
            DB Telemetry
          </span>
        </div>
        <div>
          <div className="text-2xl font-extrabold text-slate-900">{telemetryPointsCount}</div>
          <p className="text-xs text-slate-500">Recorded telemetry data points</p>
        </div>
        <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-100">
          <span className="text-slate-500 font-medium">Source Table</span>
          <span className="font-mono text-indigo-700 font-bold text-[11px]">metric_data_points</span>
        </div>
      </div>
    </div>
  );
};
