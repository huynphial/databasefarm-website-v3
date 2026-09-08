import React from 'react';
import { DatabaseEntity, ActiveAlertEntity } from '../../types';
import { useTranslation } from '../../i18n';
import { cn } from '../../lib/utils';
import { Check } from 'lucide-react';

export interface SummaryMetricCardsProps {
  databases: DatabaseEntity[];
  activeAlerts: ActiveAlertEntity[];
  selectedDbType?: string;
  selectedSeverity?: string;
  onSelectSeverity?: (severity: string) => void;
  className?: string;
}

export const SummaryMetricCards: React.FC<SummaryMetricCardsProps> = ({
  databases,
  activeAlerts,
  selectedDbType = 'ALL',
  selectedSeverity = 'ALL',
  onSelectSeverity,
  className,
}) => {
  const { t } = useTranslation();

  // Filter databases by engine type if specified
  const filteredDatabases = databases.filter((db) => {
    if (selectedDbType === 'ALL') return true;
    return (db.dbType || '').toUpperCase() === selectedDbType.toUpperCase();
  });

  const filteredDbIds = new Set(filteredDatabases.map((db) => db.id));
  const dbTypeScopedAlerts = activeAlerts.filter((alert) => filteredDbIds.has(alert.dbId));

  // Derive database statuses
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

  const handleCardClick = (targetSeverity: string) => {
    if (!onSelectSeverity) return;
    if (selectedSeverity === targetSeverity) {
      onSelectSeverity('ALL');
    } else {
      onSelectSeverity(targetSeverity);
    }
  };

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5', className)}>
      {/* 1. Monitored Databases */}
      <div
        onClick={() => handleCardClick('ALL')}
        className={cn(
          'bg-white border p-4 rounded-xl shadow-2xs relative group transition-all select-none',
          onSelectSeverity && 'cursor-pointer hover:shadow-md hover:border-slate-300',
          selectedSeverity === 'ALL'
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-200 opacity-80 hover:opacity-100'
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {t('dashboard.monitoredDbs')} {selectedDbType !== 'ALL' && `(${selectedDbType})`}
          </div>
          {selectedSeverity === 'ALL' && onSelectSeverity && (
            <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
              ALL
            </span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">{filteredDatabases.length}</div>
          <div
            className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded border',
              upPercentage === 100
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            )}
          >
            {upPercentage}% {t('dashboard.healthy')}
          </div>
        </div>

        {/* Hover Tooltip - Drop Down */}
        <div className="hidden group-hover:block absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
          <div className="font-bold text-indigo-300 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span>{t('dashboard.monitoredDbs')} ({filteredDatabases.length})</span>
            {onSelectSeverity && <span className="text-[9px] text-indigo-400 font-normal">Click to show all</span>}
          </div>
          <div className="space-y-1 text-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-emerald-400 font-medium">● Healthy / Up</span>
              <span className="font-bold">{dbStatuses.filter((d) => d.derivedStatus === 'UP').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-400 font-medium">▲ Warning Level</span>
              <span className="font-bold">{warnCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-400 font-medium">▼ Offline / Down</span>
              <span className="font-bold">{downCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Databases Down Summary Card */}
      <div
        onClick={() => handleCardClick('DOWN')}
        className={cn(
          'p-4 rounded-xl border shadow-2xs transition-all relative group select-none',
          onSelectSeverity && 'cursor-pointer hover:shadow-md',
          selectedSeverity === 'DOWN'
            ? 'ring-2 ring-offset-2 ring-rose-600 scale-[1.02] bg-rose-600 text-white border-rose-700'
            : downCount > 0
            ? 'bg-rose-600 text-white border-rose-700 shadow-rose-200 hover:brightness-105'
            : 'bg-emerald-50/90 text-emerald-950 border-emerald-300 hover:border-emerald-400'
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider',
              downCount > 0 || selectedSeverity === 'DOWN' ? 'text-rose-100' : 'text-emerald-800'
            )}
          >
            {t('dashboard.databasesDown')}
          </div>
          {selectedSeverity === 'DOWN' && (
            <span className="text-[9px] font-extrabold text-white bg-rose-800/90 px-1.5 py-0.2 rounded border border-rose-400 flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" /> FILTER
            </span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div className={cn('text-2xl font-extrabold tracking-tight', downCount > 0 || selectedSeverity === 'DOWN' ? 'text-white' : 'text-emerald-700')}>
            {downCount}
          </div>
          <div
            className={cn(
              'text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border',
              downCount > 0
                ? 'bg-rose-700/80 text-white border-rose-500 animate-pulse'
                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
            )}
          >
            {downCount > 0 ? t('common.attentionRequired') : t('common.allInstancesUp')}
          </div>
        </div>

        {/* Hover Tooltip - Drop Down */}
        <div className="hidden group-hover:block absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
          <div className="font-bold text-rose-400 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span>{t('dashboard.downDatabasesTooltip')} ({affectedDownDbs.length})</span>
            {onSelectSeverity && <span className="text-[9px] text-rose-300 font-normal">Click to filter</span>}
          </div>
          {affectedDownDbs.length > 0 ? (
            <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
              {affectedDownDbs.map((db, idx) => (
                <div key={idx} className="flex justify-between items-center gap-4">
                  <span className="font-medium text-slate-200 truncate max-w-[120px]" title={db.name}>
                    {db.name}
                  </span>
                  <span className="font-bold text-rose-400 shrink-0">
                    {db.count} alert{db.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 italic">{t('dashboard.noOfflineDatabases')}</div>
          )}
        </div>
      </div>

      {/* 3. Critical Alerts Summary Card */}
      <div
        onClick={() => handleCardClick('CRITICAL')}
        className={cn(
          'bg-white border p-4 rounded-xl shadow-2xs relative group transition-all select-none',
          onSelectSeverity && 'cursor-pointer hover:shadow-md hover:border-rose-300',
          selectedSeverity === 'CRITICAL'
            ? 'border-rose-500 ring-2 ring-offset-2 ring-rose-500 scale-[1.02] bg-rose-50/30'
            : 'border-slate-200'
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {t('dashboard.criticalAlerts')}
          </div>
          {selectedSeverity === 'CRITICAL' && (
            <span className="text-[9px] font-extrabold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-300 flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" /> FILTER
            </span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div
            className={cn('text-2xl font-bold tracking-tight', criticalAlertsCount > 0 ? 'text-rose-600' : 'text-slate-400')}
          >
            {String(criticalAlertsCount).padStart(2, '0')}
          </div>
          <div
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
              criticalAlertsCount > 0 ? 'text-rose-700 bg-rose-50 border border-rose-200' : 'text-slate-500 bg-slate-100'
            )}
          >
            {criticalAlertsCount > 0 ? t('common.actionRequired') : t('common.nominal')}
          </div>
        </div>

        {/* Hover Tooltip - Drop Down */}
        <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
          <div className="font-bold text-rose-400 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span>{t('dashboard.criticalAlertsTooltip')}</span>
            {onSelectSeverity && <span className="text-[9px] text-rose-300 font-normal">Click to filter</span>}
          </div>
          {affectedCriticalDbs.length > 0 ? (
            <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
              {affectedCriticalDbs.map((db, idx) => (
                <div key={idx} className="flex justify-between items-center gap-4">
                  <span className="font-medium text-slate-200 truncate max-w-[120px]" title={db.name}>
                    {db.name}
                  </span>
                  <span className="font-bold text-rose-400 shrink-0">
                    {db.count} alert{db.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 italic">{t('dashboard.noCriticalIncidents')}</div>
          )}
        </div>
      </div>

      {/* 4. High Alerts Summary Card */}
      <div
        onClick={() => handleCardClick('HIGH')}
        className={cn(
          'bg-white border p-4 rounded-xl shadow-2xs relative group transition-all select-none',
          onSelectSeverity && 'cursor-pointer hover:shadow-md hover:border-orange-300',
          selectedSeverity === 'HIGH'
            ? 'border-orange-500 ring-2 ring-offset-2 ring-orange-500 scale-[1.02] bg-orange-50/30'
            : 'border-slate-200'
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {t('dashboard.highAlerts')}
          </div>
          {selectedSeverity === 'HIGH' && (
            <span className="text-[9px] font-extrabold text-orange-700 bg-orange-100 px-1.5 py-0.2 rounded border border-orange-300 flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" /> FILTER
            </span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div className={cn('text-2xl font-bold tracking-tight', highAlertsCount > 0 ? 'text-orange-600' : 'text-slate-400')}>
            {String(highAlertsCount).padStart(2, '0')}
          </div>
          <div
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
              highAlertsCount > 0 ? 'text-orange-700 bg-orange-50 border border-orange-200' : 'text-slate-500 bg-slate-100'
            )}
          >
            {highAlertsCount > 0 ? t('common.actionRequired') : t('common.nominal')}
          </div>
        </div>

        {/* Hover Tooltip - Drop Down */}
        <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
          <div className="font-bold text-orange-400 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span>{t('dashboard.highAlertsTooltip')}</span>
            {onSelectSeverity && <span className="text-[9px] text-orange-300 font-normal">Click to filter</span>}
          </div>
          {affectedHighDbs.length > 0 ? (
            <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
              {affectedHighDbs.map((db, idx) => (
                <div key={idx} className="flex justify-between items-center gap-4">
                  <span className="font-medium text-slate-200 truncate max-w-[120px]" title={db.name}>
                    {db.name}
                  </span>
                  <span className="font-bold text-orange-400 shrink-0">
                    {db.count} alert{db.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 italic">{t('dashboard.noHighPriorityAlerts')}</div>
          )}
        </div>
      </div>

      {/* 5. Warning Level Summary Card */}
      <div
        onClick={() => handleCardClick('WARN')}
        className={cn(
          'bg-white border p-4 rounded-xl shadow-2xs relative group transition-all select-none',
          onSelectSeverity && 'cursor-pointer hover:shadow-md hover:border-amber-300',
          selectedSeverity === 'WARN'
            ? 'border-amber-500 ring-2 ring-offset-2 ring-amber-500 scale-[1.02] bg-amber-50/30'
            : 'border-slate-200'
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {t('dashboard.warningLevel')}
          </div>
          {selectedSeverity === 'WARN' && (
            <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300 flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" /> FILTER
            </span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div className={cn('text-2xl font-bold tracking-tight', warnAlertsCount > 0 ? 'text-amber-600' : 'text-slate-400')}>
            {String(warnAlertsCount).padStart(2, '0')}
          </div>
          <div
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
              warnAlertsCount > 0 ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-slate-500 bg-slate-100'
            )}
          >
            {warnAlertsCount > 0 ? t('common.threshold') : t('common.nominal')}
          </div>
        </div>

        {/* Hover Tooltip - Drop Down */}
        <div className="hidden group-hover:block absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 lg:right-0 lg:left-auto lg:translate-x-0 top-full mt-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
          <div className="font-bold text-amber-400 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span>{t('dashboard.warningAlertsTooltip')}</span>
            {onSelectSeverity && <span className="text-[9px] text-amber-300 font-normal">Click to filter</span>}
          </div>
          {affectedWarnDbs.length > 0 ? (
            <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
              {affectedWarnDbs.map((db, idx) => (
                <div key={idx} className="flex justify-between items-center gap-4">
                  <span className="font-medium text-slate-200 truncate max-w-[120px]" title={db.name}>
                    {db.name}
                  </span>
                  <span className="font-bold text-amber-400 shrink-0">
                    {db.count} alert{db.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 italic">{t('dashboard.noWarningsActive')}</div>
          )}
        </div>
      </div>

      {/* 6. System Collector */}
      <div
        onClick={() => handleCardClick('ALL')}
        className={cn(
          'bg-white border border-slate-200 p-4 rounded-xl shadow-2xs relative group transition-all select-none',
          onSelectSeverity && 'cursor-pointer hover:shadow-md hover:border-indigo-300'
        )}
      >
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          {t('dashboard.collectorService')}
        </div>
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold text-indigo-600 tracking-tight">{t('dashboard.online')}</div>
          <div className="text-indigo-700 text-[9px] font-bold tracking-wider bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            {t('dashboard.syncedUtc')}
          </div>
        </div>

        {/* Hover Tooltip - Drop Down */}
        <div className="hidden group-hover:block absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 lg:right-0 lg:left-auto lg:translate-x-0 top-full mt-2.5 z-50 min-w-[220px] max-w-xs p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none leading-relaxed text-left">
          <div className="font-bold text-indigo-300 pb-1 mb-1 border-b border-slate-800 uppercase tracking-wider text-[10px]">
            {t('dashboard.collectorService')}
          </div>
          <div className="space-y-1 text-slate-200 text-[10px]">
            <div>● Multi-engine polling thread pool running</div>
            <div>● Real-time threshold evaluation active</div>
            <div>● System metric collectors synchronized</div>
          </div>
        </div>
      </div>
    </div>
  );
};
