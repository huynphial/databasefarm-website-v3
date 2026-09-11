import React, { useMemo } from 'react';
import { DatabaseEntity, ActiveAlertEntity, DatabaseEngineEntity } from '../../types';
import { getDbEngineConfig, getDbEngineHexColor } from '../../config/dbEngines';
import { useTranslation } from '../../i18n/LanguageContext';
import { cn } from '../../lib/utils';

export interface DatabaseEngineSummaryGridProps {
  databases: DatabaseEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  activeAlerts?: ActiveAlertEntity[];
  selectedEngine?: string;
  selectedStatus?: string;
  onSelectEngine?: (engine: string) => void;
  onSelectStatus?: (status: string) => void;
  className?: string;
}

export const DatabaseEngineSummaryGrid: React.FC<DatabaseEngineSummaryGridProps> = ({
  databases = [],
  databaseEngines = [],
  activeAlerts = [],
  selectedEngine = 'ALL',
  selectedStatus = 'ALL',
  onSelectEngine,
  onSelectStatus,
  className,
}) => {
  const { t } = useTranslation();

  const safeDatabases = Array.isArray(databases) ? databases : [];
  const safeActiveAlerts = Array.isArray(activeAlerts) ? activeAlerts : [];
  const safeEngines = Array.isArray(databaseEngines) ? databaseEngines : [];

  const summaryMetrics = useMemo(() => {
    const totalDbs = safeDatabases.length;
    const dbsUp = safeDatabases.filter((d) => (d.status || '').toUpperCase() === 'UP').length;
    const dbsDown = safeDatabases.filter((d) => (d.status || '').toUpperCase() === 'DOWN').length;
    const monitoredDbs = safeDatabases.filter((d) => d.isEnabled !== false).length;

    const criticalAlerts = safeActiveAlerts.filter((a) => {
      const lvl = (a.alertLevel || '').toUpperCase();
      return lvl === 'CRITICAL' || lvl === 'FATAL';
    }).length;
    const highAlerts = safeActiveAlerts.filter((a) => (a.alertLevel || '').toUpperCase() === 'HIGH').length;
    const warningAlerts = safeActiveAlerts.filter((a) => {
      const lvl = (a.alertLevel || '').toUpperCase();
      return lvl === 'WARN' || lvl === 'WARNING';
    }).length;

    return {
      totalDbs,
      dbsUp,
      dbsDown,
      monitoredDbs,
      criticalAlerts,
      highAlerts,
      warningAlerts,
    };
  }, [safeDatabases, safeActiveAlerts]);

  const engineSummaryMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        name: string;
        color: string;
        totalCount: number;
        activeCount: number;
        downCount: number;
        upCount: number;
        criticalCount: number;
        highCount: number;
        warnCount: number;
      }
    >();

    // Build lookup for active databaseEngines if available
    const activeEngineCodes = new Set(
      safeEngines
        .filter((e) => e.statusOnOff === 'ACTIVE')
        .map((e) => e.dbCode.toUpperCase())
    );

    safeDatabases.forEach((db) => {
      const code = (db.dbType || 'UNKNOWN').toUpperCase();

      // If databaseEngines is present and has active entries, skip inactive engines
      if (activeEngineCodes.size > 0 && !activeEngineCodes.has(code)) {
        return;
      }

      const dbEngObj = safeEngines.find((e) => e.dbCode.toUpperCase() === code);
      const hexColor = dbEngObj?.dbColor || getDbEngineHexColor(code, safeEngines);
      const name = dbEngObj?.dbName || getDbEngineConfig(code)?.name || code;

      if (!map.has(code)) {
        map.set(code, {
          code,
          name,
          color: hexColor,
          totalCount: 0,
          activeCount: 0,
          downCount: 0,
          upCount: 0,
          criticalCount: 0,
          highCount: 0,
          warnCount: 0,
        });
      }

      const item = map.get(code)!;
      item.totalCount += 1;
      if (db.isEnabled !== false) {
        item.activeCount += 1;
      }
      const st = (db.status || '').toUpperCase();
      if (st === 'DOWN') {
        item.downCount += 1;
      } else if (st === 'UP') {
        item.upCount += 1;
      }

      const dbAlerts = safeActiveAlerts.filter((a) => {
        const aDbId = String(a.dbId || (a as any).databaseId || '');
        const matchId = aDbId && aDbId === String(db.id);
        const matchName = Boolean(
          a.dbName && db.name && a.dbName.trim().toLowerCase() === db.name.trim().toLowerCase()
        );
        return matchId || matchName;
      });

      dbAlerts.forEach((a) => {
        const lvl = (a.alertLevel || '').toUpperCase();
        if (lvl === 'CRITICAL' || lvl === 'FATAL') {
          item.criticalCount += 1;
        } else if (lvl === 'HIGH') {
          item.highCount += 1;
        } else if (lvl === 'WARN' || lvl === 'WARNING') {
          item.warnCount += 1;
        }
      });
    });

    return Array.from(map.values())
      .filter((item) => item.totalCount > 0)
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [safeDatabases, safeEngines, safeActiveAlerts]);

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2',
        className
      )}
    >
      {/* Card 1: All Databases */}
      <div
        onClick={() => {
          if (onSelectEngine) onSelectEngine('ALL');
          if (onSelectStatus) onSelectStatus('ALL');
        }}
        title={`All Databases: ${summaryMetrics.totalDbs} total (100.00%)`}
        className={cn(
          'px-3.5 py-2 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-center group shadow-2xs hover:shadow-xs min-h-[52px]',
          selectedEngine.toUpperCase() === 'ALL' && selectedStatus.toUpperCase() === 'ALL'
            ? 'border-indigo-500 ring-1.5 ring-indigo-500/20 bg-indigo-50/25'
            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/15'
        )}
      >
        <div className="flex items-center justify-between gap-1.5 leading-tight">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-indigo-600 tracking-tight truncate group-hover:text-indigo-700 transition-colors">
              All Databases
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
              100.00%
            </span>
          </div>
          <div className="font-mono text-[11px] shrink-0" title="Critical / High / Warning Alerts">
            <span className={summaryMetrics.criticalAlerts > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'}>
              {summaryMetrics.criticalAlerts}
            </span>
            <span className="text-slate-300 mx-0.5">/</span>
            <span className={summaryMetrics.highAlerts > 0 ? 'text-orange-500 font-extrabold' : 'text-slate-400'}>
              {summaryMetrics.highAlerts}
            </span>
            <span className="text-slate-300 mx-0.5">/</span>
            <span className={summaryMetrics.warningAlerts > 0 ? 'text-amber-500 font-extrabold' : 'text-slate-400'}>
              {summaryMetrics.warningAlerts}
            </span>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600 font-mono leading-tight">
          <div className="truncate">
            <span className="font-bold text-slate-800">Active: {summaryMetrics.monitoredDbs}</span>
            <span className="text-slate-400 mx-1">/</span>
            <span className="text-slate-700 font-medium">Total: {summaryMetrics.totalDbs}</span>
          </div>
          {summaryMetrics.dbsDown > 0 ? (
            <span className="text-rose-600 font-bold shrink-0 ml-1.5">{summaryMetrics.dbsDown} DOWN</span>
          ) : summaryMetrics.dbsUp > 0 ? (
            <span className="text-emerald-600 font-medium shrink-0 ml-1.5">{summaryMetrics.dbsUp} UP</span>
          ) : null}
        </div>
      </div>

      {/* Card 2: Active Databases */}
      {(() => {
        const activePct =
          summaryMetrics.totalDbs > 0
            ? ((summaryMetrics.monitoredDbs / summaryMetrics.totalDbs) * 100).toFixed(2)
            : '0.00';
        return (
          <div
            onClick={() => {
              if (onSelectStatus) {
                onSelectStatus(selectedStatus === 'UP' ? 'ALL' : 'UP');
              }
            }}
            title={`Active Databases: ${summaryMetrics.monitoredDbs} of ${summaryMetrics.totalDbs} (${activePct}%)`}
            className={cn(
              'px-3.5 py-2 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-center group shadow-2xs hover:shadow-xs min-h-[52px]',
              selectedStatus === 'UP'
                ? 'border-emerald-500 ring-1.5 ring-emerald-500/20 bg-emerald-50/25'
                : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/15'
            )}
          >
            <div className="flex items-center justify-between gap-1.5 leading-tight">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-emerald-600 tracking-tight truncate group-hover:text-emerald-700 transition-colors">
                  Active Databases
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
                  {activePct}%
                </span>
              </div>
              <div className="font-mono font-bold text-[11px] shrink-0 text-emerald-600">
                {summaryMetrics.dbsUp} UP
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600 font-mono leading-tight">
              <div className="truncate">
                <span className="font-bold text-slate-800">Active: {summaryMetrics.monitoredDbs}</span>
                <span className="text-slate-400 mx-1">/</span>
                <span className="text-slate-700 font-medium">Total: {summaryMetrics.totalDbs}</span>
              </div>
              {summaryMetrics.totalDbs - summaryMetrics.monitoredDbs > 0 && (
                <span className="text-slate-400 font-medium shrink-0 ml-1.5">
                  {summaryMetrics.totalDbs - summaryMetrics.monitoredDbs} Off
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Cards 3+: Engine Specific Cards */}
      {engineSummaryMetrics.map((eng) => {
        const isSelected = selectedEngine.toUpperCase() === eng.code.toUpperCase();
        const percentOverAll =
          summaryMetrics.totalDbs > 0
            ? ((eng.totalCount / summaryMetrics.totalDbs) * 100).toFixed(2)
            : '0.00';

        return (
          <div
            key={eng.code}
            onClick={() => {
              if (onSelectEngine) {
                onSelectEngine(isSelected ? 'ALL' : eng.code);
              }
            }}
            title={`${eng.name}: ${eng.totalCount} databases (${percentOverAll}% of all ${summaryMetrics.totalDbs} databases)`}
            className={cn(
              'px-3.5 py-2 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-center group shadow-2xs hover:shadow-xs min-h-[52px]',
              isSelected
                ? 'border-indigo-500 ring-1.5 ring-indigo-500/20 bg-indigo-50/25'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/15'
            )}
          >
            <div className="flex items-center justify-between gap-1.5 leading-tight">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="text-xs font-bold tracking-tight truncate transition-opacity group-hover:opacity-90"
                  style={{ color: eng.color }}
                >
                  {eng.name}
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                  {percentOverAll}%
                </span>
              </div>
              <div className="font-mono text-[11px] shrink-0" title="Critical / High / Warning Alerts">
                <span className={eng.criticalCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'}>
                  {eng.criticalCount}
                </span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span className={eng.highCount > 0 ? 'text-orange-500 font-extrabold' : 'text-slate-400'}>
                  {eng.highCount}
                </span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span className={eng.warnCount > 0 ? 'text-amber-500 font-extrabold' : 'text-slate-400'}>
                  {eng.warnCount}
                </span>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600 font-mono leading-tight">
              <div className="truncate">
                <span className="font-bold text-slate-800">Active: {eng.activeCount}</span>
                <span className="text-slate-400 mx-1">/</span>
                <span className="text-slate-700 font-medium">Total: {eng.totalCount}</span>
              </div>
              {eng.downCount > 0 ? (
                <span className="text-rose-600 font-bold shrink-0 ml-1.5">{eng.downCount} DOWN</span>
              ) : eng.upCount > 0 ? (
                <span className="text-emerald-600 font-medium shrink-0 ml-1.5">{eng.upCount} UP</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
