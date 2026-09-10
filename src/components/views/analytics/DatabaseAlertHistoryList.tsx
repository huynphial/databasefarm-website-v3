import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
} from 'lucide-react';
import { AlertHistoryEntity, DatabaseEntity } from '../../../types';
import { formatTimeVN, formatRelativeDuration, cn } from '../../../lib/utils';
import { useTranslation } from '../../../i18n';
import { useToast } from '../../ui/Toast';

interface DatabaseAlertHistoryListProps {
  alertHistory: AlertHistoryEntity[];
  selectedDb: DatabaseEntity | null;
  selectedDbName?: string;
}

type TimePreset = '1D' | '7D' | '30D' | '90D' | 'ALL' | 'CUSTOM';

export const DatabaseAlertHistoryList: React.FC<DatabaseAlertHistoryListProps> = ({
  alertHistory,
  selectedDb,
  selectedDbName,
}) => {
  const { t, language } = useTranslation();
  const { toast } = useToast();

  // 1. Separate Filter States for Alert History
  // Default time range preset is 7 Days ('7D')
  const [timePreset, setTimePreset] = useState<TimePreset>('7D');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Custom date range state (when preset is 'CUSTOM')
  const defaultTo = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultFrom = useMemo(() => {
    const d = new Date(Date.now() - 7 * 86400000);
    return d.toISOString().split('T')[0];
  }, []);

  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<'clearedAt' | 'createdAt' | 'during' | 'alertLevel' | 'metricName' | 'dispatchStatus'>('clearedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Handle Preset Selection
  const handlePresetChange = (preset: TimePreset) => {
    setTimePreset(preset);
    setCurrentPage(1);
    if (preset !== 'CUSTOM') {
      const toStr = new Date().toISOString().split('T')[0];
      setToDate(toStr);
      if (preset === '1D') {
        const fromStr = new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0];
        setFromDate(fromStr);
      } else if (preset === '7D') {
        const fromStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        setFromDate(fromStr);
      } else if (preset === '30D') {
        const fromStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        setFromDate(fromStr);
      } else if (preset === '90D') {
        const fromStr = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
        setFromDate(fromStr);
      } else if (preset === 'ALL') {
        setFromDate('');
        setToDate('');
      }
    }
  };

  // Reset Filters to default
  const handleResetFilters = () => {
    setTimePreset('7D');
    setSelectedLevel('ALL');
    setSearchTerm('');
    setFromDate(defaultFrom);
    setToDate(defaultTo);
    setCurrentPage(1);
  };

  const isFiltered = timePreset !== '7D' || selectedLevel !== 'ALL' || searchTerm.trim() !== '';

  // Filter alert history specifically for selected database and separate filters
  const filteredHistory = useMemo(() => {
    if (!alertHistory || !Array.isArray(alertHistory)) return [];

    // Filter by Database ID first if selectedDb exists
    let list = alertHistory;
    if (selectedDb?.id) {
      list = list.filter((item) => String(item.dbId) === String(selectedDb.id));
    }

    // Filter by Time Range
    const now = Date.now();
    let startTime = 0;
    if (timePreset === '1D') {
      startTime = now - 1 * 86400000;
    } else if (timePreset === '7D') {
      startTime = now - 7 * 86400000;
    } else if (timePreset === '30D') {
      startTime = now - 30 * 86400000;
    } else if (timePreset === '90D') {
      startTime = now - 90 * 86400000;
    } else if (timePreset === 'CUSTOM') {
      list = list.filter((item) => {
        const itemTime = new Date(item.clearedAt || item.createdAt).getTime();
        if (fromDate) {
          const fromTs = new Date(`${fromDate}T00:00:00`).getTime();
          if (itemTime < fromTs) return false;
        }
        if (toDate) {
          const toTs = new Date(`${toDate}T23:59:59`).getTime();
          if (itemTime > toTs) return false;
        }
        return true;
      });
    }

    if (timePreset !== 'ALL' && timePreset !== 'CUSTOM' && startTime > 0) {
      list = list.filter((item) => {
        const itemTime = new Date(item.clearedAt || item.createdAt).getTime();
        return itemTime >= startTime;
      });
    }

    // Filter by Severity Level
    if (selectedLevel !== 'ALL') {
      list = list.filter((item) => {
        const lvl = (item.alertLevel || '').toUpperCase();
        const sel = selectedLevel.toUpperCase();
        if (sel === 'WARN') {
          return lvl === 'WARN' || lvl === 'WARNING';
        }
        return lvl === sel;
      });
    }

    // Filter by Search Query
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase().trim();
      list = list.filter((item) => {
        return (
          item.metricName?.toLowerCase().includes(query) ||
          item.message?.toLowerCase().includes(query) ||
          item.objectName?.toLowerCase().includes(query) ||
          item.attributeName?.toLowerCase().includes(query) ||
          item.clearedByName?.toLowerCase().includes(query)
        );
      });
    }

    // Sort
    return list.sort((a, b) => {
      let primaryCmp = 0;
      if (sortField === 'createdAt') {
        primaryCmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'clearedAt') {
        primaryCmp = new Date(a.clearedAt).getTime() - new Date(b.clearedAt).getTime();
      } else if (sortField === 'during') {
        const durA = Math.max(0, new Date(a.clearedAt).getTime() - new Date(a.createdAt).getTime());
        const durB = Math.max(0, new Date(b.clearedAt).getTime() - new Date(b.createdAt).getTime());
        primaryCmp = durA - durB;
      } else if (sortField === 'metricName') {
        primaryCmp = (a.metricName || '').localeCompare(b.metricName || '');
      } else if (sortField === 'alertLevel') {
        const rank: Record<string, number> = { DOWN: 4, CRITICAL: 3, HIGH: 2, WARN: 1, WARNING: 1 };
        primaryCmp = (rank[a.alertLevel?.toUpperCase()] || 0) - (rank[b.alertLevel?.toUpperCase()] || 0);
      } else if (sortField === 'dispatchStatus') {
        primaryCmp = (a.dispatchStatus || '').localeCompare(b.dispatchStatus || '');
      } else {
        primaryCmp = new Date(a.clearedAt).getTime() - new Date(b.clearedAt).getTime();
      }

      if (sortOrder === 'desc') primaryCmp = -primaryCmp;
      if (primaryCmp !== 0) return primaryCmp;
      return new Date(b.clearedAt).getTime() - new Date(a.clearedAt).getTime();
    });
  }, [alertHistory, selectedDb, timePreset, fromDate, toDate, selectedLevel, searchTerm, sortField, sortOrder]);

  // Breakdown metrics for header summary
  const levelCounts = useMemo(() => {
    let down = 0;
    let critical = 0;
    let high = 0;
    let warn = 0;

    filteredHistory.forEach((item) => {
      const lvl = (item.alertLevel || '').toUpperCase();
      if (lvl === 'DOWN') down++;
      else if (lvl === 'CRITICAL') critical++;
      else if (lvl === 'HIGH') high++;
      else if (lvl === 'WARN' || lvl === 'WARNING') warn++;
    });

    return { down, critical, high, warn };
  }, [filteredHistory]);

  // Pagination logic
  const totalPages = Math.ceil(filteredHistory.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage, pageSize]);

  const handleSort = (field: 'clearedAt' | 'createdAt' | 'during' | 'alertLevel' | 'metricName' | 'dispatchStatus') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const dbDisplayName = selectedDbName || selectedDb?.name || t('alertHistory.allDatabases');

  // Export CSV handler
  const handleExportCsv = () => {
    if (!filteredHistory || filteredHistory.length === 0) {
      toast({
        title: t('alertHistory.noDataToExport') || 'No Data to Export',
        description: t('alertHistory.noDataToExportDesc') || 'There are no alert history records to export.',
        type: 'warning',
      });
      return;
    }

    const headers = [
      'ID',
      'Database Name',
      'Metric Name',
      'Object Name',
      'Attribute Name',
      'Alert Level',
      'Dispatch Status',
      'Incident Message',
      'Raised At',
      'Cleared At',
      'Cleared Resolver',
    ];

    const rows = filteredHistory.map((item) => [
      item.id,
      `"${item.dbName || ''}"`,
      `"${item.metricName || ''}"`,
      `"${item.objectName || ''}"`,
      `"${item.attributeName || ''}"`,
      item.alertLevel,
      item.dispatchStatus || 'NOT_DISPATCHED',
      `"${(item.message || '').replace(/"/g, '""')}"`,
      item.createdAt,
      item.clearedAt,
      `"${item.clearedByName || item.resolutionStatus || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeDbName = (selectedDb?.name || 'database').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('download', `alert_history_${safeDbName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: t('alertHistory.exportedTitle') || 'Alert History Exported',
      description: t('alertHistory.exportedDesc', { count: filteredHistory.length }) || `Exported ${filteredHistory.length} alert history record(s) to CSV.`,
      type: 'success',
    });
  };

  // Helper for rendering column sort indicator
  const renderSortIcon = (field: 'clearedAt' | 'createdAt' | 'during' | 'alertLevel' | 'metricName' | 'dispatchStatus') => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 ml-1 inline" />
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
      {/* 1. Component Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
            <History className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>
                {selectedDb
                  ? t('alertHistory.alertHistoryForName', { name: dbDisplayName })
                  : t('alertHistory.title')}
              </span>
              {selectedDb && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  {dbDisplayName}
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              {t('alertHistory.subtitle')} ({filteredHistory.length})
            </p>
          </div>
        </div>

        {/* Action Controls & Summary Pills */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {levelCounts.down > 0 && (
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
              {levelCounts.down} DOWN
            </span>
          )}
          {levelCounts.critical > 0 && (
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {levelCounts.critical} {t('alertHistory.criticalIncidents')}
            </span>
          )}
          {levelCounts.high > 0 && (
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
              {levelCounts.high} {t('alertHistory.highIncidents')}
            </span>
          )}
          {levelCounts.warn > 0 && (
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {levelCounts.warn} {t('alertHistory.warningIncidents')}
            </span>
          )}

          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
            {filteredHistory.length} {t('alertHistory.totalIncidents')}
          </span>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-all active:scale-95"
            title={t('alertHistory.exportCsv')}
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden md:inline">{t('alertHistory.exportCsv')}</span>
          </button>
        </div>
      </div>

      {/* 2. Independent Filters Toolbar */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Time Preset Buttons (Default 7 Days) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {t('alertHistory.presets')}
            </span>
            <button
              type="button"
              onClick={() => handlePresetChange('1D')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
                timePreset === '1D'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              {t('alertHistory.last24Hours')}
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('7D')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
                timePreset === '7D'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              {t('alertHistory.last7Days')} ({t('common.default')})
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('30D')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
                timePreset === '30D'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              {t('alertHistory.last30Days')}
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('90D')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
                timePreset === '90D'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              {t('alertHistory.last90Days')}
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
                timePreset === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              {t('alertHistory.allTime')}
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('CUSTOM')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
                timePreset === 'CUSTOM'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              {t('alertHistory.customRange')}
            </button>
          </div>

          {/* Alert Severity, Search & Reset Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Severity Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedLevel}
                onChange={(e) => {
                  setSelectedLevel(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">{t('alertHistory.allLevels')}</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="WARN">WARN</option>
                <option value="DOWN">DOWN</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t('alertHistory.searchPlaceholder')}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-1 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Clear Filters button if filtered */}
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors"
                title={t('alertHistory.clearFilters')}
              >
                <RotateCcw className="w-3 h-3 text-rose-600" />
                <span className="hidden sm:inline">{t('alertHistory.clearFilters')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Pickers if CUSTOM selected */}
        {timePreset === 'CUSTOM' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <span>{t('alertHistory.fromDate')}:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <span>{t('alertHistory.toDate')}:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Reformatted Alert History Log Table */}
      {filteredHistory.length === 0 ? (
        <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">
            {t('alertHistory.noDataToExport') || 'No Alert History Found'}
          </p>
          <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
            {t('alertHistory.noDataToExportDesc') || 'No historical incidents match the current database and time range filter.'}
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('alertHistory.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
                <th
                  onClick={() => handleSort('alertLevel')}
                  className="group py-2.5 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{t('alertHistory.colSeverity') || 'Severity'}</span>
                    {renderSortIcon('alertLevel')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('metricName')}
                  className="group py-2.5 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{t('alertHistory.colMetric')}</span>
                    {renderSortIcon('metricName')}
                  </div>
                </th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">{t('alertHistory.colMessage')}</th>
                <th
                  onClick={() => handleSort('createdAt')}
                  className="group py-2.5 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{t('alertHistory.colRaisedAt')}</span>
                    {renderSortIcon('createdAt')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('clearedAt')}
                  className="group py-2.5 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{t('alertHistory.colClearedState')}</span>
                    {renderSortIcon('clearedAt')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('during')}
                  className="group py-2.5 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{t('alertHistory.colDuring')}</span>
                    {renderSortIcon('during')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dispatchStatus')}
                  className="group py-2.5 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{t('alertHistory.colDispatchStatus') || 'Dispatcher Status'}</span>
                    {renderSortIcon('dispatchStatus')}
                  </div>
                </th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">{t('alertHistory.colClearedResolver')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedData.map((row) => {
                const isDispatched = row.dispatchStatus === 'DISPATCHED';
                const isDown = (row.alertLevel || '').toUpperCase() === 'DOWN';
                const isCritical = (row.alertLevel || '').toUpperCase() === 'CRITICAL';
                const isHigh = (row.alertLevel || '').toUpperCase() === 'HIGH';

                const levelBadgeClass = isDown
                  ? 'bg-red-100 text-red-800 border-red-300'
                  : isCritical
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : isHigh
                  ? 'bg-orange-100 text-orange-800 border-orange-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300';

                const hasObj = Boolean(row.objectName && row.objectName.trim() !== '' && row.objectName.trim() !== 'DATABASEFARM_METRIC');
                const hasAttr = Boolean(row.attributeName && row.attributeName.trim() !== '' && row.attributeName.trim() !== 'value');
                const metricTitleL1 = hasObj ? `${row.metricName} of ${row.objectName}` : row.metricName;
                const metricTitle = hasAttr ? `${metricTitleL1}.${row.attributeName}` : metricTitleL1;

                // Resolver Label logic with full i18n support
                let resolverLabel = t('alertHistory.resolverNormal');
                let resolverStyle = 'text-slate-700 font-medium bg-slate-100 border-slate-200';

                const status = row.resolutionStatus;
                if (status === 'RESOLVED_BY_LEVEL_CHANGE') {
                  resolverLabel = t('alertHistory.resolverLevelChange');
                  resolverStyle = 'text-amber-700 font-semibold bg-amber-50 border-amber-200';
                } else if (status === 'AUTO_RESOLVED') {
                  resolverLabel = t('alertHistory.resolverAutoClear');
                  resolverStyle = 'text-emerald-700 font-semibold bg-emerald-50 border-emerald-200';
                } else if (status === 'CLEARED_BY_USER') {
                  resolverLabel = t('alertHistory.resolverUserClear');
                  resolverStyle = 'text-red-700 font-semibold bg-red-50 border-red-200';
                } else if (row.clearedByName && row.clearedByName !== 'System Auto-Clear') {
                  resolverLabel = row.clearedByName;
                  resolverStyle = 'text-slate-700 font-medium bg-slate-100 border-slate-200';
                }

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Severity */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className={cn('px-2 py-0.5 border rounded text-[10px] font-extrabold', levelBadgeClass)}>
                        {row.alertLevel}
                      </span>
                    </td>

                    {/* Metric */}
                    <td className="py-2.5 px-3.5 max-w-[200px]">
                      <span className="text-slate-900 font-bold block truncate" title={metricTitle}>
                        {metricTitle}
                      </span>
                    </td>

                    {/* Incident Message */}
                    <td className="py-2.5 px-3.5 min-w-[240px]">
                      <p className="text-slate-700 font-medium leading-relaxed line-clamp-2" title={row.message}>
                        {row.message}
                      </p>
                    </td>

                    {/* Raised At */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {formatTimeVN(row.createdAt)}
                    </td>

                    {/* Cleared At */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] text-slate-700">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{formatTimeVN(row.clearedAt)}</span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-medium text-slate-700">
                      {formatRelativeDuration(row.createdAt, row.clearedAt, language)}
                    </td>

                    {/* Dispatcher Status */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border shadow-2xs',
                          isDispatched
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : 'text-slate-600 bg-slate-100 border-slate-200'
                        )}
                      >
                        {isDispatched ? t('alertHistory.dispatched') || 'DISPATCHED' : t('alertHistory.noDispatch') || 'NO DISPATCH'}
                      </span>
                    </td>

                    {/* Cleared Resolver */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] border inline-block', resolverStyle)}>
                        {resolverLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Pagination Controls */}
      {filteredHistory.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              {t('common.showing')} {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredHistory.length)} {t('common.of')} {filteredHistory.length}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-0.5 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10 {t('common.perPage')}</option>
              <option value={25}>25 {t('common.perPage')}</option>
              <option value={50}>50 {t('common.perPage')}</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
              {t('common.prev')}
            </button>

            <span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-800 font-bold border border-slate-200">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {t('common.next')}
              <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
