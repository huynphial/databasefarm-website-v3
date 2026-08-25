import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Search,
  ShieldAlert,
  ArrowUpRight,
  Database,
  Shield,
  Zap,
  Filter,
  Play,
  Pause,
  AlertOctagon
} from 'lucide-react';
import { ActiveAlertEntity, DatabaseEntity, DbEngine, UserRole } from '../../types';
import { DB_ENGINES, getDbEngineBadgeClass, getDbEngineConfig, getDbEngineTagStyle } from '../../config/dbEngines';
import { DataTable, Column } from '../tables/DataTable';
import { formatTimeVN, cn } from '../../lib/utils';
import { useToast } from '../ui/Toast';

interface DashboardViewProps {
  databases: DatabaseEntity[];
  activeAlerts: ActiveAlertEntity[];
  onClearAlert: (alertId: string) => void;
  onRefresh: () => void;
  userRole: UserRole;
  onNavigateToDatabases: () => void;
  onNavigateToAnalytics: (dbId?: string) => void;
  onNavigateToActiveAlerts?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  databases,
  activeAlerts,
  onClearAlert,
  onRefresh,
  userRole,
  onNavigateToDatabases,
  onNavigateToAnalytics,
  onNavigateToActiveAlerts,
}) => {
  const { toast } = useToast();
  const [selectedDbType, setSelectedDbType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Auto Refresh State (1-Minute Timer = 60 Seconds)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          onRefresh();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefreshEnabled, onRefresh]);

  // Filter databases by engine type
  const filteredDatabases = databases.filter((db) => {
    if (selectedDbType === 'ALL') return true;
    return db.dbType === selectedDbType;
  });

  const filteredDbIds = new Set(filteredDatabases.map((db) => db.id));

  // Filter alerts by database engine type
  const dbTypeScopedAlerts = activeAlerts.filter((alert) => filteredDbIds.has(alert.dbId));

  // Derive database statuses for the scoped databases based on table databases column status
  const dbStatuses = filteredDatabases.map((db) => {
    const dbAlerts = activeAlerts.filter((a) => a.dbId === db.id);
    const dbStatusUpper = (db.status || '').toUpperCase();

    let status: 'UP' | 'DOWN' | 'WARN' = 'UP';
    if (dbStatusUpper === 'DOWN') {
      status = 'DOWN';
    } else if (dbStatusUpper === 'WARNING' || dbStatusUpper === 'WARN') {
      status = 'WARN';
    } else if (dbAlerts.some((a) => a.alertLevel === 'WARN' || a.alertLevel === 'HIGH')) {
      status = 'WARN';
    }

    return {
      ...db,
      derivedStatus: status,
      alertCount: dbAlerts.length,
      highestAlert: dbAlerts[0]?.alertLevel || null,
    };
  });

  const upCount = dbStatuses.filter((d) => d.derivedStatus === 'UP').length;
  const downCount = dbStatuses.filter((d) => d.derivedStatus === 'DOWN').length;
  const warnCount = dbStatuses.filter((d) => d.derivedStatus === 'WARN').length;
  const upPercentage = filteredDatabases.length > 0 ? Math.round((upCount / filteredDatabases.length) * 100) : 100;

  const criticalAlertsCount = dbTypeScopedAlerts.filter((a) => a.alertLevel === 'CRITICAL' || a.alertLevel === 'DOWN').length;
  const highAlertsCount = dbTypeScopedAlerts.filter((a) => a.alertLevel === 'HIGH').length;
  const warnAlertsCount = dbTypeScopedAlerts.filter((a) => a.alertLevel === 'WARN').length;

  // Hover Tooltips data resolution
  const affectedDownDbs = dbStatuses
    .filter((d) => d.derivedStatus === 'DOWN')
    .map((d) => ({
      name: d.name,
      count: activeAlerts.filter((a) => a.dbId === d.id && (a.alertLevel === 'CRITICAL' || a.alertLevel === 'DOWN')).length,
    }));

  const affectedCriticalDbs = dbStatuses
    .map((d) => {
      const count = activeAlerts.filter((a) => a.dbId === d.id && (a.alertLevel === 'CRITICAL' || a.alertLevel === 'DOWN')).length;
      return { name: d.name, count };
    })
    .filter((d) => d.count > 0);

  const affectedHighDbs = dbStatuses
    .map((d) => {
      const count = activeAlerts.filter((a) => a.dbId === d.id && a.alertLevel === 'HIGH').length;
      return { name: d.name, count };
    })
    .filter((d) => d.count > 0);

  const affectedWarnDbs = dbStatuses
    .map((d) => {
      const count = activeAlerts.filter((a) => a.dbId === d.id && a.alertLevel === 'WARN').length;
      return { name: d.name, count };
    })
    .filter((d) => d.count > 0);

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Compact Top Filter & Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="font-bold text-slate-900 tracking-tight whitespace-nowrap">Engine Scope:</span>
          <select
            id="dbTypeFilter"
            value={selectedDbType}
            onChange={(e) => {
              setSelectedDbType(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-300 text-xs px-2.5 py-1 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Database Engines ({databases.length})</option>
            {DB_ENGINES.map((engine) => {
              const count = databases.filter((d) => d.dbType === engine.code).length;
              return (
                <option key={engine.code} value={engine.code}>
                  {engine.name} ({engine.code}) - {count}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {/* Auto-Refresh Toggle */}
          <button
            onClick={() => {
              const nextVal = !autoRefreshEnabled;
              setAutoRefreshEnabled(nextVal);
              if (nextVal) setSecondsRemaining(60);
              toast({
                title: nextVal ? 'Auto-Refresh Enabled' : 'Auto-Refresh Paused',
                description: nextVal ? 'Overview metrics will auto-update every 60s.' : 'Auto-refresh paused.',
                type: 'info',
              });
            }}
            className={cn(
              'px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-xs',
              autoRefreshEnabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            )}
            title={autoRefreshEnabled ? 'Pause 60s Auto-Refresh' : 'Enable 60s Auto-Refresh'}
          >
            {autoRefreshEnabled ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auto ({secondsRemaining}s)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-slate-500" />
                <span>Auto OFF</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              onRefresh();
              setSecondsRemaining(60);
              toast({ title: 'Dashboard Refreshed', description: 'Real-time overview metrics updated.', type: 'info' });
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded-lg font-bold transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* 6 Summary Metric Cards with Hover Tooltips & Dynamic Highlighting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* Monitored Databases */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs relative">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Monitored DBs {selectedDbType !== 'ALL' && `(${selectedDbType})`}
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{filteredDatabases.length}</div>
            <div className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded border',
              upPercentage === 100
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            )}>
              {upPercentage}% HEALTHY
            </div>
          </div>
        </div>

        {/* Databases Down Summary Card with Dynamic Red / Green Highlighting + Rich Tooltip */}
        <div className={cn(
          'p-4 rounded-xl border shadow-2xs transition-all relative group cursor-help',
          downCount > 0
            ? 'bg-rose-600 text-white border-rose-700 shadow-rose-200 shadow-sm'
            : 'bg-emerald-50/90 text-emerald-950 border-emerald-300'
        )}>
          <div className={cn(
            'text-[10px] font-bold uppercase tracking-wider mb-1',
            downCount > 0 ? 'text-rose-100' : 'text-emerald-800'
          )}>
            Databases Down
          </div>
          <div className="flex items-end justify-between">
            <div className={cn('text-2xl font-extrabold tracking-tight', downCount > 0 ? 'text-white' : 'text-emerald-700')}>
              {downCount}
            </div>
            <div className={cn(
              'text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border',
              downCount > 0
                ? 'bg-rose-700/80 text-white border-rose-500 animate-pulse'
                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
            )}>
              {downCount > 0 ? 'ATTENTION REQUIRED' : 'ALL INSTANCES UP'}
            </div>
          </div>

          {/* Hover Tooltip */}
          <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
            <div className="font-bold text-rose-400 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              Down Databases ({affectedDownDbs.length})
            </div>
            {affectedDownDbs.length > 0 ? (
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {affectedDownDbs.map((db, idx) => (
                  <div key={idx} className="flex justify-between items-center gap-4">
                    <span className="font-medium text-slate-200 truncate max-w-[120px]" title={db.name}>{db.name}</span>
                    <span className="font-bold text-rose-400 shrink-0">{db.count} alert{db.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 italic">No offline databases</div>
            )}
          </div>
        </div>

        {/* Critical Alerts Summary Card with Rich Tooltip */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs relative group cursor-help">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Critical Alerts
          </div>
          <div className="flex items-end justify-between">
            <div className={cn('text-2xl font-bold tracking-tight', criticalAlertsCount > 0 ? 'text-rose-600' : 'text-slate-400')}>
              {String(criticalAlertsCount).padStart(2, '0')}
            </div>
            <div className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
              criticalAlertsCount > 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-500 bg-slate-100'
            )}>
              {criticalAlertsCount > 0 ? 'ACTION REQUIRED' : 'NOMINAL'}
            </div>
          </div>

          {/* Hover Tooltip */}
          <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
            <div className="font-bold text-rose-400 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              Critical Alert Details
            </div>
            {affectedCriticalDbs.length > 0 ? (
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {affectedCriticalDbs.map((db, idx) => (
                  <div key={idx} className="flex justify-between items-center gap-4">
                    <span className="font-medium text-slate-200 truncate max-w-[120px]" title={db.name}>{db.name}</span>
                    <span className="font-bold text-rose-400 shrink-0">{db.count} alert{db.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 italic">No critical incidents</div>
            )}
          </div>
        </div>

        {/* High Alerts Summary Card with Rich Tooltip */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs relative group cursor-help">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            High Alerts
          </div>
          <div className="flex items-end justify-between">
            <div className={cn('text-2xl font-bold tracking-tight', highAlertsCount > 0 ? 'text-orange-600' : 'text-slate-400')}>
              {String(highAlertsCount).padStart(2, '0')}
            </div>
            <div className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
              highAlertsCount > 0 ? 'text-orange-700 bg-orange-50 border border-orange-200' : 'text-slate-500 bg-slate-100'
            )}>
              {highAlertsCount > 0 ? 'ACTION REQUIRED' : 'NOMINAL'}
            </div>
          </div>

          {/* Hover Tooltip */}
          <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
            <div className="font-bold text-orange-400 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              High Alert Details
            </div>
            {affectedHighDbs.length > 0 ? (
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {affectedHighDbs.map((db, idx) => (
                  <div key={idx} className="flex justify-between items-center gap-4">
                    <span className="font-medium text-slate-200 truncate max-w-[120px]" title={db.name}>{db.name}</span>
                    <span className="font-bold text-orange-400 shrink-0">{db.count} alert{db.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 italic">No high priority alerts</div>
            )}
          </div>
        </div>

        {/* Warning Level Summary Card with Rich Tooltip */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs relative group cursor-help">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Warning Level
          </div>
          <div className="flex items-end justify-between">
            <div className={cn('text-2xl font-bold tracking-tight', warnAlertsCount > 0 ? 'text-amber-600' : 'text-slate-400')}>
              {String(warnAlertsCount).padStart(2, '0')}
            </div>
            <div className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
              warnAlertsCount > 0 ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-slate-500 bg-slate-100'
            )}>
              {warnAlertsCount > 0 ? 'THRESHOLD' : 'NOMINAL'}
            </div>
          </div>

          {/* Hover Tooltip */}
          <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
            <div className="font-bold text-amber-400 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              Warning Alert Details
            </div>
            {affectedWarnDbs.length > 0 ? (
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {affectedWarnDbs.map((db, idx) => (
                  <div key={idx} className="flex justify-between items-center gap-4">
                    <span className="font-medium text-slate-200 truncate max-w-[120px]" title={db.name}>{db.name}</span>
                    <span className="font-bold text-amber-400 shrink-0">{db.count} alert{db.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 italic">No warnings active</div>
            )}
          </div>
        </div>

        {/* System Collector */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs relative">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Collector Service
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-indigo-600 tracking-tight">ONLINE</div>
            <div className="text-indigo-700 text-[9px] font-bold tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
              SYNCED (UTC+7)
            </div>
          </div>
        </div>
      </div>

      {/* Database Quick Health Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              Database Status Grid {selectedDbType !== 'ALL' && `— ${selectedDbType}`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Showing {filteredDatabases.length} instance{filteredDatabases.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onNavigateToDatabases}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-semibold cursor-pointer"
          >
            Manage Databases
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {filteredDatabases.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No registered databases found for engine type <span className="font-bold">{selectedDbType}</span>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {dbStatuses.map((db) => {
              const dbAlerts = activeAlerts.filter((a) => a.dbId === db.id);
              const cCount = dbAlerts.filter((a) => a.alertLevel === 'CRITICAL' || a.alertLevel === 'DOWN').length;
              const hCount = dbAlerts.filter((a) => a.alertLevel === 'HIGH').length;
              const wCount = dbAlerts.filter((a) => a.alertLevel === 'WARN').length;

              return (
                <div
                  key={db.id}
                  onClick={() => onNavigateToAnalytics(db.id)}
                  title={`Open ${db.name} (${db.host}:${db.port}) in Analytics Database`}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                          {db.name}
                        </div>
                        {/* Host/IP:Port connection */}
                        <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5" title={`${db.host}:${db.port}`}>
                          {db.host}:{db.port}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'w-2.5 h-2.5 rounded-full shrink-0 mt-1',
                          db.derivedStatus === 'UP' && 'bg-emerald-500 shadow-2xs shadow-emerald-500/50',
                          db.derivedStatus === 'WARN' && 'bg-amber-500 shadow-2xs shadow-amber-500/50 animate-pulse',
                          db.derivedStatus === 'DOWN' && 'bg-rose-500 shadow-2xs shadow-rose-500/50 animate-pulse'
                        )}
                        title={`Status: ${db.derivedStatus}`}
                      />
                    </div>

                    {/* Engine Code and Environment Badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          'px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md border shadow-2xs',
                          getDbEngineBadgeClass(db.dbType)
                        )}
                      >
                        {db.dbType}
                      </span>
                      {db.environment && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {db.environment}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider">Alerts (C/H/W)</span>
                    <span className={cn(
                      'font-mono font-bold text-xs',
                      db.alertCount > 0 ? 'text-slate-800' : 'text-slate-400'
                    )}>
                      <span className={cn(cCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400')}>{cCount}</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className={cn(hCount > 0 ? 'text-orange-500 font-extrabold' : 'text-slate-400')}>{hCount}</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className={cn(wCount > 0 ? 'text-amber-500 font-extrabold' : 'text-slate-400')}>{wCount}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

