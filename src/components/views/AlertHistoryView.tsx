import React, { useState, useMemo } from 'react';
import { History, Search, Calendar, Server, Filter, RefreshCw, CheckCircle2, Clock, Zap, Database } from 'lucide-react';
import { AlertHistoryEntity, DatabaseEntity } from '../../types';
import { DB_ENGINES } from '../../config/dbEngines';
import { DataTable, Column } from '../tables/DataTable';
import { formatTimeVN, cn } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n';

interface AlertHistoryViewProps {
  alertHistory: AlertHistoryEntity[];
  databases: DatabaseEntity[];
  onRefresh: () => void;
  showInfoTips?: boolean;
}

export const AlertHistoryView: React.FC<AlertHistoryViewProps> = ({
  alertHistory,
  databases,
  onRefresh,
  showInfoTips = true,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Compute 30 days ago and today as default date range
  const defaultToDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const defaultFromDate = useMemo(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().split('T')[0];
  }, []);

  // Filter States
  const [fromDate, setFromDate] = useState<string>(defaultFromDate);
  const [toDate, setToDate] = useState<string>(defaultToDate);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDbType, setSelectedDbType] = useState<string>('ALL');
  const [selectedDbId, setSelectedDbId] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');

  // Quick Presets
  const applyPreset = (days: number | 'ALL') => {
    if (days === 'ALL') {
      setFromDate('');
      setToDate('');
    } else {
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      setFromDate(from);
      setToDate(to);
    }
    setCurrentPage(1);
  };

  // Filter databases based on selected database engine type for the dropdown
  const filteredDatabasesForDropdown = useMemo(() => {
    if (selectedDbType === 'ALL') return databases;
    return databases.filter((db) => db.dbType.toUpperCase() === selectedDbType.toUpperCase());
  }, [databases, selectedDbType]);

  // Database ID to DB entity map for quick type resolution
  const dbMap = useMemo(() => {
    const map = new Map<string, DatabaseEntity>();
    databases.forEach((db) => map.set(db.id, db));
    return map;
  }, [databases]);

  const filteredHistory = useMemo(() => {
    return alertHistory.filter((item) => {
      // Date Range Filter (inclusive of entire days)
      if (fromDate) {
        const itemDate = new Date(item.createdAt).toISOString().split('T')[0];
        if (itemDate < fromDate) return false;
      }
      if (toDate) {
        const itemDate = new Date(item.createdAt).toISOString().split('T')[0];
        if (itemDate > toDate) return false;
      }

      // DB Type Filter
      if (selectedDbType !== 'ALL') {
        const db = dbMap.get(item.dbId);
        if (!db || db.dbType.toUpperCase() !== selectedDbType.toUpperCase()) {
          return false;
        }
      }

      // Search Term Filter
      const matchesSearch =
        item.dbName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.metricName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.clearedByName && item.clearedByName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesDb = selectedDbId === 'ALL' || item.dbId === selectedDbId;
      const matchesLevel = selectedLevel === 'ALL' || item.alertLevel === selectedLevel;

      return matchesSearch && matchesDb && matchesLevel;
    });
  }, [alertHistory, fromDate, toDate, searchTerm, selectedDbType, selectedDbId, selectedLevel, dbMap]);

  const totalPages = Math.ceil(filteredHistory.length / pageSize) || 1;
  const paginatedData = filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<AlertHistoryEntity>[] = [
    {
      header: t('alertHistory.colStatusSeverity'),
      width: '130px',
      cell: (row) => {
        const state = row.resolutionStatus || 'CLOSED';
        const isUserCleared = !!row.clearedByName && row.clearedByName !== 'System Auto-Clear';
        const isDispatched = row.dispatchStatus === 'DISPATCHED' || !row.dispatchStatus;
        const styles = {
          DOWN: 'bg-rose-50 text-rose-700 border-rose-200',
          CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
          HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
          WARN: 'bg-amber-50 text-amber-700 border-amber-200',
        }[row.alertLevel] || 'bg-slate-100 text-slate-700 border-slate-200';

        return (
          <div className="space-y-1 py-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              <span className={cn('px-1.5 py-0.2 border rounded text-[9px] font-bold tracking-wider', styles)}>
                {row.alertLevel}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                {isUserCleared ? 'CLEARED' : state}
              </span>
            </div>
            <div>
              <span className={cn('inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded', isDispatched ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-slate-600 bg-slate-100 border border-slate-200')}>
                {isDispatched ? 'DISPATCHED' : 'PENDING'}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      header: t('alertHistory.colDatabase'),
      accessorKey: 'dbName',
      width: '140px',
      cell: (row) => {
        const db = dbMap.get(row.dbId);
        const ipPort = db ? `${db.host}:${db.port}` : '127.0.0.1:3306';
        return (
          <div>
            <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
              <Server className="w-3 h-3 text-slate-400 shrink-0" />
              {row.dbName}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {ipPort}
            </div>
            {db && (
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 mt-0.5 inline-block">
                {db.dbType}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: t('alertHistory.colMetric'),
      accessorKey: 'metricName',
      width: '180px',
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="text-slate-900 text-xs font-bold block">{row.metricName}</span>
          <div className="flex items-center gap-1 flex-wrap">
            {row.objectName && (
              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 font-semibold">
                Obj: {row.objectName}
              </span>
            )}
            {row.attributeName && (
              <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                Attr: {row.attributeName}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: t('alertHistory.colMessage'),
      accessorKey: 'message',
      cell: (row) => (
        <span className="text-slate-600 text-xs leading-relaxed block w-full min-w-[280px]">
          {row.message}
        </span>
      ),
    },
    {
      header: t('alertHistory.colRaisedAt'),
      accessorKey: 'createdAt',
      width: '150px',
      cell: (row) => (
        <span className="text-slate-500 text-xs font-mono">{formatTimeVN(row.createdAt)}</span>
      ),
    },
    {
      header: t('alertHistory.colClearedResolver'),
      accessorKey: 'clearedAt',
      width: '180px',
      cell: (row) => {
        let resolverLabel = 'Clear normal';
        let resolverStyle = 'text-slate-700 font-medium';

        const status = row.resolutionStatus;
        if (status === 'RESOLVED_BY_LEVEL_CHANGE') {
          resolverLabel = 'change alert level';
          resolverStyle = 'text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] inline-block';
        } else if (status === 'AUTO_RESOLVED') {
          resolverLabel = 'Clear normal';
          resolverStyle = 'text-slate-600 font-medium';
        } else if (row.clearedByName && row.clearedByName !== 'System Auto-Clear') {
          resolverLabel = row.clearedByName;
          resolverStyle = 'text-slate-700 font-medium';
        } else {
          resolverLabel = 'Clear normal';
          resolverStyle = 'text-slate-600 font-medium';
        }

        return (
          <div>
            <div className="text-emerald-700 text-xs font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {formatTimeVN(row.clearedAt)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
              <span>By:</span>
              <span className={resolverStyle}>{resolverLabel}</span>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            {t('alertHistory.title')}
          </h2>
          <p className="text-xs text-slate-500">
            {t('alertHistory.subtitle')} ({filteredHistory.length})
          </p>
        </div>

        <button
          onClick={() => {
            onRefresh();
            toast({ title: 'Refreshed', description: 'Alert history reloaded from storage.', type: 'info' });
          }}
          className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs px-3.5 py-1.5 rounded-lg border border-slate-300 font-medium transition-colors shadow-2xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('alertHistory.refreshLog')}
        </button>
      </div>

      {/* Query Optimization Info Banner */}
      {showInfoTips && (
        <div className="p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs text-indigo-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>{t('alertHistory.queryOptTitle')}</strong> {t('alertHistory.queryOptDesc')}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono font-semibold bg-white px-2.5 py-0.5 rounded border border-indigo-200">
            <Calendar className="w-3 h-3 text-indigo-500" />
            {fromDate || 'Start'} → {toDate || 'Present'}
          </div>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
        {/* Row 1: Date Range Filter and Presets */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {t('alertHistory.fromDate')}
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {t('alertHistory.toDate')}
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-slate-400 mr-1">{t('alertHistory.presets')}</span>
            <button
              type="button"
              onClick={() => applyPreset(7)}
              className="px-2.5 py-1 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-medium cursor-pointer"
            >
              {t('alertHistory.last7Days')}
            </button>
            <button
              type="button"
              onClick={() => applyPreset(30)}
              className="px-2.5 py-1 text-xs rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors font-semibold cursor-pointer"
            >
              {t('alertHistory.last30Days')}
            </button>
            <button
              type="button"
              onClick={() => applyPreset(90)}
              className="px-2.5 py-1 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-medium cursor-pointer"
            >
              {t('alertHistory.last90Days')}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('ALL')}
              className="px-2.5 py-1 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-medium cursor-pointer"
            >
              {t('alertHistory.allTime')}
            </button>
          </div>
        </div>

        {/* Row 2: DB Type, DB, Severity, and Keywords */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Database Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              {t('templates.targetEngine')}
            </label>
            <select
              value={selectedDbType}
              onChange={(e) => {
                setSelectedDbType(e.target.value);
                setSelectedDbId('ALL');
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">{t('alertHistory.allEngines')} ({databases.length})</option>
              {DB_ENGINES.map((engine) => {
                const count = databases.filter((db) => db.dbType.toUpperCase() === engine.code.toUpperCase()).length;
                return (
                  <option key={engine.code} value={engine.code}>
                    {engine.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-indigo-600" />
              {t('alertHistory.colDatabase')}
            </label>
            <select
              value={selectedDbId}
              onChange={(e) => {
                setSelectedDbId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">{t('alertHistory.allDatabases')} ({filteredDatabasesForDropdown.length})</option>
              {filteredDatabasesForDropdown.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name} ({db.dbType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              {t('alertHistory.colStatusSeverity')}
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">{t('alertHistory.allLevels')}</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="WARN">Warning</option>
              <option value="DOWN">Down</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              {t('analytics.search')}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={t('alertHistory.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1">
        <DataTable
          columns={columns}
          data={paginatedData}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filteredHistory.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          emptyMessage="No historical alerts match the specified date range and criteria."
        />
      </div>
    </div>
  );
};

