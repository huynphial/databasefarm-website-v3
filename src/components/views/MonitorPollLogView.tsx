import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  ShieldAlert,
  Layers,
  Lock,
  Timer,
  AlertOctagon,
  ChevronDown,
  Database,
  Filter,
  Check,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  DatabasePollQueueEntity,
  DatabasePollLogEntity,
  DatabaseEntity,
  DatabaseEngineEntity,
  UserRole,
} from '../../types';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n';

// Utility helper for classnames
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// Database Engine Badge Styling
const getDbEngineBadgeClass = (engineType?: string) => {
  const t = (engineType || '').toUpperCase();
  if (t.includes('POSTGRES')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (t.includes('MYSQL')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (t.includes('MARIA')) return 'bg-teal-50 text-teal-700 border-teal-200';
  if (t.includes('ORACLE')) return 'bg-red-50 text-red-700 border-red-200';
  if (t.includes('SQLSERVER') || t.includes('MSSQL')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (t.includes('MONGO')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (t.includes('REDIS')) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

interface MonitorPollLogViewProps {
  queue: DatabasePollQueueEntity[];
  logs: DatabasePollLogEntity[];
  databases: DatabaseEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  userRole: UserRole;
  showInfoTips?: boolean;
  onRefresh: () => void;
}

export const MonitorPollLogView: React.FC<MonitorPollLogViewProps> = ({
  queue,
  logs,
  databases,
  databaseEngines = [],
  userRole,
  showInfoTips = true,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- AUTO REFRESH STATE (Options: 15s, 30s, 1m, 5m, Off) ---
  type AutoRefreshOption = 'off' | '15s' | '30s' | '1m' | '5m';
  const [autoRefreshOption, setAutoRefreshOption] = useState<AutoRefreshOption>('30s');
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number | null>(30);

  useEffect(() => {
    if (autoRefreshOption === 'off') {
      setSecondsUntilRefresh(null);
      return;
    }

    const secondsMap: Record<AutoRefreshOption, number> = {
      off: 0,
      '15s': 15,
      '30s': 30,
      '1m': 60,
      '5m': 300,
    };
    const totalSeconds = secondsMap[autoRefreshOption] || 30;
    setSecondsUntilRefresh(totalSeconds);

    const timerId = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev === null || prev <= 1) {
          onRefresh();
          return totalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [autoRefreshOption, onRefresh]);

  // If user is not ADMIN, show Access Denied
  if (userRole !== 'ADMIN') {
    return (
      <div className="p-8 flex-1 flex flex-col items-center justify-center bg-slate-50 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
          The <strong>Monitor Poll Log</strong> is restricted to administrators only. Viewer roles do not have permission to view engine polling queues or backend collector execution logs.
        </p>
      </div>
    );
  }

  // --- FILTER 1: DATABASE ENGINE FILTER ---
  const [selectedEngineType, setSelectedEngineType] = useState<string>('ALL');

  // --- FILTER 2: TARGET DATABASE SEARCHABLE DROPDOWN ---
  const [selectedDbId, setSelectedDbId] = useState<string>('ALL');
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const dbSearchInputRef = useRef<HTMLInputElement>(null);

  // --- FILTER 3: TIME WINDOW FILTER (Default: 24h) ---
  const [timeRangePreset, setTimeRangePreset] = useState<'1h' | '6h' | '24h' | '3d' | '7d' | 'all'>('24h');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  // --- SECONDARY LOG FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<DatabasePollLogEntity | null>(null);

  // Click outside to close Target Database dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(event.target as Node)) {
        setIsDbDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when Target DB dropdown opens
  useEffect(() => {
    if (isDbDropdownOpen) {
      setTimeout(() => {
        dbSearchInputRef.current?.focus();
      }, 50);
    }
  }, [isDbDropdownOpen]);

  // Compute available Database Engines
  const availableEngines = useMemo(() => {
    const engineMap = new Map<string, { code: string; name: string }>();
    if (databaseEngines && databaseEngines.length > 0) {
      databaseEngines.forEach((e) => {
        engineMap.set(e.dbCode.toUpperCase(), { code: e.dbCode, name: e.dbName });
      });
    }
    databases.forEach((db) => {
      const code = db.dbType.toUpperCase();
      if (!engineMap.has(code)) {
        engineMap.set(code, { code: db.dbType, name: db.dbType });
      }
    });
    return Array.from(engineMap.values());
  }, [databaseEngines, databases]);

  // Searchable databases list for Target Database dropdown
  const searchableDatabases = useMemo(() => {
    return databases.filter((db) => {
      const matchEngine =
        selectedEngineType === 'ALL' ||
        db.dbType.toUpperCase() === selectedEngineType.toUpperCase();
      const q = dbSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        db.name.toLowerCase().includes(q) ||
        (db.databaseName && db.databaseName.toLowerCase().includes(q)) ||
        db.host.toLowerCase().includes(q) ||
        String(db.port || '').includes(q) ||
        (db.environment && db.environment.toLowerCase().includes(q)) ||
        db.dbType.toLowerCase().includes(q) ||
        (db.note && db.note.toLowerCase().includes(q)) ||
        (db.tags && db.tags.some((t) => t.toLowerCase().includes(q)));
      return matchEngine && matchSearch;
    });
  }, [databases, selectedEngineType, dbSearchQuery]);

  // Selected Target Database Entity
  const selectedDb = useMemo(() => {
    if (selectedDbId === 'ALL') return null;
    return databases.find((d) => d.id === selectedDbId) || null;
  }, [databases, selectedDbId]);

  // Fast Database Lookup Map
  const dbMap = useMemo(() => {
    const map = new Map<string, DatabaseEntity>();
    databases.forEach((db) => map.set(db.id, db));
    return map;
  }, [databases]);

  // Calculate Time Window boundaries in Milliseconds
  const { fromTimeMs, toTimeMs } = useMemo(() => {
    const now = Date.now();
    if (customFrom || customTo) {
      const from = customFrom ? new Date(customFrom).getTime() : 0;
      const to = customTo ? new Date(customTo).getTime() : Infinity;
      return { fromTimeMs: from, toTimeMs: to };
    }
    switch (timeRangePreset) {
      case '1h':
        return { fromTimeMs: now - 3600 * 1000, toTimeMs: now };
      case '6h':
        return { fromTimeMs: now - 6 * 3600 * 1000, toTimeMs: now };
      case '24h':
        return { fromTimeMs: now - 24 * 3600 * 1000, toTimeMs: now };
      case '3d':
        return { fromTimeMs: now - 3 * 86400 * 1000, toTimeMs: now };
      case '7d':
        return { fromTimeMs: now - 7 * 86400 * 1000, toTimeMs: now };
      case 'all':
      default:
        return { fromTimeMs: 0, toTimeMs: Infinity };
    }
  }, [timeRangePreset, customFrom, customTo]);

  // Preset Selection Handler
  const handleSelectTimePreset = (preset: '1h' | '6h' | '24h' | '3d' | '7d' | 'all') => {
    setTimeRangePreset(preset);
    setCustomFrom('');
    setCustomTo('');
    setCurrentPage(1);
  };

  // Helper date formatter in UTC+7 / Local
  const formatDateTime = (isoString?: string | null) => {
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

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return '';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 0) {
      const future = Math.abs(diff);
      if (future < 60) return `in ${future}s`;
      if (future < 3600) return `in ${Math.floor(future / 60)}m`;
      return `in ${Math.floor(future / 3600)}h`;
    }
    if (diff < 60) return `${Math.max(1, diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Calculate duration in ms
  const calculateDurationMs = (start?: string, finish?: string) => {
    if (!start || !finish) return null;
    const s = new Date(start).getTime();
    const f = new Date(finish).getTime();
    if (isNaN(s) || isNaN(f)) return null;
    return Math.max(0, f - s);
  };

  // --- FILTERED QUEUE (database_poll_queue) ---
  // Constraint: Queue tables MUST NOT be filtered by time (real-time visibility)
  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      // Database Engine filter
      if (selectedEngineType !== 'ALL') {
        const dbObj = dbMap.get(item.dbId);
        const dbType = dbObj?.dbType || '';
        if (dbType.toUpperCase() !== selectedEngineType.toUpperCase()) return false;
      }

      // Target Database filter
      if (selectedDbId !== 'ALL' && item.dbId !== selectedDbId) return false;

      // Optional text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesTerm =
          item.id.toLowerCase().includes(term) ||
          item.dbId.toLowerCase().includes(term) ||
          item.dbName.toLowerCase().includes(term) ||
          (item.lockedBy && item.lockedBy.toLowerCase().includes(term));
        if (!matchesTerm) return false;
      }

      return true;
    });
  }, [queue, selectedEngineType, selectedDbId, searchTerm, dbMap]);

  // --- FILTERED LOGS (database_poll_log) ---
  // Applies Time Filter (Default 24H) + Engine + Target DB + Status + Search
  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        // Time window filter (startedAt or finishedAt)
        const logDateStr = log.startedAt || log.finishedAt;
        if (logDateStr) {
          const logTime = new Date(logDateStr).getTime();
          if (fromTimeMs && logTime < fromTimeMs) return false;
          if (toTimeMs && logTime > toTimeMs) return false;
        }

        // Database Engine filter
        if (selectedEngineType !== 'ALL') {
          const dbObj = dbMap.get(log.dbId);
          const dbType = dbObj?.dbType || '';
          if (dbType.toUpperCase() !== selectedEngineType.toUpperCase()) return false;
        }

        // Target Database filter
        if (selectedDbId !== 'ALL' && log.dbId !== selectedDbId) return false;

        // Status filter
        if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;

        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesTerm =
            log.id.toLowerCase().includes(term) ||
            log.dbId.toLowerCase().includes(term) ||
            log.dbName.toLowerCase().includes(term) ||
            (log.errorMessage && log.errorMessage.toLowerCase().includes(term));

          if (!matchesTerm) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.startedAt || b.finishedAt || 0).getTime() -
          new Date(a.startedAt || a.finishedAt || 0).getTime()
      );
  }, [
    logs,
    fromTimeMs,
    toTimeMs,
    selectedEngineType,
    selectedDbId,
    statusFilter,
    searchTerm,
    dbMap,
  ]);

  // Compute stats
  const stats = useMemo(() => {
    const totalLogs = filteredLogs.length;
    const successLogs = filteredLogs.filter((l) => l.status === 'success').length;
    const failedLogs = filteredLogs.filter((l) => l.status === 'failed').length;
    const pendingQueue = filteredQueue.filter((q) => q.status === 'pending').length;
    const processingQueue = filteredQueue.filter((q) => q.status === 'processing').length;

    const durations = filteredLogs
      .map((l) => calculateDurationMs(l.startedAt, l.finishedAt))
      .filter((d): d is number => d !== null);
    const avgDuration =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    return {
      totalLogs,
      successLogs,
      failedLogs,
      pendingQueue,
      processingQueue,
      avgDuration,
    };
  }, [filteredLogs, filteredQueue]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    if (autoRefreshOption !== 'off') {
      const secondsMap: Record<string, number> = { '15s': 15, '30s': 30, '1m': 60, '5m': 300 };
      setSecondsUntilRefresh(secondsMap[autoRefreshOption] || 30);
    }
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: 'Monitor Poll Logs Refreshed',
        description: 'Loaded latest collector poll queue & execution logs.',
        type: 'info',
      });
    }, 500);
  };

  const handleClearFilters = () => {
    setSelectedEngineType('ALL');
    setSelectedDbId('ALL');
    setDbSearchQuery('');
    setStatusFilter('ALL');
    setSearchTerm('');
    handleSelectTimePreset('24h');
  };

  const hasActiveFilters =
    selectedEngineType !== 'ALL' ||
    selectedDbId !== 'ALL' ||
    statusFilter !== 'ALL' ||
    searchTerm.trim() !== '' ||
    timeRangePreset !== '24h';

  return (
    <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4 overflow-y-auto bg-slate-50/50">
      {/* Top Header Bar with Auto Refresh Select */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            {t('monitorPollLog.title')}
          </h2>
          <p className="text-xs text-slate-500">
            {t('monitorPollLog.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Auto Refresh Select Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-semibold shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium">{t('monitorPollLog.autoRefresh')}</span>
            <select
              value={autoRefreshOption}
              onChange={(e) => setAutoRefreshOption(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="off">Off</option>
              <option value="15s">15s</option>
              <option value="30s">30s</option>
              <option value="1m">1m</option>
              <option value="5m">5m</option>
            </select>
            {secondsUntilRefresh !== null && (
              <span className="text-[10px] font-mono text-indigo-600 font-bold ml-0.5">
                ({secondsUntilRefresh}s)
              </span>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin text-indigo-600')} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Info Tips */}
      {showInfoTips && (
        <div className="p-2.5 bg-indigo-50/60 border border-indigo-200/80 rounded-lg text-indigo-950 flex items-start gap-2 text-xs shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Distributed Engine Poller Architecture: </span>
            The metric collection scheduler enqueues polling jobs into <span className="font-mono font-bold">database_poll_queue</span> with scheduled timestamps. Worker nodes lock rows using optimistic locking (<span className="font-mono font-semibold">locked_by</span>, <span className="font-mono font-semibold">locked_at</span>), query target databases, and write completion records to <span className="font-mono font-bold">database_poll_log</span>.
          </div>
        </div>
      )}

      {/* MAIN FILTER CONTROLS BAR (Compact & Smaller) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Telemetry Filter Controls
              </h3>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                • Filter by engine, database instance, and sliding time window
              </span>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* 3-Column Primary Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Filter 1: DATABASE ENGINE */}
          <div className="md:col-span-3 space-y-1">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider pb-2.5">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Database Engine</span>
            </label>
            <div className="relative">
              <select
                value={selectedEngineType}
                onChange={(e) => {
                  const newEngine = e.target.value;
                  setSelectedEngineType(newEngine);
                  // If selected DB doesn't match new engine, reset DB to ALL
                  if (newEngine !== 'ALL' && selectedDb && selectedDb.dbType.toUpperCase() !== newEngine.toUpperCase()) {
                    setSelectedDbId('ALL');
                  }
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer appearance-none pr-7"
              >
                <option value="ALL">All Database Engines</option>
                {availableEngines.map((engine) => (
                  <option key={engine.code} value={engine.code}>
                    {engine.name} ({engine.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: Target Database (Searchable Custom Dropdown) */}
          <div className="md:col-span-4 space-y-1" ref={dbDropdownRef}>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider pb-2.5">
              <Database className="w-3 h-3 text-emerald-500" />
              <span>Target Database</span>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDbDropdownOpen(!isDbDropdownOpen)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-left font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {selectedDb ? (
                    <>
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          selectedDb.status === 'UP'
                            ? 'bg-emerald-500'
                            : selectedDb.status === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        )}
                      />
                      <span className="font-bold text-slate-900 truncate">{selectedDb.name}</span>
                      <span
                        className={cn(
                          'text-[9px] font-mono px-1 py-0.1 rounded border font-semibold',
                          getDbEngineBadgeClass(selectedDb.dbType)
                        )}
                      >
                        {selectedDb.dbType}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-700 font-bold">
                      All Databases ({searchableDatabases.length})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {selectedDbId !== 'ALL' && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDbId('ALL');
                        setCurrentPage(1);
                      }}
                      className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer text-[10px]"
                      title="Clear selection"
                    >
                      ✕
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                      isDbDropdownOpen && 'rotate-180 text-indigo-600'
                    )}
                  />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isDbDropdownOpen && (
                <div className="absolute z-50 mt-1.5 w-full min-w-[300px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {/* Search inside dropdown */}
                  <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        ref={dbSearchInputRef}
                        type="text"
                        placeholder="Filter by name, host, port, note..."
                        value={dbSearchQuery}
                        onChange={(e) => setDbSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1">
                    {/* All Databases Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDbId('ALL');
                        setIsDbDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer',
                        selectedDbId === 'ALL'
                          ? 'bg-indigo-50 text-indigo-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-slate-400" />
                        <span>All Databases ({searchableDatabases.length})</span>
                      </div>
                      {selectedDbId === 'ALL' && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 font-bold" />
                      )}
                    </button>

                    {searchableDatabases.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No database instances match "{dbSearchQuery}"
                      </div>
                    ) : (
                      searchableDatabases.map((db) => {
                        const isSelected = selectedDbId === db.id;
                        return (
                          <button
                            key={db.id}
                            type="button"
                            onClick={() => {
                              setSelectedDbId(db.id);
                              setIsDbDropdownOpen(false);
                              setCurrentPage(1);
                            }}
                            className={cn(
                              'w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between transition-colors cursor-pointer group',
                              isSelected
                                ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                                : 'hover:bg-slate-50 text-slate-800'
                            )}
                          >
                            <div className="flex items-start gap-2.5 truncate">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full shrink-0 mt-1.5',
                                  db.status === 'UP'
                                    ? 'bg-emerald-500 ring-2 ring-emerald-100'
                                    : db.status === 'WARNING'
                                    ? 'bg-amber-500 ring-2 ring-amber-100'
                                    : 'bg-rose-500 ring-2 ring-rose-100'
                                )}
                              />
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 truncate">{db.name}</span>
                                  <span
                                    className={cn(
                                      'text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0',
                                      getDbEngineBadgeClass(db.dbType)
                                    )}
                                  >
                                    {db.dbType}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2 truncate">
                                  <span>{db.host}:{db.port}</span>
                                  {db.databaseName && <span>• {db.databaseName}</span>}
                                </div>
                              </div>
                            </div>

                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600 shrink-0 font-bold" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
                    <span>{searchableDatabases.length} databases</span>
                    {selectedEngineType !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setSelectedEngineType('ALL')}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                      >
                        Show all engines
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter 3: Time Window (Compact) */}
          <div className="md:col-span-5 space-y-1">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <Calendar className="w-3 h-3 text-indigo-500" />
                <span>Time Window</span>
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                {(['1h', '6h', '24h', '3d', '7d', 'all'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectTimePreset(preset)}
                    className={cn(
                      'px-1.5 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer',
                      timeRangePreset === preset
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    )}
                  >
                    {preset.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range Inputs */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="relative">
                <span className="absolute left-2 top-1 text-[9px] font-bold text-slate-400 uppercase pointer-events-none">
                  From:
                </span>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-1 py-1 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                />
              </div>

              <div className="relative">
                <span className="absolute left-2 top-1 text-[9px] font-bold text-slate-400 uppercase pointer-events-none">
                  To:
                </span>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-7 pr-1 py-1 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Active Filter Chips Summary */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">
              Active Scope:
            </span>

            {/* Engine Chip */}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              Engine: <strong className="text-indigo-600">{selectedEngineType}</strong>
            </span>

            {/* Target DB Chip */}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              Database: <strong className="text-emerald-700">{selectedDb ? selectedDb.name : 'All Databases'}</strong>
            </span>

            {/* Time Window Chip */}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              Logs Window: <strong className="text-indigo-600">{timeRangePreset.toUpperCase()}</strong>
              <span className="text-[9px] text-slate-400 font-normal ml-0.5">(Queue unfiltered)</span>
            </span>
          </div>

          <div className="text-[10px] text-slate-500 font-mono">
            Logs matching scope: <strong>{filteredLogs.length}</strong> | Queue active: <strong>{filteredQueue.length}</strong>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Queue</span>
            <span className="text-base font-black text-slate-800">
              {stats.pendingQueue + stats.processingQueue}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block">
              {stats.pendingQueue} Pending
            </span>
            <span className="text-[9px] text-indigo-600 font-semibold mt-0.5 block">
              {stats.processingQueue} Processing
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Polls Succeeded</span>
            <span className="text-base font-black text-emerald-700">{stats.successLogs}</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
            Success
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Polls Failed</span>
            <span className="text-base font-black text-rose-700">{stats.failedLogs}</span>
          </div>
          <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
            Errors
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Avg Execution</span>
            <span className="text-base font-black text-indigo-700">{stats.avgDuration}ms</span>
          </div>
          <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
            Duration
          </span>
        </div>
      </div>

      {/* SECTION 1: DATABASE POLL QUEUE (database_poll_queue) - BEFORE LOGS */}
      {/* Note: Queue table is NOT filtered by time window */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                1. Scheduled Database Poll Queue
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                  Table: database_poll_queue ({filteredQueue.length} items)
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Jobs currently waiting or in flight across backend polling workers (unfiltered by time window).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Pending: {filteredQueue.filter(q => q.status === 'pending').length}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> Processing: {filteredQueue.filter(q => q.status === 'processing').length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Queue ID</th>
                <th className="py-2.5 px-3">Database Instance</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Locked By / Worker</th>
                <th className="py-2.5 px-3">Locked At</th>
                <th className="py-2.5 px-3">Scheduled At</th>
                <th className="py-2.5 px-3">Enqueued At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Clock className="w-6 h-6 text-slate-300" />
                      <span className="font-semibold text-slate-600">Database poll queue is currently idle</span>
                      <span className="text-[11px] text-slate-400">
                        No pending jobs in <span className="font-mono">database_poll_queue</span> matching current database/engine filter.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => {
                  const dbObj = dbMap.get(item.dbId);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* ID */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          #{item.id}
                        </span>
                      </td>

                      {/* Database */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Server className="w-3 h-3 text-slate-400" />
                          {item.dbName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {item.dbId} {dbObj ? `(${dbObj.dbType})` : ''}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {item.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full animate-pulse">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            PROCESSING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-2.5 h-2.5" />
                            PENDING
                          </span>
                        )}
                      </td>

                      {/* Locked By */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.lockedBy ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <Lock className="w-3 h-3 text-indigo-500" />
                            {item.lockedBy}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Locked At */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.lockedAt ? (
                          <span className="font-mono text-[11px] text-slate-700">
                            {formatDateTime(item.lockedAt)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Scheduled At */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-[11px] font-semibold text-slate-800">
                          {formatDateTime(item.scheduledAt)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatRelativeTime(item.scheduledAt)}
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-[11px] text-slate-600">
                          {formatDateTime(item.createdAt)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: DATABASE POLL LOGS (database_poll_log) */}
      <div className="space-y-4">
        {/* Controls & Filter Bar for Logs */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  2. Historical Poll Execution Logs
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                    Table: database_poll_log ({filteredLogs.length} matching)
                  </span>
                </h3>
              </div>
            </div>
          </div>

          {/* Row: Search and Secondary Status Filter */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search log ID, database ID, database name, error message..."
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

            {/* Secondary Status Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">Status: All (Success & Failed)</option>
                <option value="success">Success Only</option>
                <option value="failed">Failed Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Poll Logs Table Container */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="overflow-x-auto rounded-t-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Log ID</th>
                  <th className="py-2.5 px-3">Database Instance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Started At</th>
                  <th className="py-2.5 px-3">Finished At</th>
                  <th className="py-2.5 px-3">Execution Duration</th>
                  <th className="py-2.5 px-3">Diagnostics / Error Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Activity className="w-8 h-8 text-slate-300" />
                        <span className="font-semibold text-slate-600">No database poll execution logs found</span>
                        <span className="text-xs text-slate-400 max-w-sm">
                          No poll logs in <span className="font-mono">database_poll_log</span> matched the selected filters or {timeRangePreset.toUpperCase()} time window.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => {
                    const dbObj = dbMap.get(log.dbId);
                    const durationMs = calculateDurationMs(log.startedAt, log.finishedAt);
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                      >
                        {/* ID */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            #{log.id}
                          </span>
                        </td>

                        {/* Database */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Server className="w-3 h-3 text-slate-400" />
                            {log.dbName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {log.dbId} {dbObj ? `(${dbObj.dbType})` : ''}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {log.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              SUCCESS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              FAILED
                            </span>
                          )}
                        </td>

                        {/* Started At */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-mono text-[11px] font-semibold text-slate-800">
                            {formatDateTime(log.startedAt)}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatRelativeTime(log.startedAt)}
                          </div>
                        </td>

                        {/* Finished At */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-mono text-[11px] text-slate-700">
                            {formatDateTime(log.finishedAt)}
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {durationMs !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded font-bold border ${
                                durationMs > 5000
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <Timer className="w-3 h-3 text-slate-400" />
                              {durationMs}ms
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Diagnostic info / error */}
                        <td className="py-2.5 px-3">
                          {log.errorMessage ? (
                            <div className="flex items-center gap-1.5 text-rose-700 text-[11px] font-semibold max-w-[280px] truncate" title={log.errorMessage}>
                              <AlertOctagon className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="truncate">{log.errorMessage}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>Metric extraction finished nominal</span>
                              <span className="text-slate-400 group-hover:text-indigo-600 text-[10px] underline ml-1">
                                View details »
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
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                  : `${(currentPage - 1) * pageSize + 1}–${Math.min(
                      currentPage * pageSize,
                      filteredLogs.length
                    )} of ${filteredLogs.length}`}
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

      {/* Detail Dialog for Poll Log Inspection */}
      {selectedLog && (
        <Dialog
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Poll Execution Detail: Log #${selectedLog.id}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span
                  className={`font-bold inline-flex items-center gap-1 mt-0.5 ${
                    selectedLog.status === 'success' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {selectedLog.status === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  )}
                  {selectedLog.status.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Database Name</span>
                <span className="font-bold text-slate-900">{selectedLog.dbName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Database ID</span>
                <span className="font-mono text-slate-700">{selectedLog.dbId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Execution Duration</span>
                <span className="font-mono font-bold text-indigo-700">
                  {calculateDurationMs(selectedLog.startedAt, selectedLog.finishedAt)}ms
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Started At</span>
                <span className="font-mono text-slate-800">{formatDateTime(selectedLog.startedAt)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Finished At</span>
                <span className="font-mono text-slate-800">{formatDateTime(selectedLog.finishedAt)}</span>
              </div>
            </div>

            {selectedLog.errorMessage ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                <span className="font-bold block mb-1">Collector Error Output:</span>
                <pre className="font-mono text-[11px] whitespace-pre-wrap break-all bg-white p-2.5 rounded border border-rose-200">
                  {selectedLog.errorMessage}
                </pre>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                <span className="font-bold block mb-0.5">Execution Summary:</span>
                <p className="text-[11px]">
                  Database connection established, metric queries evaluated against defined template thresholds, and raw telemetry written successfully.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Log Inspection
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
