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
  Trash2,
  Download
} from 'lucide-react';
import { ActiveAlertEntity, DatabaseEntity, UserRole } from '../../types';
import { DB_ENGINES, getDbEngineBadgeClass } from '../../config/dbEngines';
import { DataTable, Column } from '../tables/DataTable';
import { formatTimeVN, formatRelativeDuration, cn } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n/LanguageContext';
import { AutoRefreshControl } from '../common/AutoRefreshControl';
import { SummaryMetricCards } from '../common/SummaryMetricCards';
import { DatabaseEngineFilter } from '../common/DatabaseEngineFilter';

interface ActiveAlertsViewProps {
  databases: DatabaseEntity[];
  activeAlerts: ActiveAlertEntity[];
  onClearAlert: (alertId: string) => Promise<any> | void;
  onAcknowledgeAlert?: (alertId: string) => Promise<any> | void;
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
  const { t, language } = useTranslation();

  // Filters & Sorting State
  const [selectedDbType, setSelectedDbType] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<string>('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSortChange = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'createdAt' || field === 'during' ? 'desc' : 'asc');
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
      } else if (sortField === 'during') {
        // during: asc = shortest elapsed time (more recent first), desc = longest elapsed time (older first)
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        primaryCmp = timeB - timeA;
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
      if (sortField !== 'createdAt' && sortField !== 'during') {
        const timeCmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (timeCmp !== 0) return timeCmp;
      }

      return 0;
    });

  const totalPages = Math.ceil(filteredAlerts.length / pageSize) || 1;
  const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Dynamic Row Styling:
  // - Unacknowledged (not ACK): animated pulsating/blinking state
  // - Unacknowledged DOWN: intense impressive red blinking background
  // - Acknowledged (ACK): calm, static subtle green-bordered state
  const getRowClassName = (row: ActiveAlertEntity) => {
    const isUnack = row.status === 'OPEN' || !row.status;
    const isDown = row.alertLevel === 'DOWN' || row.alertLevel?.toUpperCase() === 'DOWN';

    if (isUnack) {
      if (isDown) {
        return 'alert-row-down-unack border-l-4 border-l-red-600 font-medium text-slate-900 shadow-xs';
      }
      if (row.alertLevel === 'CRITICAL') {
        return 'alert-row-critical-unack border-l-4 border-l-rose-500 font-medium text-slate-900';
      }
      if (row.alertLevel === 'HIGH') {
        return 'alert-row-high-unack border-l-4 border-l-orange-500 font-medium text-slate-900';
      }
      if (row.alertLevel === 'WARN') {
        return 'alert-row-warn-unack border-l-4 border-l-amber-500 font-medium text-slate-900';
      }
      return 'alert-row-default-unack border-l-4 border-l-indigo-400 font-medium text-slate-900';
    }

    return 'hover:bg-slate-50/80 bg-white text-slate-700 opacity-90 border-l-4 border-l-emerald-400';
  };

  const handleAcknowledge = async (alert: ActiveAlertEntity) => {
    if (onAcknowledgeAlert) {
      await onAcknowledgeAlert(alert.id);
      const hasObj = Boolean(alert.objectName && alert.objectName.trim() !== '');
      const metricTitle = hasObj ? `${alert.metricName} of ${alert.objectName}` : alert.metricName;
      toast({
        title: t('activeAlerts.alertAcknowledged'),
        description: `Alert for "${metricTitle}" on "${alert.dbName}" updated from OPEN to ACK.`,
        type: 'info',
      });
    }
  };

  const handleClear = async (alert: ActiveAlertEntity) => {
    if (userRole !== 'ADMIN') {
      toast({
        title: t('activeAlerts.permissionDenied'),
        description: t('activeAlerts.adminOnlyClear'),
        type: 'error',
      });
      return;
    }
    await onClearAlert(alert.id);
    const hasObj = Boolean(alert.objectName && alert.objectName.trim() !== '');
    const metricTitle = hasObj ? `${alert.metricName} of ${alert.objectName}` : alert.metricName;
    toast({
      title: t('activeAlerts.incidentCleared'),
      description: `Alert for "${metricTitle}" on "${alert.dbName}" cleared and archived.`,
      type: 'success',
    });
  };

  const handleExportCsv = () => {
    // Export all active alerts
    const alertsToExport = activeAlerts;
    if (!alertsToExport || alertsToExport.length === 0) {
      toast({
        title: t('activeAlerts.noAlertsToExport') || 'No Active Alerts',
        description: t('activeAlerts.noAlertsToExportDesc') || 'There are no active alerts to export.',
        type: 'info',
      });
      return;
    }

    const headers = [
      'Alert ID',
      'Database Name',
      'Database Engine',
      'Host:Port',
      'Severity',
      'Status',
      'Metric Name',
      'Object Name',
      'Attribute Name',
      'Incident Message',
      'Detected At (UTC)',
      'Detected At (Local)',
      'Acknowledged At',
      'Acknowledged By',
    ];

    const rows = alertsToExport.map((a) => {
      const db = databases.find((d) => d.id === a.dbId || d.name === a.dbName);
      const dbEngine = db?.dbType || '';
      const ipPort = db ? `${db.host}:${db.port}` : '';
      const isAck = a.status === 'ACKNOWLEDGED' || Boolean(a.acknowledgedAt);
      const statusText = isAck ? 'ACKNOWLEDGED' : 'OPEN';

      return [
        `"${String(a.id || '').replace(/"/g, '""')}"`,
        `"${String(a.dbName || '').replace(/"/g, '""')}"`,
        `"${String(dbEngine).replace(/"/g, '""')}"`,
        `"${String(ipPort).replace(/"/g, '""')}"`,
        `"${String(a.alertLevel || '').replace(/"/g, '""')}"`,
        `"${statusText}"`,
        `"${String(a.metricName || '').replace(/"/g, '""')}"`,
        `"${String(a.objectName || '').replace(/"/g, '""')}"`,
        `"${String(a.attributeName || '').replace(/"/g, '""')}"`,
        `"${String(a.message || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
        `"${String(a.createdAt || '')}"`,
        `"${formatTimeVN(a.createdAt)}"`,
        `"${a.acknowledgedAt ? formatTimeVN(a.acknowledgedAt) : ''}"`,
        `"${String(a.acknowledgedByName || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_');
    link.href = url;
    link.download = `active_alerts_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t('activeAlerts.alertsExported') || 'Active Alerts Exported',
      description: t('activeAlerts.alertsExportedDesc', { count: alertsToExport.length }) || `Exported ${alertsToExport.length} active alert(s) to CSV.`,
      type: 'success',
    });
  };

  const columns: Column<ActiveAlertEntity>[] = [
    {
      header: t('activeAlerts.severity'),
      accessorKey: 'alertLevel',
      sortable: true,
      width: '105px',
      cell: (row) => {
        const isUnack = row.status === 'OPEN' || !row.status;
        const isDown = row.alertLevel === 'DOWN' || row.alertLevel?.toUpperCase() === 'DOWN';

        if (isUnack) {
          if (isDown) {
            return (
              <div className="flex flex-col gap-1 items-start">
                <span className="px-2 py-0.5 border border-red-700 rounded text-[10px] font-black tracking-wider bg-red-600 text-white shadow-sm inline-flex items-center gap-1.5 animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  DOWN
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-red-100 text-red-900 border border-red-300 animate-pulse inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping shrink-0" />
                  UNACK
                </span>
              </div>
            );
          }

          if (row.alertLevel === 'CRITICAL') {
            return (
              <div className="flex flex-col gap-1 items-start">
                <span className="px-2 py-0.5 border border-rose-300 rounded text-[10px] font-extrabold tracking-wider bg-rose-100 text-rose-800 shadow-2xs inline-flex items-center gap-1.5 animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                  </span>
                  CRITICAL
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                  UNACK
                </span>
              </div>
            );
          }

          if (row.alertLevel === 'HIGH') {
            return (
              <div className="flex flex-col gap-1 items-start">
                <span className="px-2 py-0.5 border border-orange-300 rounded text-[10px] font-bold tracking-wider bg-orange-100 text-orange-800 shadow-2xs inline-flex items-center gap-1.5 animate-pulse">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-600"></span>
                  </span>
                  HIGH
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
                  UNACK
                </span>
              </div>
            );
          }

          // WARN or others
          return (
            <div className="flex flex-col gap-1 items-start">
              <span className="px-2 py-0.5 border border-amber-300 rounded text-[10px] font-bold tracking-wider bg-amber-100 text-amber-800 shadow-2xs inline-flex items-center gap-1.5 animate-pulse">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600"></span>
                </span>
                WARN
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                UNACK
              </span>
            </div>
          );
        }

        // Acknowledged (ACK) - peaceful static state
        const styles = {
          DOWN: 'bg-rose-50 text-rose-700 border-rose-200',
          CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
          HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
          WARN: 'bg-amber-50 text-amber-700 border-amber-200',
        }[row.alertLevel] || 'bg-slate-100 text-slate-700 border-slate-200';

        return (
          <div className="flex flex-col gap-1 items-start">
            <span className={cn('px-2 py-0.5 border rounded text-[10px] font-bold tracking-wider inline-block', styles)}>
              {row.alertLevel}
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
              ACK
            </span>
          </div>
        );
      },
    },
    {
      header: t('activeAlerts.databaseAndEngine'),
      accessorKey: 'dbName',
      sortable: true,
      width: '180px',
      cell: (row) => {
        const dbObj = databases.find((d) => d.id === row.dbId);
        const ipPort = dbObj ? `${dbObj.host}:${dbObj.port}` : '127.0.0.1:3306';
        const engineBadge = dbObj ? getDbEngineBadgeClass(dbObj.dbType) : 'text-slate-600 bg-slate-100 border-slate-200';
        return (
          <div className="font-bold text-slate-900">
            <span className="font-bold text-slate-900 text-xs tracking-tight flex items-center gap-1.5">
              {dbObj && (
                <span className={`px-1.5 py-0.2 text-[9px] font-bold border rounded mt-0.5 inline-block ${engineBadge}`}>
                  {dbObj.dbType}
                </span>
              )}
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {ipPort}
              </div>
            </span>
            {row.dbName}
          </div>
        );
      },
    },
    {
      header: t('activeAlerts.metric'),
      accessorKey: 'metricName',
      sortable: true,
      width: '240px',
      cell: (row) => {
        const hasObj = Boolean(row.objectName && row.objectName.trim() !== 'DATABASEFARM_METRIC');
        const hasAttr = Boolean(row.attributeName && row.attributeName.trim() !== '' && row.attributeName.trim() !== 'value');
        const metricTitleL1 = hasObj ? `${row.metricName} of ${row.objectName}` : row.metricName;
        const metricTitle = hasAttr ? `${metricTitleL1}.${row.attributeName}` : metricTitleL1;
        return (
          <div className="space-y-0.5">
            <span className="text-slate-900 text-xs font-semibold block" title={metricTitle}>
              {metricTitle}
            </span>
          </div>
        );
      },
    },
    {
      header: t('activeAlerts.incidentMessage'),
      accessorKey: 'message',
      sortable: true,
      cell: (row) => (
        <span className="text-slate-600 text-xs leading-relaxed block w-full pr-4 whitespace-normal break-words">
          {row.message}
        </span>
      ),
    },
    {
      header: t('activeAlerts.detected'),
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
      header: t('activeAlerts.during'),
      accessorKey: 'during',
      sortable: true,
      width: '150px',
      cell: (row) => (
        <span className="text-slate-700 text-xs font-medium whitespace-nowrap">
          {formatRelativeDuration(row.createdAt, language)}
        </span>
      ),
    },
    {
      header: t('activeAlerts.action'),
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
              {t('activeAlerts.ack')}
            </button>
          )}
          {userRole === 'ADMIN' ? (
            <button
              onClick={() => handleClear(row)}
              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 text-xs font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
            >
              {t('activeAlerts.clear')}
            </button>
          ) : (
            <span className="text-slate-400 text-xs italic">{t('common.readOnly')}</span>
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
            <div className="font-bold text-slate-900 text-sm">{t('activeAlerts.guidanceTitle')}</div>
            <div>
              {t('activeAlerts.guidanceDesc')}
            </div>
          </div>
        </div>
      )}

      {/* Header & Auto-Refresh Control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            {t('activeAlerts.activeIncidentAlerts')} ({filteredAlerts.length})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('activeAlerts.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AutoRefreshControl
            onRefresh={onRefresh}
            toastTitle="Alerts Refreshed"
            toastDescription="Active incidents re-evaluated and synchronized."
          />
          <button
            onClick={handleExportCsv}
            title={t('activeAlerts.exportAllCsv') || 'Export all active alerts to CSV'}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs px-3 py-1 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('activeAlerts.exportCsv')}</span>
          </button>
        </div>
      </div>

      {/* 6 Replicated High-Level Summary Cards */}
      <SummaryMetricCards
        databases={databases}
        activeAlerts={activeAlerts}
        selectedDbType={selectedDbType}
      />

      {/* Compact Filter Controls Bar */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="font-bold text-slate-800 text-xs whitespace-nowrap">{t('common.filter')}:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          {/* Database Engine Filter */}
          <DatabaseEngineFilter
            value={selectedDbType}
            onChange={(val) => {
              setSelectedDbType(val);
              setCurrentPage(1);
            }}
            databases={databases}
            allLabel={t('common.allEngines')}
          />

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-300 text-xs px-2.5 py-1 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">{t('common.allSeverities')}</option>
            <option value="CRITICAL">{t('common.critical')} & Down</option>
            <option value="HIGH">{t('common.high')}</option>
            <option value="WARN">{t('common.warning')}</option>
          </select>

          {/* Compact Search Box */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder={t('activeAlerts.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 text-xs pl-8 pr-2.5 py-1 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {/* Export CSV button */}
          <button
            onClick={handleExportCsv}
            title={t('activeAlerts.exportAllCsv') || 'Export all active alerts to CSV'}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('activeAlerts.exportCsv')}</span>
          </button>
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
          rowClassName={getRowClassName}
          emptyMessage={t('common.noDataFound')}
        />
      </div>
    </div>
  );
};
