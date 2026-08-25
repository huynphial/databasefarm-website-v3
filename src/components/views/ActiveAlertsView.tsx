import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Server,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  CheckCircle,
  Clock,
  Play,
  Pause,
  Info,
  Trash2
} from 'lucide-react';
import { ActiveAlertEntity, DatabaseEntity, UserRole } from '../../types';
import { DB_ENGINES, getDbEngineBadgeClass } from '../../config/dbEngines';
import { DataTable, Column } from '../tables/DataTable';
import { formatTimeVN, cn } from '../../lib/utils';
import { useToast } from '../ui/Toast';

interface ActiveAlertsViewProps {
  databases: DatabaseEntity[];
  activeAlerts: ActiveAlertEntity[];
  onClearAlert: (alertId: string) => void;
  onAcknowledgeAlert?: (alertId: string) => void;
  onRefresh: () => void;
  userRole: UserRole;
  showInfoTips?: boolean;
}

const SEVERITY_RANK: Record<string, number> = {
  DOWN: 1,
  CRITICAL: 2,
  HIGH: 3,
  WARN: 4,
};

const STATE_RANK: Record<string, number> = {
  OPEN: 0,
  ACK: 1,
  ACKNOWLEDGED: 1,
};

export const ActiveAlertsView: React.FC<ActiveAlertsViewProps> = ({
  databases,
  activeAlerts,
  onClearAlert,
  onAcknowledgeAlert,
  onRefresh,
  userRole,
  showInfoTips = true,
}) => {
  const { toast } = useToast();

  // Filters & Sorting State
  const [selectedDbType, setSelectedDbType] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<string>('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Auto Refresh State (1-Minute Timer = 60 Seconds)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer Tick Interval
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

  const handleManualRefresh = () => {
    onRefresh();
    setSecondsRemaining(60);
    toast({
      title: 'Alerts Refreshed',
      description: 'Active incidents re-evaluated and synchronized.',
      type: 'info',
    });
  };

  const handleToggleAutoRefresh = () => {
    const nextVal = !autoRefreshEnabled;
    setAutoRefreshEnabled(nextVal);
    if (nextVal) {
      setSecondsRemaining(60);
    }
    toast({
      title: nextVal ? 'Auto-Refresh Enabled' : 'Auto-Refresh Paused',
      description: nextVal ? 'Alert stream will auto-update every 60 seconds.' : 'Automatic background refresh has been paused.',
      type: 'info',
    });
  };

  // Compute summary metrics based on table databases column status === 'DOWN'
  const dbStatuses = databases.map((db) => {
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

    return { ...db, derivedStatus: status };
  });

  const upCount = dbStatuses.filter((d) => d.derivedStatus === 'UP').length;
  const downCount = dbStatuses.filter((d) => d.derivedStatus === 'DOWN').length;
  const warnCount = dbStatuses.filter((d) => d.derivedStatus === 'WARN').length;
  const upPercentage = databases.length > 0 ? Math.round((upCount / databases.length) * 100) : 100;

  const criticalAlertsCount = activeAlerts.filter((a) => a.alertLevel === 'CRITICAL' || a.alertLevel === 'DOWN').length;
  const highAlertsCount = activeAlerts.filter((a) => a.alertLevel === 'HIGH').length;
  const warnAlertsCount = activeAlerts.filter((a) => a.alertLevel === 'WARN').length;

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

  const handleSortChange = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'createdAt' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Filter & Sort Active Alerts
  // Default order: status (OPEN to ACK), second order: detected time desc
  // Severity order: DOWN -> CRITICAL -> HIGH -> WARN
  const filteredAlerts = activeAlerts
    .filter((alert) => {
      const dbObj = databases.find((d) => d.id === alert.dbId);
      const matchesDbType = selectedDbType === 'ALL' || (dbObj && dbObj.dbType === selectedDbType);
      const matchesSeverity = severityFilter === 'ALL' || alert.alertLevel === severityFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        alert.dbName.toLowerCase().includes(term) ||
        alert.metricName.toLowerCase().includes(term) ||
        (alert.objectName && alert.objectName.toLowerCase().includes(term)) ||
        alert.message.toLowerCase().includes(term);

      return matchesDbType && matchesSeverity && matchesSearch;
    })
    .sort((a, b) => {
      let primaryCmp = 0;

      if (sortField === 'status') {
        const rankA = STATE_RANK[a.status || 'OPEN'] ?? 0;
        const rankB = STATE_RANK[b.status || 'OPEN'] ?? 0;
        primaryCmp = rankA - rankB;
      } else if (sortField === 'alertLevel') {
        const rankA = SEVERITY_RANK[a.alertLevel] ?? 99;
        const rankB = SEVERITY_RANK[b.alertLevel] ?? 99;
        primaryCmp = rankA - rankB;
      } else if (sortField === 'createdAt') {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        primaryCmp = timeA - timeB;
      } else if (sortField === 'dbName') {
        primaryCmp = a.dbName.localeCompare(b.dbName);
      } else if (sortField === 'metricName') {
        primaryCmp = a.metricName.localeCompare(b.metricName);
      } else if (sortField === 'message') {
        primaryCmp = a.message.localeCompare(b.message);
      }

      if (sortOrder === 'desc') {
        primaryCmp = -primaryCmp;
      }

      if (primaryCmp !== 0) return primaryCmp;

      // Secondary Tie-Breaker 1: State OPEN to ACK
      if (sortField !== 'status') {
        const rankA = STATE_RANK[a.status || 'OPEN'] ?? 0;
        const rankB = STATE_RANK[b.status || 'OPEN'] ?? 0;
        const stateCmp = rankA - rankB;
        if (stateCmp !== 0) return stateCmp;
      }

      // Secondary Tie-Breaker 2: Detected time desc
      if (sortField !== 'createdAt') {
        const timeCmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (timeCmp !== 0) return timeCmp;
      }

      return 0;
    });

  const totalPages = Math.ceil(filteredAlerts.length / pageSize) || 1;
  const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleAcknowledge = async (alert: ActiveAlertEntity) => {
    if (onAcknowledgeAlert) {
      await onAcknowledgeAlert(alert.id);
      const hasObj = Boolean(alert.objectName && alert.objectName.trim() !== '');
      const metricTitle = hasObj ? `${alert.metricName} of ${alert.objectName}` : alert.metricName;
      toast({
        title: 'Alert Acknowledged',
        description: `Alert for "${metricTitle}" on "${alert.dbName}" updated from OPEN to ACK.`,
        type: 'info',
      });
    }
  };

  const handleClear = (alert: ActiveAlertEntity) => {
    if (userRole !== 'ADMIN') {
      toast({
        title: 'Permission Denied',
        description: 'Only users with the ADMIN role can clear active alerts.',
        type: 'error',
      });
      return;
    }
    onClearAlert(alert.id);
    const hasObj = Boolean(alert.objectName && alert.objectName.trim() !== '');
    const metricTitle = hasObj ? `${alert.metricName} of ${alert.objectName}` : alert.metricName;
    toast({
      title: 'Incident Cleared',
      description: `Alert for "${metricTitle}" on "${alert.dbName}" cleared and archived.`,
      type: 'success',
    });
  };

  const columns: Column<ActiveAlertEntity>[] = [
    {
      header: 'State',
      accessorKey: 'status',
      sortable: true,
      width: '90px',
      cell: (row) => {
        const status = row.status || 'OPEN';
        return status === 'OPEN' ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            OPEN
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shadow-2xs"
            title={`Acknowledged by ${row.acknowledgedByName || 'User'} at ${row.acknowledgedAt ? formatTimeVN(row.acknowledgedAt) : ''}`}
          >
            <CheckCircle className="w-3 h-3 text-amber-600" />
            ACK
          </span>
        );
      },
    },
    {
      header: 'Severity',
      accessorKey: 'alertLevel',
      sortable: true,
      width: '85px',
      cell: (row) => {
        const styles = {
          DOWN: 'bg-rose-50 text-rose-700 border-rose-200',
          CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
          HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
          WARN: 'bg-amber-50 text-amber-700 border-amber-200',
        }[row.alertLevel] || 'bg-slate-100 text-slate-700 border-slate-200';

        return (
          <span className={cn('px-2 py-0.5 border rounded text-[10px] font-bold tracking-wider inline-block', styles)}>
            {row.alertLevel}
          </span>
        );
      },
    },
    {
      header: 'Database & Engine',
      accessorKey: 'dbName',
      sortable: true,
      width: '180px',
      cell: (row) => {
        const dbObj = databases.find((d) => d.id === row.dbId);
        const ipPort = dbObj ? `${dbObj.host}:${dbObj.port}` : '127.0.0.1:3306';
        const engineBadge = dbObj ? getDbEngineBadgeClass(dbObj.dbType) : 'text-slate-600 bg-slate-100 border-slate-200';
        return (
          <div>
            <span className="font-semibold text-slate-900 text-xs tracking-tight flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {row.dbName}
            </span>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {ipPort}
            </div>
            {dbObj && (
              <span className={`px-1.5 py-0.2 text-[9px] font-bold border rounded mt-0.5 inline-block ${engineBadge}`}>
                {dbObj.dbType}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Metric',
      accessorKey: 'metricName',
      sortable: true,
      width: '240px',
      cell: (row) => {
        const hasObj = Boolean(row.objectName && row.objectName.trim() !== '');
        const metricTitle = hasObj ? `${row.metricName} of ${row.objectName}` : row.metricName;
        return (
          <div className="space-y-0.5">
            <span className="text-slate-900 text-xs font-bold block" title={metricTitle}>
              {metricTitle}
            </span>
            {row.attributeName && (
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 inline-block">
                Attr: {row.attributeName}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Incident Message',
      accessorKey: 'message',
      sortable: true,
      cell: (row) => (
        <span className="text-slate-600 text-xs leading-relaxed block w-full pr-4 whitespace-normal break-words">
          {row.message}
        </span>
      ),
    },
    {
      header: 'Detected',
      accessorKey: 'createdAt',
      sortable: true,
      width: '150px',
      cell: (row) => (
        <span className="text-slate-500 text-xs font-mono">
          {formatTimeVN(row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      width: '150px',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {(row.status === 'OPEN' || !row.status) && onAcknowledgeAlert && (
            <button
              onClick={() => handleAcknowledge(row)}
              className="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs font-semibold px-2 py-1 rounded border border-amber-200 transition-colors cursor-pointer"
              title="Acknowledge alert"
            >
              Ack
            </button>
          )}
          {userRole === 'ADMIN' ? (
            <button
              onClick={() => handleClear(row)}
              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 text-xs font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
            >
              Clear
            </button>
          ) : (
            <span className="text-slate-400 text-xs italic">Read-only</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Guidance Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">Dedicated Active Incident Monitoring</div>
            <div>
              Real-time active alerts monitoring view equipped with <strong>1-Minute Auto-Refresh Control</strong>. Alerts refresh automatically every 60 seconds to ensure immediate visibility of critical threshold breaches.
            </div>
          </div>
        </div>
      )}

      {/* Header & Auto-Refresh Control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Active Incident Alerts ({filteredAlerts.length})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Current active threshold breaches requiring administrative resolution or monitoring.
          </p>
        </div>

        {/* 1-Minute Auto-Refresh Control Bar */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2 px-2 border-r border-slate-200">
            <Clock className="w-4 h-4 text-indigo-600" />
            <div className="text-xs">
              <span className="font-semibold text-slate-700 block text-[11px]">Auto-Refresh (1-Min)</span>
              <span className="font-mono text-[10px] text-slate-500">
                {autoRefreshEnabled ? `Next in ${secondsRemaining}s` : 'Paused'}
              </span>
            </div>
          </div>

          <button
            onClick={handleToggleAutoRefresh}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer',
              autoRefreshEnabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            )}
            title={autoRefreshEnabled ? 'Pause 1-Minute Auto-Refresh' : 'Enable 1-Minute Auto-Refresh'}
          >
            {autoRefreshEnabled ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auto-Refresh ON</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-slate-500" />
                <span>Auto-Refresh OFF</span>
              </>
            )}
          </button>

          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* 6 Replicated High-Level Summary Cards with Hover Tooltips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* Monitored DBs */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs relative">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Monitored DBs
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{databases.length}</div>
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
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border',
              warnAlertsCount > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-100'
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

      {/* Compact Filter Controls Bar */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="font-bold text-slate-800 text-xs whitespace-nowrap">Filter Alerts:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          {/* Database Engine Filter */}
          <select
            value={selectedDbType}
            onChange={(e) => {
              setSelectedDbType(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-300 text-xs px-2.5 py-1 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Database Engines</option>
            {DB_ENGINES.map((eng) => (
              <option key={eng.code} value={eng.code}>
                {eng.name} ({eng.code})
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-300 text-xs px-2.5 py-1 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical & Down</option>
            <option value="HIGH">High</option>
            <option value="WARN">Warning</option>
          </select>

          {/* Compact Search Box */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search DB, metric or message..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 text-xs pl-8 pr-2.5 py-1 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Active Alerts Table */}
      <div className="flex-1 flex flex-col min-h-[600px]">
        <DataTable
          columns={columns}
          data={paginatedAlerts}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filteredAlerts.length}
          pageSize={pageSize}
          pageSizeOptions={[15, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          emptyMessage="No active incident alerts detected for the selected filter criteria."
        />
      </div>
    </div>
  );
};
