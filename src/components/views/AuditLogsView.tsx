import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Filter,
  User,
  Globe,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  PlusCircle,
  Edit3,
  Trash2,
  Activity,
  Calendar,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { AuditLogEntity, UserRole } from '../../types';
import { api } from '../../lib/api';
import { DataTable, Column } from '../tables/DataTable';
import { formatTimeVN, cn } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n';

interface AuditLogsViewProps {
  showInfoTips?: boolean;
  userRole?: UserRole;
}

type TimeRangePreset = '1h' | '6h' | '24h' | '3d' | '7d' | '30d' | 'all' | 'custom';

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ showInfoTips = true, userRole = 'ADMIN' }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isAdmin = userRole === 'ADMIN';

  const [logs, setLogs] = useState<AuditLogEntity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Time Range state - Default 1 hour as requested
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>('1h');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  // Calculate Date bounds based on preset
  const calculateDateRange = useCallback((preset: TimeRangePreset, fromStr: string, toStr: string) => {
    const now = Date.now();
    let fromDate: string | undefined = undefined;
    let toDate: string | undefined = undefined;

    if (preset === '1h') {
      fromDate = new Date(now - 60 * 60 * 1000).toISOString();
      toDate = new Date(now).toISOString();
    } else if (preset === '6h') {
      fromDate = new Date(now - 6 * 60 * 60 * 1000).toISOString();
      toDate = new Date(now).toISOString();
    } else if (preset === '24h') {
      fromDate = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      toDate = new Date(now).toISOString();
    } else if (preset === '3d') {
      fromDate = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
      toDate = new Date(now).toISOString();
    } else if (preset === '7d') {
      fromDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      toDate = new Date(now).toISOString();
    } else if (preset === '30d') {
      fromDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      toDate = new Date(now).toISOString();
    } else if (preset === 'custom') {
      if (fromStr) fromDate = new Date(fromStr).toISOString();
      if (toStr) toDate = new Date(toStr).toISOString();
    }
    // 'all' leaves fromDate and toDate undefined

    return { fromDate, toDate };
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { fromDate, toDate } = calculateDateRange(timeRangePreset, customFrom, customTo);
      const data = await api.getAuditLogs({
        fromDate,
        toDate,
        actionType: actionFilter !== 'ALL' ? actionFilter : undefined,
        searchTerm: searchTerm.trim() || undefined,
        limit: 500,
      });
      setLogs(data);
    } catch (err: any) {
      toast({
        title: 'Fetch Failed',
        description: err.message || 'Unable to retrieve system audit logs.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, timeRangePreset, customFrom, customTo, actionFilter, searchTerm, calculateDateRange, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchAuditLogs();
    }
  }, [isAdmin, fetchAuditLogs]);

  const handleSelectPreset = (preset: TimeRangePreset) => {
    setTimeRangePreset(preset);
    if (preset !== 'custom') {
      setCustomFrom('');
      setCustomTo('');
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setTimeRangePreset('1h');
    setCustomFrom('');
    setCustomTo('');
    setActionFilter('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  if (!isAdmin) {
    return (
      <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 shadow-2xs max-w-2xl mx-auto my-8">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{t('auditLogs.accessRestrictedTitle')}</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            {t('auditLogs.accessRestrictedSub')}
          </p>
        </div>
      </div>
    );
  }

  // Client-side quick filter refinement on active result set if user continues typing
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction = actionFilter === 'ALL' || log.actionType.toUpperCase() === actionFilter.toUpperCase();
      if (!matchesAction) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase().trim();
      return (
        (log.userId && log.userId.toLowerCase().includes(term)) ||
        (log.clientIp && log.clientIp.toLowerCase().includes(term)) ||
        (log.targetEntity && log.targetEntity.toLowerCase().includes(term)) ||
        (log.targetId && log.targetId.toLowerCase().includes(term)) ||
        (log.details && log.details.toLowerCase().includes(term))
      );
    });
  }, [logs, actionFilter, searchTerm]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<AuditLogEntity>[] = [
    {
      header: t('auditLogs.colTimestamp'),
      accessorKey: 'createdAt',
      width: '180px',
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold">{formatTimeVN(row.createdAt)}</span>
        </div>
      ),
    },
    {
      header: t('auditLogs.colActionType'),
      accessorKey: 'actionType',
      width: '160px',
      cell: (row) => {
        let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
        let Icon = Activity;

        if (row.actionType === 'LOGIN_SUCCESS' || row.actionType === 'LOGIN') {
          badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
          Icon = CheckCircle2;
        } else if (row.actionType === 'LOGIN_FAILED') {
          badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
          Icon = XCircle;
        } else if (row.actionType === 'PAGE_VIEW') {
          badgeStyle = 'bg-sky-50 text-sky-800 border-sky-200';
          Icon = Eye;
        } else if (row.actionType === 'CREATE') {
          badgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-200';
          Icon = PlusCircle;
        } else if (row.actionType === 'UPDATE') {
          badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
          Icon = Edit3;
        } else if (row.actionType === 'DELETE') {
          badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
          Icon = Trash2;
        } else if (row.actionType === 'CONFIG_CHANGE') {
          badgeStyle = 'bg-purple-50 text-purple-800 border-purple-200';
          Icon = Sliders;
        }

        return (
          <span className={`px-2 py-0.5 border rounded text-[10px] font-bold font-mono inline-flex items-center gap-1 ${badgeStyle}`}>
            <Icon className="w-3 h-3 shrink-0" />
            <span>{row.actionType}</span>
          </span>
        );
      },
    },
    {
      header: t('auditLogs.colUser'),
      accessorKey: 'userId',
      width: '190px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>{row.userId}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
            <Globe className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{row.clientIp}</span>
          </div>
        </div>
      ),
    },
    {
      header: t('auditLogs.colTargetEntity'),
      accessorKey: 'targetEntity',
      width: '150px',
      cell: (row) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block uppercase tracking-wider">{row.targetEntity}</span>
          {row.targetId && (
            <span className="text-[10px] font-mono text-slate-500 truncate block max-w-[130px]" title={row.targetId}>
              ID: {row.targetId}
            </span>
          )}
        </div>
      ),
    },
    {
      header: t('auditLogs.colDetails'),
      accessorKey: 'details',
      cell: (row) => (
        <span className="text-slate-700 text-xs leading-relaxed block">
          {row.details || '—'}
        </span>
      ),
    },
  ];

  const hasActiveFilters =
    timeRangePreset !== '1h' ||
    customFrom !== '' ||
    customTo !== '' ||
    actionFilter !== 'ALL' ||
    searchTerm.trim() !== '';

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Guidance Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <FileText className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">{t('auditLogs.infoTipTitle')}</div>
            <div>{t('auditLogs.infoTipDesc')}</div>
          </div>
        </div>
      )}

      {/* Header Bar & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            {t('auditLogs.title')} ({filteredLogs.length})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('auditLogs.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              type="button"
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold border border-slate-200 transition-colors cursor-pointer"
              title="Reset all filters to default (1 hour window)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={fetchAuditLogs}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs px-3.5 py-2 rounded-lg font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('alertHistory.refreshLog')}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs space-y-3.5">
        {/* Row 1: Time Range Filter Controls (Default: 1 Hour) */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Time Window Filter:
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  {timeRangePreset.toUpperCase()}
                </span>
              </span>
              <p className="text-[10px] text-slate-500">Query audit trail events within specified historical time range</p>
            </div>
          </div>

          {/* Preset Buttons & Custom Date Pickers */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Quick Preset Pills */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {(['1h', '6h', '24h', '3d', '7d', '30d', 'all'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer',
                    timeRangePreset === preset
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  )}
                >
                  {preset.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Custom Range Option */}
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-[9px] font-bold text-slate-400 uppercase pointer-events-none">
                  From:
                </span>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    setTimeRangePreset('custom');
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg pl-11 pr-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                />
              </div>

              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-[9px] font-bold text-slate-400 uppercase pointer-events-none">
                  To:
                </span>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    setTimeRangePreset('custom');
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Action Type & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Action Filter:</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-300 text-xs px-3 py-1.5 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer shadow-2xs"
            >
              <option value="ALL">{t('auditLogs.allActions')}</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_FAILED">LOGIN_FAILED</option>
              <option value="PAGE_VIEW">PAGE_VIEW</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="CONFIG_CHANGE">CONFIG_CHANGE</option>
            </select>
          </div>

          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={t('auditLogs.searchPlaceholder') || 'Search by user, IP, entity, details...'}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 text-xs pl-8 pr-8 py-1.5 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="flex-1 flex flex-col min-h-[400px]">
        <DataTable
          columns={columns}
          data={paginatedLogs}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filteredLogs.length}
          pageSize={pageSize}
          pageSizeOptions={[15, 30, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          emptyMessage={
            loading
              ? 'Loading audit logs from database...'
              : `No audit trail records found in the last ${timeRangePreset === 'custom' ? 'custom interval' : timeRangePreset} window.`
          }
        />
      </div>
    </div>
  );
};

