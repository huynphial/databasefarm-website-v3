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
import { ActiveAlertEntity, DatabaseEntity, DatabaseEngineEntity, DbEngine, UserRole } from '../../types';
import { DB_ENGINES, getDbEngineBadgeClass, getDbEngineConfig, getDbEngineTagStyle } from '../../config/dbEngines';
import { DataTable, Column } from '../tables/DataTable';
import { formatTimeVN, cn } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n/LanguageContext';
import { AutoRefreshControl } from '../common/AutoRefreshControl';
import { SummaryMetricCards } from '../common/SummaryMetricCards';
import { DatabaseEngineFilter } from '../common/DatabaseEngineFilter';
import { DatabaseEngineSummaryGrid } from '../common/DatabaseEngineSummaryGrid';

interface DashboardViewProps {
  databases: DatabaseEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  activeAlerts: ActiveAlertEntity[];
  onClearAlert: (alertId: string) => Promise<any> | void;
  onRefresh: () => void;
  userRole: UserRole;
  onNavigateToDatabases: () => void;
  onNavigateToAnalytics: (dbId?: string) => void;
  onNavigateToActiveAlerts?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  databases,
  databaseEngines = [],
  activeAlerts,
  onClearAlert,
  onRefresh,
  userRole,
  onNavigateToDatabases,
  onNavigateToAnalytics,
  onNavigateToActiveAlerts,
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedDbType, setSelectedDbType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
          <span className="font-bold text-slate-900 tracking-tight whitespace-nowrap">{t('dashboard.engineScope')}:</span>
          <DatabaseEngineFilter
            id="dbTypeFilter"
            value={selectedDbType}
            onChange={(val) => {
              setSelectedDbType(val);
              setCurrentPage(1);
            }}
            databases={databases}
            databaseEngines={databaseEngines}
            allLabel={t('dashboard.allDatabaseEngines')}
          />
        </div>

        <AutoRefreshControl
          onRefresh={onRefresh}
          toastTitle="Dashboard Refreshed"
          toastDescription="Real-time overview metrics updated."
        />
      </div>

      {/* 6 Summary Metric Cards with Hover Tooltips & Dynamic Highlighting */}
      <SummaryMetricCards
        databases={databases}
        activeAlerts={activeAlerts}
        selectedDbType={selectedDbType}
      />

      {/* Database Engine Summary Grid */}
      <DatabaseEngineSummaryGrid
        databases={databases}
        databaseEngines={databaseEngines}
        activeAlerts={activeAlerts}
        selectedEngine={selectedDbType}
        onSelectEngine={(engine) => {
          setSelectedDbType(engine);
          setCurrentPage(1);
        }}
      />

      {/* Database Quick Health Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              {t('dashboard.statusGrid')} {selectedDbType !== 'ALL' && `— ${selectedDbType}`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t('dashboard.showingInstances', { count: filteredDatabases.length })}</p>
          </div>
          <button
            onClick={onNavigateToDatabases}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-semibold cursor-pointer"
          >
            {t('dashboard.manageDatabases')}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {filteredDatabases.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            {t('dashboard.noDatabasesFound')} <span className="font-bold">{selectedDbType}</span>.
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
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm relative"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                          {db.name}
                        </div>
                        {/* Host/IP:Port connection */}
                        <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
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
                    <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider">{t('dashboard.alertsCountFormat')}</span>
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

                  {/* Hover Dropdown Tooltip - drops down below the card, never above */}
                  <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-64 max-w-[calc(100vw-32px)] p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 pointer-events-none leading-relaxed text-left">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                      <span className="font-bold text-slate-100 truncate max-w-[150px]">{db.name}</span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase',
                        db.derivedStatus === 'UP' && 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
                        db.derivedStatus === 'WARN' && 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                        db.derivedStatus === 'DOWN' && 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      )}>
                        {db.derivedStatus}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-slate-300 text-[10px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Engine / Env:</span>
                        <span className="font-semibold text-slate-200">{db.dbType} {db.environment ? `(${db.environment})` : ''}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Connection:</span>
                        <span className="font-mono text-slate-200">{db.host}:{db.port}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                        <span className="text-slate-400">Active Alerts:</span>
                        <span className="font-bold text-slate-200">
                          {cCount > 0 && <span className="text-rose-400 mr-1">{cCount} Crit</span>}
                          {hCount > 0 && <span className="text-orange-400 mr-1">{hCount} High</span>}
                          {wCount > 0 && <span className="text-amber-400 mr-1">{wCount} Warn</span>}
                          {cCount === 0 && hCount === 0 && wCount === 0 && <span className="text-emerald-400">Nominal (0)</span>}
                        </span>
                      </div>
                      <div className="pt-1 text-[9px] text-indigo-400 font-semibold flex items-center justify-end gap-1">
                        Click card to open Analytics ↗
                      </div>
                    </div>
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

