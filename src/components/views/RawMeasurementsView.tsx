import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  Download,
  Clock,
  Database,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { RawMeasurementEntity, DatabaseEntity, MetricEntity, DatabaseEngineEntity, RawMeasurementFilter } from '../../types';
import { getDbEngineBadgeClass, getDbEngineHexColor } from '../../config/dbEngines';
import { useTranslation } from '../../i18n';
import { api } from '../../lib/api';

interface RawMeasurementsViewProps {
  measurements: RawMeasurementEntity[];
  databases: DatabaseEntity[];
  metrics: MetricEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  timestampFormat?: string;
  onRefresh: () => void;
  onSimulatePoll?: () => void;
  showInfoTips?: boolean;
}

export const RawMeasurementsView: React.FC<RawMeasurementsViewProps> = ({
  measurements,
  databases,
  metrics,
  databaseEngines = [],
  timestampFormat = 'HH24:MI:SS DD/MM/YYYY',
  onRefresh,
  showInfoTips = true,
}) => {
  const { t } = useTranslation();
  const [measurementsData, setMeasurementsData] = useState<RawMeasurementEntity[]>(measurements);
  const [isSearching, setIsSearching] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [engineFilter, setEngineFilter] = useState<string>('ALL');
  const [selectedDbFilter, setSelectedDbFilter] = useState<string>('ALL');
  const [selectedMetricFilter, setSelectedMetricFilter] = useState<string>('ALL');
  const [selectedObjectFilter, setSelectedObjectFilter] = useState<string>('ALL');
  const [selectedAttributeFilter, setSelectedAttributeFilter] = useState<string>('ALL');

  // Date Range Filter (Default: Last 3 Days)
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  // Pagination state (Default: 50 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Dynamic discovery of unique objects and attributes
  const availableObjects = useMemo(() => {
    const set = new Set<string>();
    measurementsData.forEach((m) => {
      if (m.objectName && m.objectName.trim()) {
        if (selectedMetricFilter !== 'ALL' && m.metricId !== selectedMetricFilter) return;
        if (selectedDbFilter !== 'ALL' && m.dbId !== selectedDbFilter) return;
        set.add(m.objectName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [measurementsData, selectedMetricFilter, selectedDbFilter]);

  const availableAttributes = useMemo(() => {
    const set = new Set<string>();
    if (selectedMetricFilter !== 'ALL') {
      const met = metrics.find((m) => m.id === selectedMetricFilter);
      if (met?.thresholdsConfig?.perAttribute) {
        met.thresholdsConfig.perAttribute.forEach((a) => {
          if (a.attributeName && a.attributeName.trim()) set.add(a.attributeName.trim());
        });
      }
    }
    measurementsData.forEach((m) => {
      if (m.attributeName && m.attributeName.trim()) {
        if (selectedMetricFilter !== 'ALL' && m.metricId !== selectedMetricFilter) return;
        if (selectedDbFilter !== 'ALL' && m.dbId !== selectedDbFilter) return;
        set.add(m.attributeName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [measurementsData, metrics, selectedMetricFilter, selectedDbFilter]);

  // Sync with prop updates if not actively searching
  useEffect(() => {
    if (!isSearching && measurements && measurements.length > 0 && measurementsData.length === 0) {
      setMeasurementsData(measurements);
    }
  }, [measurements]);

  // Execute database query with filter criteria without row limits
  const handleRunQuery = useCallback(async (overrideFilter?: Partial<RawMeasurementFilter>) => {
    setIsSearching(true);
    try {
      const activeDb = overrideFilter?.dbId !== undefined ? overrideFilter.dbId : selectedDbFilter;
      const activeMetric = overrideFilter?.metricId !== undefined ? overrideFilter.metricId : selectedMetricFilter;
      const activeEngine = overrideFilter?.dbType !== undefined ? overrideFilter.dbType : engineFilter;
      const activeObject = overrideFilter?.objectName !== undefined ? overrideFilter.objectName : selectedObjectFilter;
      const activeAttribute = overrideFilter?.attributeName !== undefined ? overrideFilter.attributeName : selectedAttributeFilter;
      const activeFrom = overrideFilter?.fromDate !== undefined ? overrideFilter.fromDate : fromDate;
      const activeTo = overrideFilter?.toDate !== undefined ? overrideFilter.toDate : toDate;
      const activeSearch = overrideFilter?.searchTerm !== undefined ? overrideFilter.searchTerm : searchTerm;

      const data = await api.getRawMeasurements({
        dbId: activeDb !== 'ALL' ? activeDb : undefined,
        metricId: activeMetric !== 'ALL' ? activeMetric : undefined,
        dbType: activeEngine !== 'ALL' ? activeEngine : undefined,
        objectName: activeObject !== 'ALL' ? activeObject : undefined,
        attributeName: activeAttribute !== 'ALL' ? activeAttribute : undefined,
        fromDate: activeFrom || undefined,
        toDate: activeTo || undefined,
        searchTerm: activeSearch?.trim() || undefined,
        limit: 0, // 0 indicates unlimited: return all database rows matching criteria
      });

      setMeasurementsData(data || []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to query raw measurements:', err);
    } finally {
      setIsSearching(false);
    }
  }, [selectedDbFilter, selectedMetricFilter, engineFilter, selectedObjectFilter, selectedAttributeFilter, fromDate, toDate, searchTerm]);

  // Reset all filters to default state and execute search
  const handleResetFilters = async () => {
    const defaultFrom = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const defaultTo = new Date().toISOString().slice(0, 10);
    setSearchTerm('');
    setEngineFilter('ALL');
    setSelectedDbFilter('ALL');
    setSelectedMetricFilter('ALL');
    setSelectedObjectFilter('ALL');
    setSelectedAttributeFilter('ALL');
    setFromDate(defaultFrom);
    setToDate(defaultTo);
    setCurrentPage(1);

    await handleRunQuery({
      searchTerm: '',
      dbType: 'ALL',
      dbId: 'ALL',
      metricId: 'ALL',
      objectName: 'ALL',
      attributeName: 'ALL',
      fromDate: defaultFrom,
      toDate: defaultTo,
    });
  };

  // Quick Date Presets
  const handleSetQuickDate = (days: number | 'ALL') => {
    let nextFrom = '';
    let nextTo = '';
    if (days !== 'ALL') {
      const now = new Date();
      const past = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      nextTo = now.toISOString().slice(0, 10);
      nextFrom = past.toISOString().slice(0, 10);
    }
    setFromDate(nextFrom);
    setToDate(nextTo);
    setCurrentPage(1);
    handleRunQuery({ fromDate: nextFrom, toDate: nextTo });
  };

  // Client-side fallback filter ensure perfect synchronization with view state
  const filteredMeasurements = useMemo(() => {
    return measurementsData.filter((item) => {
      const matchEngine = engineFilter === 'ALL' || (item.dbType || '').toUpperCase() === engineFilter.toUpperCase();
      const matchDb = selectedDbFilter === 'ALL' || item.dbId === selectedDbFilter;
      const matchMetric = selectedMetricFilter === 'ALL' || item.metricId === selectedMetricFilter;
      const matchObject =
        selectedObjectFilter === 'ALL' ||
        (item.objectName || 'INSTANCE').trim().toLowerCase() === selectedObjectFilter.trim().toLowerCase();
      const matchAttribute =
        selectedAttributeFilter === 'ALL' ||
        (item.attributeName || 'value').trim().toLowerCase() === selectedAttributeFilter.trim().toLowerCase();

      let matchDate = true;
      if (fromDate) {
        const itemTime = new Date(item.measuredAt).getTime();
        const startOfDay = new Date(`${fromDate}T00:00:00`).getTime();
        if (itemTime < startOfDay) matchDate = false;
      }
      if (toDate && matchDate) {
        const itemTime = new Date(item.measuredAt).getTime();
        const endOfDay = new Date(`${toDate}T23:59:59.999`).getTime();
        if (itemTime > endOfDay) matchDate = false;
      }

      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.dbName && item.dbName.toLowerCase().includes(q)) ||
        (item.metricName && item.metricName.toLowerCase().includes(q)) ||
        (item.objectName && item.objectName.toLowerCase().includes(q)) ||
        (item.attributeName && item.attributeName.toLowerCase().includes(q)) ||
        (item.value && item.value.toLowerCase().includes(q)) ||
        (item.dbType && item.dbType.toLowerCase().includes(q));

      return matchEngine && matchDb && matchMetric && matchObject && matchAttribute && matchDate && matchSearch;
    });
  }, [
    measurementsData,
    engineFilter,
    selectedDbFilter,
    selectedMetricFilter,
    selectedObjectFilter,
    selectedAttributeFilter,
    fromDate,
    toDate,
    searchTerm,
  ]);

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredMeasurements.length / pageSize));
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredMeasurements.slice(startIdx, startIdx + pageSize);
  }, [filteredMeasurements, currentPage, pageSize]);

  const handleExportCsv = () => {
    if (filteredMeasurements.length === 0) return;
    const headers = [
      'ID',
      'Database Type',
      'Database Name',
      'Metric Name',
      'Object Name',
      'Attribute Name',
      'Measured Value',
      'Triggered Threshold',
      'Cycle',
      'Health Status',
      'Timestamp (UTC+7)',
    ];

    const rows = filteredMeasurements.map((m) => [
      m.id,
      m.dbType,
      `"${(m.dbName || '').replace(/"/g, '""')}"`,
      `"${(m.metricName || '').replace(/"/g, '""')}"`,
      `"${(m.objectName || '').replace(/"/g, '""')}"`,
      `"${(m.attributeName || 'value').replace(/"/g, '""')}"`,
      `"${String(m.value || '').replace(/"/g, '""')}"`,
      `"${(m.triggeredThreshold || 'Normal / In Bounds').replace(/"/g, '""')}"`,
      m.cycle ?? 1,
      m.status || 'NORMAL',
      formatExactTime(m.measuredAt),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `raw_measurements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function formatExactTime(isoStr: string) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();

      const fmt = timestampFormat || 'HH24:MI:SS DD/MM/YYYY';
      if (fmt === 'DD/MM/YYYY HH24:MI:SS') {
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }
      if (fmt === 'YYYY-MM-DD HH:mm:ss') {
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
      return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    } catch {
      return isoStr;
    }
  }

  function formatRelativeTime(isoStr: string) {
    if (!isoStr) return '-';
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
      if (diffSec < 45) return t('rawMeasurements.justNow');
      if (diffSec < 90) return `1 ${t('rawMeasurements.minAgo')}`;
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} ${t('rawMeasurements.minsAgo')}`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ${t('rawMeasurements.hoursAgo')}`;
      return `${Math.floor(diffSec / 86400)} ${t('rawMeasurements.daysAgo')}`;
    } catch {
      return isoStr;
    }
  }

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    engineFilter !== 'ALL' ||
    selectedDbFilter !== 'ALL' ||
    selectedMetricFilter !== 'ALL' ||
    selectedObjectFilter !== 'ALL' ||
    selectedAttributeFilter !== 'ALL';

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-5 overflow-y-auto bg-slate-50/50">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            {t('rawMeasurements.title')}
          </h2>
          <p className="text-xs text-slate-500">
            {t('rawMeasurements.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={filteredMeasurements.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('rawMeasurements.exportCsv')}</span>
          </button>
          <button
            onClick={() => {
              handleRunQuery();
              onRefresh();
            }}
            disabled={isSearching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title={t('rawMeasurements.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{t('rawMeasurements.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Info Tip */}
      {showInfoTips && (
        <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl text-indigo-950 flex items-start gap-2.5 text-xs shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            {t('rawMeasurements.pipelineInfo')}
          </div>
        </div>
      )}

      {/* Control Bar: Search Input, Date Range, Filters & Search Trigger */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* Row 1: Search Form + Search Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunQuery();
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t('rawMeasurements.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Dedicated Search / Query Execution Button */}
            <button
              type="submit"
              disabled={isSearching}
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
            >
              <Search className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
              <span>{isSearching ? t('rawMeasurements.querying') : t('rawMeasurements.searchButton')}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={isSearching}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                title={t('rawMeasurements.resetFilters')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('rawMeasurements.resetFilters')}</span>
              </button>
            )}
          </div>
        </form>

        {/* Row 2: Date Range Filter + Select Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Date Range Picker with Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold mr-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t('rawMeasurements.dateRange')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-medium">{t('rawMeasurements.from')}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-medium">{t('rawMeasurements.to')}</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={() => handleSetQuickDate(1)}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                {t('rawMeasurements.last24h')}
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(3)}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                {t('rawMeasurements.last3Days')}
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(7)}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                {t('rawMeasurements.last7Days')}
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate('ALL')}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                {t('rawMeasurements.all')}
              </button>
            </div>
          </div>

          {/* Secondary Dropdowns: DB Engine, Database, Metric */}
          <div className="flex flex-wrap items-center gap-2">
            {/* DB Engine Filter */}
            <select
              value={engineFilter}
              onChange={(e) => {
                const val = e.target.value;
                setEngineFilter(val);
                setCurrentPage(1);
                handleRunQuery({ dbType: val });
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="ALL">{t('rawMeasurements.allEngines')}</option>
              {databaseEngines.map((eng) => (
                <option key={eng.id} value={eng.dbCode}>
                  {eng.dbName} ({eng.dbCode})
                </option>
              ))}
              {databaseEngines.length === 0 && (
                <>
                  <option value="ORACLE">Oracle</option>
                  <option value="MYSQL">MySQL</option>
                  <option value="POSTGRES">PostgreSQL</option>
                  <option value="MSSQL">Microsoft SQL</option>
                  <option value="SINGLESTORE">SingleStore</option>
                  <option value="MONGODB">MongoDB</option>
                  <option value="REDIS">Redis</option>
                </>
              )}
            </select>

            {/* Target Database Filter */}
            <select
              value={selectedDbFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDbFilter(val);
                setCurrentPage(1);
                handleRunQuery({ dbId: val });
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 max-w-[150px] font-semibold truncate"
            >
              <option value="ALL">{t('rawMeasurements.allDatabases')}</option>
              {databases.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name} ({db.dbType})
                </option>
              ))}
            </select>

            {/* Metric Filter */}
            <select
              value={selectedMetricFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMetricFilter(val);
                setCurrentPage(1);
                handleRunQuery({ metricId: val });
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 max-w-[160px] font-semibold truncate"
              title={t('rawMeasurements.metricName')}
            >
              <option value="ALL">{t('rawMeasurements.allMetrics')}</option>
              {metrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {/* Object Name Filter */}
            <select
              value={selectedObjectFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedObjectFilter(val);
                setCurrentPage(1);
                handleRunQuery({ objectName: val });
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 max-w-[150px] font-semibold truncate"
              title={t('rawMeasurements.objectName')}
            >
              <option value="ALL">{t('rawMeasurements.allObjects')}</option>
              {availableObjects.map((obj) => (
                <option key={obj} value={obj}>
                  {obj}
                </option>
              ))}
            </select>

            {/* Attribute Name Filter */}
            <select
              value={selectedAttributeFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAttributeFilter(val);
                setCurrentPage(1);
                handleRunQuery({ attributeName: val });
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 max-w-[150px] font-semibold truncate"
              title={t('rawMeasurements.attributeName')}
            >
              <option value="ALL">{t('rawMeasurements.allAttributes')}</option>
              {availableAttributes.map((attr) => (
                <option key={attr} value={attr}>
                  {attr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Telemetry Count & Timezone Indicator */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 font-mono">
          <span>
            {t('rawMeasurements.showing')} <strong className="text-slate-800">{filteredMeasurements.length}</strong> {t('rawMeasurements.matchingEntries')} ({t('rawMeasurements.total')}: {measurementsData.length})
          </span>
          <span>{t('rawMeasurements.timezone')}</span>
        </div>
      </div>

      {/* Raw Measurements Data Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="overflow-x-auto w-full rounded-t-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3.5 w-[160px] whitespace-nowrap">{t('rawMeasurements.timestamp')}</th>
                <th className="py-2.5 px-3.5 w-[200px]">{t('rawMeasurements.database')}</th>
                <th className="py-2.5 px-3.5 w-[200px]">{t('rawMeasurements.metricName')}</th>
                <th className="py-2.5 px-3.5 w-[180px]">{t('rawMeasurements.objectAttribute')}</th>
                <th className="py-2.5 px-3.5 min-w-[280px]">{t('rawMeasurements.measuredValue')}</th>
                <th className="py-2.5 px-3.5 w-[90px] text-center whitespace-nowrap">{t('rawMeasurements.cycle')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">{t('rawMeasurements.noMeasurementsFound')}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t('rawMeasurements.noMeasurementsFoundSub')}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  const db = databases.find((d) => d.id === item.dbId);
                  const ipPort = db ? `${db.host}:${db.port}` : '127.0.0.1:3306';
                  const badgeClass = getDbEngineBadgeClass(item.dbType);
                  const hexColor = getDbEngineHexColor(item.dbType, databaseEngines);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Timestamp */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
                        <div className="font-mono text-[11px] text-slate-800 font-semibold">
                          {formatExactTime(item.measuredAt)}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatRelativeTime(item.measuredAt)}</span>
                        </div>
                      </td>

                      {/* 2. Database & Entity */}
                      <td className="py-2.5 px-3.5 align-top">
                        <div className="space-y-0.5">
                          {/* Line 1: Database Name */}
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate max-w-[160px]" title={item.dbName}>{item.dbName}</span>
                          </div>
                          {/* Line 2: IP Address : Port */}
                          <div className="text-[10px] text-slate-400 font-mono">
                            {ipPort}
                          </div>
                        </div>
                      </td>

                      {/* 3. Metric Name Column */}
                      <td className="py-2.5 px-3.5 align-top">
                        <div className="space-y-1">
                          {/* Line 1: Metric Name */}
                          <div className="text-xs font-bold text-slate-900 leading-tight">
                            {item.metricName}
                          </div>
                          {/* Line 2: Database Type brand tag */}
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${badgeClass}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hexColor }} />
                              {item.dbType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Object Attribute Column */}
                      <td className="py-2.5 px-3.5 font-mono align-top">
                        <div className="space-y-0.5">
                          {/* Line 1: Object Name */}
                          <div className="text-xs font-semibold text-slate-800">
                            {item.objectName || 'INSTANCE'}
                          </div>
                          {/* Line 2: Attribute Name */}
                          <div className="text-[10px] text-slate-500">
                            {item.attributeName || 'value'}
                          </div>
                        </div>
                      </td>

                      {/* 5. Measured Value (Expansive width) */}
                      <td className="py-2.5 px-3.5 align-top">
                        <div className="font-mono text-xs font-semibold text-slate-900 bg-slate-50/80 border border-slate-200/80 rounded-md px-2.5 py-1.5 break-all max-h-[120px] overflow-y-auto">
                          {item.value !== undefined && item.value !== null && item.value !== '' ? item.value : '0'}
                        </div>
                      </td>

                      {/* 6. Cycle */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap font-mono text-[11px] text-slate-600 align-top">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                          {t('rawMeasurements.cycle')} {item.cycle ?? 1}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs rounded-b-xl">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>{t('rawMeasurements.rowsPerPage')}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <span className="text-slate-400">|</span>
            <span className="font-mono text-[11px]">
              {filteredMeasurements.length === 0
                ? `0 ${t('rawMeasurements.of')} 0`
                : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredMeasurements.length)} ${t('rawMeasurements.of')} ${filteredMeasurements.length}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
              title="First Page"
            >
              «
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t('rawMeasurements.prev')}
            </button>
            <span className="px-3 py-1 bg-white border border-indigo-300 text-indigo-700 font-bold rounded text-xs">
              {t('rawMeasurements.page')} {currentPage} {t('rawMeasurements.of')} {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              {t('rawMeasurements.next')}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
              title="Last Page"
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


