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
  databases,
  databaseEngines = [],
  activeAlerts = [],
  selectedEngine = 'ALL',
  selectedStatus = 'ALL',
  onSelectEngine,
  onSelectStatus,
  className,
}) => {
  const { t } = useTranslation();

  const summaryMetrics = useMemo(() => {
    const totalDbs = databases.length;
    const dbsUp = databases.filter((d) => (d.status || '').toUpperCase() === 'UP').length;
    const dbsDown = databases.filter((d) => (d.status || '').toUpperCase() === 'DOWN').length;
    const monitoredDbs = databases.filter((d) => d.isEnabled !== false).length;

    const criticalAlerts = activeAlerts.filter((a) => {
      const lvl = (a.alertLevel || '').toUpperCase();
      return lvl === 'CRITICAL' || lvl === 'FATAL';
    }).length;
    const highAlerts = activeAlerts.filter((a) => (a.alertLevel || '').toUpperCase() === 'HIGH').length;
    const warningAlerts = activeAlerts.filter((a) => {
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
  }, [databases, activeAlerts]);

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
      (databaseEngines || [])
        .filter((e) => e.statusOnOff === 'ACTIVE')
        .map((e) => e.dbCode.toUpperCase())
    );

    databases.forEach((db) => {
      const code = (db.dbType || 'UNKNOWN').toUpperCase();
      
      // If databaseEngines is present and has active entries, skip inactive engines
      if (activeEngineCodes.size > 0 && !activeEngineCodes.has(code)) {
        return;
      }

      const hexColor = getDbEngineHexColor(code, databaseEngines);
      const dbEngObj = databaseEngines?.find((e) => e.dbCode.toUpperCase() === code);
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

      const dbAlerts = activeAlerts.filter((a) => {
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
  }, [databases, databaseEngines, activeAlerts]);

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5',
        className
      )}
    >
      {/* Card 1: All Databases */}
      <div
        onClick={() => {
          if (onSelectEngine) onSelectEngine('ALL');
          if (onSelectStatus) onSelectStatus('ALL');
        }}
        className={cn(
          'px-3.5 py-2.5 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm relative',
          selectedEngine.toUpperCase() === 'ALL' && selectedStatus.toUpperCase() === 'ALL'
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
            : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-indigo-600 tracking-tight truncate group-hover:text-indigo-700 transition-colors">
            All Databases
          </div>
          <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500 shadow-2xs shadow-indigo-500/50" />
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
          <div className="text-[11px] text-slate-600 font-mono truncate">
            <span className="font-bold text-slate-800">{summaryMetrics.monitoredDbs}/{summaryMetrics.totalDbs}</span> active
            {summaryMetrics.dbsDown > 0 ? (
              <> • <span className="text-rose-600 font-bold">{summaryMetrics.dbsDown} DOWN</span></>
            ) : summaryMetrics.dbsUp > 0 ? (
              <> • <span className="text-emerald-600 font-medium">{summaryMetrics.dbsUp} UP</span></>
            ) : null}
          </div>

          <div className="font-mono font-bold text-[11px] shrink-0" title="Critical / High / Warning Alerts">
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
      </div>

      {/* Card 2: Active Databases (Enabled) */}
      <div
        onClick={() => {
          if (onSelectStatus) {
            onSelectStatus(selectedStatus === 'UP' ? 'ALL' : 'UP');
          }
        }}
        className={cn(
          'px-3.5 py-2.5 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm relative',
          selectedStatus === 'UP'
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
            : 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/20'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-emerald-600 tracking-tight truncate group-hover:text-emerald-700 transition-colors">
            Active Databases
          </div>
          <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-500 shadow-2xs shadow-emerald-500/50" />
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
          <div className="text-[11px] text-slate-600 font-mono truncate">
            <span className="font-bold text-slate-800">{summaryMetrics.monitoredDbs}/{summaryMetrics.totalDbs}</span> active
            {summaryMetrics.totalDbs - summaryMetrics.monitoredDbs > 0 ? (
              <> • <span className="text-slate-400 font-medium">{summaryMetrics.totalDbs - summaryMetrics.monitoredDbs} Off</span></>
            ) : null}
          </div>

          <div className="font-mono font-bold text-[11px] shrink-0 text-slate-700">
            {summaryMetrics.dbsUp} UP
          </div>
        </div>
      </div>

      {/* Cards 3+: Engine Specific Cards (count > 0) */}
      {engineSummaryMetrics.map((eng) => {
        const isSelected = selectedEngine.toUpperCase() === eng.code.toUpperCase();

        return (
          <div
            key={eng.code}
            onClick={() => {
              if (onSelectEngine) {
                onSelectEngine(isSelected ? 'ALL' : eng.code);
              }
            }}
            className={cn(
              'px-3.5 py-2.5 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm relative',
              isSelected
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                className="text-xs font-bold tracking-tight truncate transition-opacity group-hover:opacity-90"
                style={{ color: eng.color }}
              >
                {eng.name}
              </div>
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  eng.criticalCount > 0 || eng.downCount > 0
                    ? 'bg-rose-500 shadow-2xs shadow-rose-500/50 animate-pulse'
                    : eng.highCount > 0 || eng.warnCount > 0
                    ? 'bg-amber-500 shadow-2xs shadow-amber-500/50'
                    : 'bg-emerald-500 shadow-2xs shadow-emerald-500/50'
                )}
              />
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
              <div className="text-[11px] text-slate-600 font-mono truncate">
                <span className="font-bold text-slate-800">{eng.activeCount}/{eng.totalCount}</span> active
                {eng.downCount > 0 ? (
                  <> • <span className="text-rose-600 font-bold">{eng.downCount} DOWN</span></>
                ) : eng.upCount > 0 ? (
                  <> • <span className="text-emerald-600 font-medium">{eng.upCount} UP</span></>
                ) : null}
              </div>

              <div className="font-mono font-bold text-[11px] shrink-0" title="Critical / High / Warning Alerts">
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
          </div>
        );
      })}
    </div>
  );
};
