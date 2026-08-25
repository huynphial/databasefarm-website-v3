import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { RawMeasurementEntity, DatabaseEntity, MetricEntity, DatabaseEngineEntity } from '../../types';
import { getDbEngineBadgeClass, getDbEngineHexColor } from '../../config/dbEngines';

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
  onSimulatePoll,
  showInfoTips = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [engineFilter, setEngineFilter] = useState<string>('ALL');
  const [selectedDbFilter, setSelectedDbFilter] = useState<string>('ALL');
  const [selectedMetricFilter, setSelectedMetricFilter] = useState<string>('ALL');
  const [isPolling, setIsPolling] = useState(false);

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

  // Quick Date Presets
  const handleSetQuickDate = (days: number | 'ALL') => {
    if (days === 'ALL') {
      setFromDate('');
      setToDate('');
    } else {
      const now = new Date();
      const past = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      setToDate(now.toISOString().slice(0, 10));
      setFromDate(past.toISOString().slice(0, 10));
    }
    currentPage !== 1 && setCurrentPage(1);
  };

  // Filtering
  const filteredMeasurements = useMemo(() => {
    return measurements.filter((item) => {
      const matchEngine = engineFilter === 'ALL' || (item.dbType || '').toUpperCase() === engineFilter.toUpperCase();
      const matchDb = selectedDbFilter === 'ALL' || item.dbId === selectedDbFilter;
      const matchMetric = selectedMetricFilter === 'ALL' || item.metricId === selectedMetricFilter;

      // Date filtering
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
        item.dbName.toLowerCase().includes(q) ||
        item.metricName.toLowerCase().includes(q) ||
        (item.objectName && item.objectName.toLowerCase().includes(q)) ||
        (item.attributeName && item.attributeName.toLowerCase().includes(q)) ||
        (item.value && item.value.toLowerCase().includes(q)) ||
        (item.dbType && item.dbType.toLowerCase().includes(q));

      return matchEngine && matchDb && matchMetric && matchDate && matchSearch;
    });
  }, [measurements, engineFilter, selectedDbFilter, selectedMetricFilter, fromDate, toDate, searchTerm]);

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredMeasurements.length / pageSize));
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredMeasurements.slice(startIdx, startIdx + pageSize);
  }, [filteredMeasurements, currentPage, pageSize]);

  const handlePollNow = () => {
    setIsPolling(true);
    if (onSimulatePoll) {
      onSimulatePoll();
    }
    setTimeout(() => {
      onRefresh();
      setIsPolling(false);
    }, 800);
  };

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
      `"${m.dbName.replace(/"/g, '""')}"`,
      `"${m.metricName.replace(/"/g, '""')}"`,
      `"${m.objectName.replace(/"/g, '""')}"`,
      `"${(m.attributeName || 'value').replace(/"/g, '""')}"`,
      `"${m.value.replace(/"/g, '""')}"`,
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
      if (diffSec < 45) return 'Just now';
      if (diffSec < 90) return '1 min ago';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
      return `${Math.floor(diffSec / 86400)} days ago`;
    } catch {
      return isoStr;
    }
  }

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-5 overflow-y-auto bg-slate-50/50">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Raw Query History & Telemetry Stream
          </h2>
          <p className="text-xs text-slate-500">
            Real-time telemetry stream of multi-object query probes, granular attribute measurements, and raw collected values.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={filteredMeasurements.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePollNow}
            disabled={isPolling}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
            <span>{isPolling ? 'Executing Probes...' : 'Poll Telemetry Now'}</span>
          </button>
        </div>
      </div>

      {/* Info Tip */}
      {showInfoTips && (
        <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl text-indigo-950 flex items-start gap-2.5 text-xs shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Multidimensional Telemetry Pipeline: </span>
            Stream displays high-resolution raw metric data points collected across database targets with target engine types, measured entities, granular attributes, and measured values.
          </div>
        </div>
      )}

      {/* Control Bar: Date Range, Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* Row 1: Search Input */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search database, metric, object (e.g. TS_DATA), attribute, or value..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Row 2: Date Range Filter + Select Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Date Range Picker with Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold mr-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Date Range:</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-medium">From</span>
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
              <span className="text-[10px] text-slate-400 font-medium">To</span>
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
                24h
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(3)}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer"
              >
                3 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(7)}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate('ALL')}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                All
              </button>
            </div>
          </div>

          {/* Secondary Dropdowns: DB Engine, Database, Metric */}
          <div className="flex flex-wrap items-center gap-2">
            {/* DB Engine Filter */}
            <select
              value={engineFilter}
              onChange={(e) => {
                setEngineFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="ALL">All Engines</option>
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
                setSelectedDbFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 max-w-[150px] font-semibold truncate"
            >
              <option value="ALL">All Databases</option>
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
                setSelectedMetricFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 max-w-[160px] font-semibold truncate"
            >
              <option value="ALL">All Metrics</option>
              {metrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Telemetry Count & Timezone Indicator */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 font-mono">
          <span>
            Showing <strong className="text-slate-800">{filteredMeasurements.length}</strong> matching entries (Total: {measurements.length})
          </span>
          <span>Timezone: Asia/Ho_Chi_Minh (UTC+7)</span>
        </div>
      </div>

      {/* Raw Measurements Data Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="overflow-x-auto w-full rounded-t-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3.5 w-[160px] whitespace-nowrap">Timestamp</th>
                <th className="py-2.5 px-3.5 w-[200px]">Database</th>
                <th className="py-2.5 px-3.5 w-[200px]">Metric Name</th>
                <th className="py-2.5 px-3.5 w-[180px]">Object / Attribute</th>
                <th className="py-2.5 px-3.5 min-w-[280px]">Measured Value</th>
                <th className="py-2.5 px-3.5 w-[90px] text-center whitespace-nowrap">Cycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No telemetry measurements found.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Adjust your date range or filters, or click "Poll Telemetry Now" to execute live probes.
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
                          Cycle {item.cycle ?? 1}
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
            <span>Rows per page:</span>
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
                ? '0 of 0'
                : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredMeasurements.length)} of ${filteredMeasurements.length}`}
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
              Prev
            </button>
            <span className="px-3 py-1 bg-white border border-indigo-300 text-indigo-700 font-bold rounded text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
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

