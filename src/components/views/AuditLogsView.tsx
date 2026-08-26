import React, { useState, useEffect } from 'react';
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
  Activity
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

  const fetchAuditLogs = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
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
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAuditLogs();
    }
  }, [isAdmin]);

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

  const filteredLogs = logs.filter((log) => {
    const matchesAction = actionFilter === 'ALL' || log.actionType === actionFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      log.userId.toLowerCase().includes(term) ||
      log.clientIp.toLowerCase().includes(term) ||
      log.targetEntity.toLowerCase().includes(term) ||
      (log.details && log.details.toLowerCase().includes(term));

    return matchesAction && matchesSearch;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<AuditLogEntity>[] = [
    {
      header: t('auditLogs.colTimestamp'),
      accessorKey: 'createdAt',
      width: '170px',
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{formatTimeVN(row.createdAt)}</span>
        </div>
      ),
    },
    {
      header: t('auditLogs.colActionType'),
      accessorKey: 'actionType',
      width: '150px',
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
      width: '180px',
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
      width: '140px',
      cell: (row) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block uppercase tracking-wider">{row.targetEntity}</span>
          {row.targetId && (
            <span className="text-[10px] font-mono text-slate-500 truncate block max-w-[120px]">
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

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Guidance Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <FileText className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">{t('auditLogs.infoTipTitle')}</div>
            <div>
              {t('auditLogs.infoTipDesc')}
            </div>
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
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800">{t('auditLogs.allActions')}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-300 text-xs px-3 py-2 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer shadow-2xs"
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

          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={t('auditLogs.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 text-xs pl-8 pr-3 py-2 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
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
          emptyMessage={loading ? "Loading audit logs from database..." : "No audit trail records found matching the filter criteria."}
        />
      </div>
    </div>
  );
};
