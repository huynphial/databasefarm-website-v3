import React, { useState, useMemo } from 'react';
import {
  BellRing,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Mail,
  MessageSquare,
  Globe,
  Radio,
  Server,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
} from 'lucide-react';
import { AlertNotificationLogEntity, DatabaseEntity, UserRole } from '../../types';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';

interface AlertNotificationLogViewProps {
  logs: AlertNotificationLogEntity[];
  databases: DatabaseEntity[];
  userRole: UserRole;
  showInfoTips?: boolean;
  onRefresh: () => void;
}

export const AlertNotificationLogView: React.FC<AlertNotificationLogViewProps> = ({
  logs,
  databases,
  userRole,
  showInfoTips = true,
  onRefresh,
}) => {
  const { toast } = useToast();

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedDbId, setSelectedDbId] = useState<string>('ALL');

  // Date Range Filters (Default 7 Days)
  const defaultTo = new Date().toISOString().split('T')[0];
  const defaultFrom = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);
  const [activeDatePreset, setActiveDatePreset] = useState<'3D' | '7D' | '30D' | 'ALL'>('7D');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Selected Log Detail Modal State
  const [selectedLog, setSelectedLog] = useState<AlertNotificationLogEntity | null>(null);

  // Quick Date Preset Handler
  const handleDatePreset = (preset: '3D' | '7D' | '30D' | 'ALL') => {
    setActiveDatePreset(preset);
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'ALL') {
      setFromDate('');
      setToDate('');
    } else {
      const days = preset === '3D' ? 3 : preset === '7D' ? 7 : 30;
      const past = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      setFromDate(past);
      setToDate(today);
    }
    setCurrentPage(1);
  };

  // Helper date formatter in UTC+7 / Local
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return `${Math.max(1, diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Compute stats
  const stats = useMemo(() => {
    const total = logs.length;
    const dispatched = logs.filter((l) => l.status === 'DISPATCHED').length;
    const failed = logs.filter((l) => l.status === 'FAILED').length;
    const pending = logs.filter((l) => l.status === 'PENDING').length;
    const telegram = logs.filter((l) => l.dispatchType === 'TELEGRAM').length;
    const email = logs.filter((l) => l.dispatchType === 'EMAIL').length;
    const other = total - telegram - email;
    const latencies = logs.filter((l) => typeof l.latencyMs === 'number').map((l) => l.latencyMs as number);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 185;

    return { total, dispatched, failed, pending, telegram, email, other, avgLatency };
  }, [logs]);

  // DB lookup
  const dbMap = useMemo(() => {
    const map = new Map<string, DatabaseEntity>();
    databases.forEach((db) => map.set(db.id, db));
    return map;
  }, [databases]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Date filter
      if (fromDate) {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        if (logDate < fromDate) return false;
      }
      if (toDate) {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        if (logDate > toDate) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;

      // Channel filter
      if (channelFilter !== 'ALL' && log.dispatchType !== channelFilter) return false;

      // Severity filter
      if (severityFilter !== 'ALL' && log.alertLevel !== severityFilter) return false;

      // DB Filter
      if (selectedDbId !== 'ALL' && log.dbId !== selectedDbId) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTerm =
          log.alertId?.toLowerCase().includes(term) ||
          log.dbName?.toLowerCase().includes(term) ||
          log.metricName?.toLowerCase().includes(term) ||
          log.attributeName?.toLowerCase().includes(term) ||
          log.dispatchMethod?.toLowerCase().includes(term) ||
          log.senderIds?.toLowerCase().includes(term) ||
          log.errorMessage?.toLowerCase().includes(term) ||
          log.payloadSummary?.toLowerCase().includes(term);

        if (!matchesTerm) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, fromDate, toDate, statusFilter, channelFilter, severityFilter, selectedDbId, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Render Channel Badge
  const renderChannelBadge = (type?: string, method?: string) => {
    switch (type) {
      case 'TELEGRAM':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded shadow-2xs">
            <Send className="w-3 h-3 text-sky-500" />
            {method || 'Telegram'}
          </span>
        );
      case 'EMAIL':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shadow-2xs">
            <Mail className="w-3 h-3 text-emerald-500" />
            {method || 'Email'}
          </span>
        );
      case 'SLACK':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded shadow-2xs">
            <MessageSquare className="w-3 h-3 text-purple-500" />
            {method || 'Slack'}
          </span>
        );
      case 'SMS':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shadow-2xs">
            <Radio className="w-3 h-3 text-amber-500" />
            {method || 'SMS'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded shadow-2xs">
            <Globe className="w-3 h-3 text-indigo-500" />
            {method || 'Webhook'}
          </span>
        );
    }
  };

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BellRing className="w-5 h-5 text-indigo-600" />
            Alert Notification Audit Log
          </h2>
          <p className="text-xs text-slate-500">
            Audit history of dispatched incidents, destination channels, delivery latencies, and gateway statuses ({filteredLogs.length} matching)
          </p>
        </div>

        <button
          onClick={() => {
            onRefresh();
            toast({
              title: 'Notification Logs Refreshed',
              description: 'Loaded latest dispatcher telemetry logs.',
              type: 'info',
            });
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* Info Tips */}
      {showInfoTips && (
        <div className="p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-xl text-indigo-950 flex items-start gap-2.5 text-xs shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Notification Gateway Audit Trail: </span>
            Every alert evaluation that breaches warning, high, or critical thresholds generates an immutable notification log with destination sender IDs, latency timestamps, and API response statuses.
          </div>
        </div>
      )}

      {/* KPI Stats Grid - COMPACT SPACE SAVING DESIGN */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Logs</span>
            <span className="text-base font-black text-slate-800">{stats.total}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Audit Entries</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Dispatched</span>
            <span className="text-base font-black text-emerald-700">{stats.dispatched}</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Delivered</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Failed / Errors</span>
            <span className="text-base font-black text-rose-700">{stats.failed}</span>
          </div>
          <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Errors</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Avg Latency</span>
            <span className="text-base font-black text-indigo-700">{stats.avgLatency}ms</span>
          </div>
          <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Round-trip</span>
        </div>
      </div>

      {/* Control Bar: Filters, Date Range & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* Row 1: Search and Dropdowns */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search alert ID, database, metric, channel, sender IDs, error..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Status: All</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="FAILED">FAILED</option>
              <option value="PENDING">PENDING</option>
            </select>

            {/* Channel Filter */}
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Channel: All</option>
              <option value="TELEGRAM">Telegram</option>
              <option value="EMAIL">Email</option>
              <option value="SLACK">Slack</option>
              <option value="SMS">SMS</option>
              <option value="WEBHOOK">Webhook</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Severity: All</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="WARN">WARN</option>
              <option value="DOWN">DOWN</option>
            </select>

            {/* Database Dropdown */}
            <select
              value={selectedDbId}
              onChange={(e) => {
                setSelectedDbId(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Database: All Instances</option>
              {databases.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name} ({db.dbType})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Date Presets & Custom Pickers */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Time Range:
            </span>
            {(['3D', '7D', '30D', 'ALL'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleDatePreset(preset)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  activeDatePreset === preset
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset === 'ALL' ? 'All Time' : `Last ${preset}`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-slate-600">
              <span>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActiveDatePreset('ALL');
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <span>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActiveDatePreset('ALL');
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-xs font-mono text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="overflow-x-auto rounded-t-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Alert ID</th>
                <th className="py-2.5 px-3">Database Instance</th>
                <th className="py-2.5 px-3">Metric / Attribute</th>
                <th className="py-2.5 px-3 text-center">Severity</th>
                <th className="py-2.5 px-3">Dispatch Method</th>
                <th className="py-2.5 px-3">Destination Sender IDs</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Details / Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <BellRing className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-600">No alert notification logs found</span>
                      <span className="text-xs text-slate-400 max-w-sm">
                        No dispatches matched your current filters or date range.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const dbObj = dbMap.get(log.dbId);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                    >
                      {/* 1. Timestamp */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-[11px] font-semibold text-slate-800">
                          {formatDateTime(log.timestamp)}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatRelativeTime(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* 2. Alert ID */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100">
                          {log.alertId || log.id}
                        </span>
                      </td>

                      {/* 3. Database */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Server className="w-3 h-3 text-slate-400" />
                          {log.dbName}
                        </div>
                        {dbObj && (
                          <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 mt-0.5 inline-block">
                            {dbObj.dbType}
                          </span>
                        )}
                      </td>

                      {/* 4. Metric / Attribute */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 max-w-[180px] truncate">
                          {log.metricName}
                        </div>
                        {log.attributeName && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {log.attributeName}
                          </div>
                        )}
                      </td>

                      {/* 5. Severity */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {log.alertLevel === 'CRITICAL' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                            CRITICAL
                          </span>
                        )}
                        {log.alertLevel === 'HIGH' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 font-mono">
                            HIGH
                          </span>
                        )}
                        {log.alertLevel === 'WARN' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                            WARN
                          </span>
                        )}
                        {log.alertLevel === 'DOWN' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 font-mono">
                            DOWN
                          </span>
                        )}
                      </td>

                      {/* 6. Dispatch Method */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {renderChannelBadge(log.dispatchType, log.dispatchMethod)}
                      </td>

                      {/* 7. Sender IDs */}
                      <td className="py-2.5 px-3">
                        <div
                          className="text-[11px] font-mono text-slate-700 max-w-[200px] truncate bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
                          title={log.senderIds}
                        >
                          {log.senderIds || '—'}
                        </div>
                      </td>

                      {/* 8. Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {log.status === 'DISPATCHED' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            DISPATCHED
                          </span>
                        )}
                        {log.status === 'FAILED' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            FAILED
                          </span>
                        )}
                        {log.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-amber-600" />
                            PENDING
                          </span>
                        )}
                      </td>

                      {/* 9. Details / Latency */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.errorMessage ? (
                          <span className="text-[11px] font-semibold text-rose-600 block max-w-[220px] truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                            {log.latencyMs && (
                              <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-700 font-bold">
                                {log.latencyMs}ms
                              </span>
                            )}
                            <span className="text-slate-400 group-hover:text-indigo-600 text-[10px] transition-colors underline">
                              View Payload »
                            </span>
                          </div>
                        )}
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
              {filteredLogs.length === 0
                ? '0 of 0'
                : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredLogs.length)} of ${filteredLogs.length}`}
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

      {/* Detail Dialog for Payload Inspection */}
      {selectedLog && (
        <Dialog
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Notification Dispatch Audit: ${selectedLog.id}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Timestamp</span>
                <span className="font-mono font-semibold text-slate-800">{formatDateTime(selectedLog.timestamp)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span className="font-bold text-slate-900">{selectedLog.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Database</span>
                <span className="font-bold text-slate-900">{selectedLog.dbName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Channel / Provider</span>
                <span className="font-bold text-indigo-700">{selectedLog.dispatchMethod} ({selectedLog.dispatchType})</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1">Target Sender IDs:</span>
              <div className="bg-slate-100 p-2 rounded-lg font-mono text-slate-800 break-all select-all">
                {selectedLog.senderIds || '—'}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1">Dispatched Message Summary:</span>
              <div className="bg-slate-100 p-2.5 rounded-lg text-slate-800 leading-relaxed font-sans">
                {selectedLog.payloadSummary || 'No payload summary available.'}
              </div>
            </div>

            {selectedLog.errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                <span className="font-bold block mb-0.5">Gateway Error Response:</span>
                <span className="font-mono text-[11px]">{selectedLog.errorMessage}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
