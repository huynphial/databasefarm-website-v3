import React, { useState, useMemo } from 'react';
import {
  LineChart as ChartIcon,
  Download,
  Calendar,
  Server,
  Gauge,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  Database,
  Layers
} from 'lucide-react';
import { DatabaseEntity, MetricEntity, MetricHistoryEntity } from '../../types';
import { DB_ENGINES } from '../../config/dbEngines';
import { MetricChart } from '../charts/MetricChart';
import { DataTable, Column } from '../tables/DataTable';
import { formatTimeVN } from '../../lib/utils';
import { useToast } from '../ui/Toast';

interface AnalyticsViewProps {
  databases: DatabaseEntity[];
  metrics: MetricEntity[];
  metricHistory: MetricHistoryEntity[];
  initialDbId?: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  databases,
  metrics,
  metricHistory,
  initialDbId,
}) => {
  const { toast } = useToast();
  const [selectedDbType, setSelectedDbType] = useState<string>('ALL');
  const [selectedDbId, setSelectedDbId] = useState<string>(initialDbId || databases[0]?.id || '');
  const [selectedObjectName, setSelectedObjectName] = useState<string>('ALL');
  const [dateRangeHours, setDateRangeHours] = useState<number>(24);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter databases based on selected database engine type
  const filteredDatabases = useMemo(() => {
    if (selectedDbType === 'ALL') return databases;
    return databases.filter((db) => db.dbType.toUpperCase() === selectedDbType.toUpperCase());
  }, [databases, selectedDbType]);

  // Keep selectedDbId valid within filtered databases
  React.useEffect(() => {
    if (filteredDatabases.length > 0) {
      const exists = filteredDatabases.some((db) => db.id === selectedDbId);
      if (!exists) {
        setSelectedDbId(filteredDatabases[0].id);
      }
    }
  }, [filteredDatabases, selectedDbId]);

  // Find the selected database
  const selectedDb = databases.find((d) => d.id === selectedDbId);

  // Filter available metrics configured for the selected database
  const availableMetrics = useMemo(() => {
    if (!selectedDb) return [];
    if (selectedDb.metricIds && selectedDb.metricIds.length > 0) {
      return metrics.filter((m) => selectedDb.metricIds?.includes(m.id));
    }
    return metrics;
  }, [selectedDb, metrics]);

  const [selectedMetricId, setSelectedMetricId] = useState<string>(
    availableMetrics[0]?.id || metrics[0]?.id || ''
  );

  // Sync selected metric if available metrics change
  React.useEffect(() => {
    if (availableMetrics.length > 0) {
      const exists = availableMetrics.some((m) => m.id === selectedMetricId);
      if (!exists) {
        setSelectedMetricId(availableMetrics[0].id);
      }
    }
  }, [availableMetrics, selectedMetricId]);

  const selectedMetric = metrics.find((m) => m.id === selectedMetricId);

  // Determine all unique object names recorded for this DB and metric
  const availableObjects = useMemo(() => {
    const rawObjects = metricHistory
      .filter((h) => h.dbId === selectedDbId && h.metricId === selectedMetricId)
      .map((h) => h.objectName || 'INSTANCE');
    return Array.from(new Set(rawObjects));
  }, [metricHistory, selectedDbId, selectedMetricId]);

  // Reset object filter if not available in current metric
  React.useEffect(() => {
    if (selectedObjectName !== 'ALL' && !availableObjects.includes(selectedObjectName)) {
      setSelectedObjectName('ALL');
    }
  }, [availableObjects, selectedObjectName]);

  // Filter history points by DB, Metric, Object, and Date Range
  const filteredHistory = useMemo(() => {
    const cutoffTime = Date.now() - dateRangeHours * 3600000;
    return metricHistory
      .filter((h) => {
        const matchesDb = h.dbId === selectedDbId;
        const matchesMetric = h.metricId === selectedMetricId;
        const matchesObject = selectedObjectName === 'ALL' || (h.objectName || 'INSTANCE') === selectedObjectName;
        const matchesTime = new Date(h.createdAt).getTime() >= cutoffTime;
        return matchesDb && matchesMetric && matchesObject && matchesTime;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [metricHistory, selectedDbId, selectedMetricId, selectedObjectName, dateRangeHours]);

  // Numeric chart data points
  const chartData = useMemo(() => {
    return [...filteredHistory]
      .reverse()
      .map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        value: parseFloat(item.value) || 0,
      }));
  }, [filteredHistory]);

  const isNumericMetric = selectedMetric ? selectedMetric.valueType === 'NUMBER' : true;

  // Pagination for raw data table
  const totalPages = Math.ceil(filteredHistory.length / pageSize) || 1;
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Client-side CSV Exporter
  const handleExportCSV = () => {
    if (filteredHistory.length === 0) {
      toast({ title: 'Export Failed', description: 'No metric data available to export.', type: 'warning' });
      return;
    }

    const headers = ['Record_ID', 'Database_ID', 'Database_Name', 'Database_Type', 'Metric_ID', 'Metric_Name', 'Object_Name', 'Value', 'Timestamp_UTC', 'Timestamp_VN_UTC7'];
    const rows = filteredHistory.map((item) => [
      `"${item.id}"`,
      `"${item.dbId}"`,
      `"${selectedDb?.name || item.dbId}"`,
      `"${selectedDb?.dbType || 'UNKNOWN'}"`,
      `"${item.metricId}"`,
      `"${selectedMetric?.name || item.metricId}"`,
      `"${item.objectName || 'INSTANCE'}"`,
      `"${item.value}"`,
      `"${item.createdAt}"`,
      `"${formatTimeVN(item.createdAt)}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `${selectedDb?.name || 'db'}_${selectedMetric?.name || 'metric'}_${selectedObjectName !== 'ALL' ? selectedObjectName : 'all'}_${new Date().toISOString().slice(0, 10)}.csv`.replace(/\s+/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'CSV Export Successful',
      description: `Downloaded ${filteredHistory.length} time-series entries as ${filename}.`,
      type: 'success',
    });
  };

  const columns: Column<MetricHistoryEntity>[] = [
    {
      header: 'Sampled Timestamp (UTC+7)',
      accessorKey: 'createdAt',
      width: '200px',
      cell: (row) => (
        <span className="font-mono text-slate-700 text-xs">{formatTimeVN(row.createdAt)}</span>
      ),
    },
    {
      header: 'Target Object',
      accessorKey: 'objectName',
      width: '180px',
      cell: (row) => (
        <span className="font-mono font-semibold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100 text-xs">
          {row.objectName || 'INSTANCE'}
        </span>
      ),
    },
    {
      header: 'Metric Identifier',
      cell: () => (
        <span className="text-slate-700 text-xs font-medium">{selectedMetric?.name || 'Metric'}</span>
      ),
    },
    {
      header: 'Recorded Value',
      accessorKey: 'value',
      align: 'right',
      cell: (row) => (
        <span className="font-mono font-bold text-indigo-700 text-sm">{row.value}</span>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Top Filter Bar */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl flex flex-col xl:flex-row items-start xl:items-end justify-between gap-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full xl:w-auto flex-1">
          {/* Database Engine Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              Database Type
            </label>
            <select
              value={selectedDbType}
              onChange={(e) => {
                setSelectedDbType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Types ({databases.length})</option>
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

          {/* Select Database */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-indigo-600" />
              Target Database
            </label>
            <select
              value={selectedDbId}
              onChange={(e) => {
                setSelectedDbId(e.target.value);
                setCurrentPage(1);
              }}
              disabled={filteredDatabases.length === 0}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium disabled:bg-slate-100"
            >
              {filteredDatabases.length === 0 ? (
                <option value="">No instances</option>
              ) : (
                filteredDatabases.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.name} ({db.dbType})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Select Metric */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-indigo-600" />
              Metric Probe
            </label>
            <select
              value={selectedMetricId}
              onChange={(e) => {
                setSelectedMetricId(e.target.value);
                setCurrentPage(1);
              }}
              disabled={availableMetrics.length === 0}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium disabled:bg-slate-100"
            >
              {availableMetrics.length === 0 ? (
                <option value="">No metrics bound</option>
              ) : (
                availableMetrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.valueType})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Target Object Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Target Object
            </label>
            <select
              value={selectedObjectName}
              onChange={(e) => {
                setSelectedObjectName(e.target.value);
                setCurrentPage(1);
              }}
              disabled={availableObjects.length <= 1 && availableObjects[0] === 'INSTANCE'}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium disabled:bg-slate-100"
            >
              <option value="ALL">All Objects ({availableObjects.length})</option>
              {availableObjects.map((obj) => (
                <option key={obj} value={obj}>
                  {obj}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Time Horizon
            </label>
            <select
              value={dateRangeHours}
              onChange={(e) => {
                setDateRangeHours(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value={6}>Last 6 Hours</option>
              <option value={12}>Last 12 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={48}>Last 48 Hours</option>
              <option value={168}>Last 7 Days</option>
            </select>
          </div>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs px-4 py-2 rounded-lg font-medium transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-indigo-600" />
          Export CSV
        </button>
      </div>

      {/* Chart Section or Non-numeric notice */}
      {isNumericMetric ? (
        <MetricChart
          data={chartData}
          metricName={`${selectedMetric?.name || 'Metric'}${selectedObjectName !== 'ALL' ? ` [${selectedObjectName}]` : ''}`}
          chartType="area"
          thresholdWarn={selectedMetric?.thresholdWarn ? parseFloat(selectedMetric.thresholdWarn) : null}
          thresholdHigh={selectedMetric?.thresholdHigh ? parseFloat(selectedMetric.thresholdHigh) : null}
          thresholdCritical={selectedMetric?.thresholdCritical ? parseFloat(selectedMetric.thresholdCritical) : null}
        />
      ) : (
        <div className="p-6 bg-white border border-slate-200 rounded-xl flex items-center gap-3 text-slate-600 text-xs shadow-2xs">
          <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <span className="font-semibold text-slate-900">Non-Numeric Metric Type ({selectedMetric?.valueType}):</span> Chart visualization is disabled for categorical / text / boolean outputs. Raw sampled values are tabulated below.
          </div>
        </div>
      )}

      {/* Raw Data Table */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            Raw Sampled Records ({filteredHistory.length})
          </h4>
        </div>
        <div className="flex-1">
          <DataTable
            columns={columns}
            data={paginatedHistory}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={filteredHistory.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            emptyMessage="No time-series samples found for the selected database and metric."
          />
        </div>
      </div>
    </div>
  );
};

