import React, { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { MetricEntity, DatabaseEngineEntity } from '../../types';
import { getDbEngineBadgeClass, getDbEngineConfig } from '../../config/dbEngines';
import { useTranslation } from '../../i18n/LanguageContext';
import { cn } from '../../lib/utils';

export interface MetricsEngineSummaryGridProps {
  metrics: MetricEntity[];
  databaseEngines: DatabaseEngineEntity[];
  selectedEngineFilter: string;
  onSelectEngineFilter: (engineFilter: string) => void;
  className?: string;
}

export const MetricsEngineSummaryGrid: React.FC<MetricsEngineSummaryGridProps> = ({
  metrics,
  databaseEngines = [],
  selectedEngineFilter = 'ALL',
  onSelectEngineFilter,
  className,
}) => {
  const { t } = useTranslation();

  // Total summary calculation
  const totalSummary = useMemo(() => {
    const totalCount = metrics.length;
    const activeCount = metrics.filter((m) => m.isEnabled !== false).length;
    let type1Count = 0;
    let type2Count = 0;
    let type3Count = 0;

    metrics.forEach((m) => {
      if (!m.metricQueryType || m.metricQueryType === 1) type1Count++;
      else if (m.metricQueryType === 2) type2Count++;
      else if (m.metricQueryType === 3) type3Count++;
    });

    return { totalCount, activeCount, type1Count, type2Count, type3Count };
  }, [metrics]);

  // Universal metrics calculation
  const universalSummary = useMemo(() => {
    const universalMetrics = metrics.filter(
      (m) => !m.databaseEngineId || m.databaseEngineId === 'ALL' || m.databaseEngine?.dbCode === 'ALL'
    );
    const totalCount = universalMetrics.length;
    const activeCount = universalMetrics.filter((m) => m.isEnabled !== false).length;
    let type1Count = 0;
    let type2Count = 0;
    let type3Count = 0;

    universalMetrics.forEach((m) => {
      if (!m.metricQueryType || m.metricQueryType === 1) type1Count++;
      else if (m.metricQueryType === 2) type2Count++;
      else if (m.metricQueryType === 3) type3Count++;
    });

    return { totalCount, activeCount, type1Count, type2Count, type3Count };
  }, [metrics]);

  // Engine summary calculation (Only engines with > 0 metrics will be returned)
  const engineSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        totalCount: number;
        activeCount: number;
        type1Count: number;
        type2Count: number;
        type3Count: number;
      }
    >();

    // First initialize map entries from registered active databaseEngines
    const activeEngines = databaseEngines.filter((e) => e.statusOnOff === 'ACTIVE');
    activeEngines.forEach((eng) => {
      const code = (eng.dbCode || 'UNKNOWN').toUpperCase();
      map.set(eng.id, {
        id: eng.id,
        code,
        name: eng.dbName || code,
        totalCount: 0,
        activeCount: 0,
        type1Count: 0,
        type2Count: 0,
        type3Count: 0,
      });
      map.set(code, map.get(eng.id)!);
    });

    // Populate counts from metrics
    metrics.forEach((m) => {
      const isUniversal = !m.databaseEngineId || m.databaseEngineId === 'ALL' || m.databaseEngine?.dbCode === 'ALL';
      if (isUniversal) return;

      const eng =
        m.databaseEngine ||
        (m.databaseEngineId ? activeEngines.find((e) => e.id === m.databaseEngineId || e.dbCode.toUpperCase() === m.databaseEngineId.toUpperCase()) : null);

      if (!eng || eng.statusOnOff === 'INACTIVE') return;

      const qType = m.metricQueryType || 1;

      if (eng) {
        const item = map.get(eng.id) || map.get(eng.dbCode.toUpperCase());
        if (item) {
          item.totalCount += 1;
          if (m.isEnabled !== false) item.activeCount += 1;
          if (qType === 1) item.type1Count += 1;
          else if (qType === 2) item.type2Count += 1;
          else if (qType === 3) item.type3Count += 1;
        }
      }
    });

    // Deduplicate by unique id and FILTER ONLY totalCount > 0
    const list: Array<{
      id: string;
      code: string;
      name: string;
      totalCount: number;
      activeCount: number;
      type1Count: number;
      type2Count: number;
      type3Count: number;
    }> = [];

    const processedIds = new Set<string>();

    map.forEach((value) => {
      if (!processedIds.has(value.id)) {
        processedIds.add(value.id);
        // Requirement: ONLY SHOW database engine cards that have > 0 metrics
        if (value.totalCount > 0) {
          list.push(value);
        }
      }
    });

    return list;
  }, [metrics, databaseEngines]);

  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5', className)}>
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {t('metrics.engineSummaryTitle') || 'Metrics Engine Overview'}
          </h3>
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          <span className="font-bold text-slate-800">{totalSummary.activeCount}</span>
          <span className="text-slate-400"> / {totalSummary.totalCount} active metrics</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {/* Card 1: Total Metrics Card */}
        <div
          onClick={() => onSelectEngineFilter('ALL')}
          className={cn(
            'px-3 py-2 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm relative',
            selectedEngineFilter === 'ALL'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
              : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20'
          )}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
              ALL
            </span>
            <span className="font-mono font-bold text-xs text-slate-900 shrink-0">
              <span className="text-emerald-600">{totalSummary.activeCount}</span>
              <span className="text-slate-300 mx-0.5">/</span>
              <span>{totalSummary.totalCount}</span>
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-100/80 pt-1">
            <span className="text-slate-400 font-sans text-[9px] uppercase font-bold tracking-wider">TYPES</span>
            <div className="flex items-center gap-1.5">
              <span>T1:<strong className="text-slate-700">{totalSummary.type1Count}</strong></span>
              <span>T2:<strong className="text-slate-700">{totalSummary.type2Count}</strong></span>
              <span>T3:<strong className="text-slate-700">{totalSummary.type3Count}</strong></span>
            </div>
          </div>
        </div>

        {/* Card 2: Universal Metrics Card (only if > 0) */}
        {universalSummary.totalCount > 0 && (
          <div
            onClick={() =>
              onSelectEngineFilter(selectedEngineFilter === 'UNIVERSAL' ? 'ALL' : 'UNIVERSAL')
            }
            className={cn(
              'px-3 py-2 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm relative',
              selectedEngineFilter === 'UNIVERSAL'
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20'
            )}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                UNIVERSAL
              </span>
              <span className="font-mono font-bold text-xs text-slate-900 shrink-0">
                <span className="text-emerald-600">{universalSummary.activeCount}</span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span>{universalSummary.totalCount}</span>
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-100/80 pt-1">
              <span className="text-slate-400 font-sans text-[9px] uppercase font-bold tracking-wider">TYPES</span>
              <div className="flex items-center gap-1.5">
                <span>T1:<strong className="text-slate-700">{universalSummary.type1Count}</strong></span>
                <span>T2:<strong className="text-slate-700">{universalSummary.type2Count}</strong></span>
                <span>T3:<strong className="text-slate-700">{universalSummary.type3Count}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Engine Cards (only engines with > 0 metrics) */}
        {engineSummaries.map((eng) => {
          const badgeClass = getDbEngineBadgeClass(eng.code);
          const isSelected =
            selectedEngineFilter === eng.id ||
            selectedEngineFilter.toUpperCase() === eng.code.toUpperCase();

          return (
            <div
              key={eng.id}
              onClick={() => onSelectEngineFilter(isSelected ? 'ALL' : eng.id)}
              className={cn(
                'px-3 py-2 rounded-lg border bg-white transition-all cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-sm relative',
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20'
              )}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded border shrink-0',
                    badgeClass
                  )}
                  title={eng.name}
                >
                  {eng.code}
                </span>
                <span className="font-mono font-bold text-xs text-slate-900 shrink-0">
                  <span className="text-emerald-600">{eng.activeCount}</span>
                  <span className="text-slate-300 mx-0.5">/</span>
                  <span>{eng.totalCount}</span>
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-100/80 pt-1">
                <span className="text-slate-400 font-sans text-[9px] uppercase font-bold tracking-wider">TYPES</span>
                <div className="flex items-center gap-1.5">
                  <span>T1:<strong className="text-slate-700">{eng.type1Count}</strong></span>
                  <span>T2:<strong className="text-slate-700">{eng.type2Count}</strong></span>
                  <span>T3:<strong className="text-slate-700">{eng.type3Count}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
