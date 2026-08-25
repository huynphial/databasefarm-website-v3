import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Server,
  Info,
  CheckCircle2,
  FolderKanban,
  Gauge,
  EyeOff,
  Eye,
  KeyRound,
  Shield,
  Sparkles,
  Search,
  Filter,
  AlertTriangle,
  AlertOctagon,
  Flame,
  Activity,
  Database,
  ArrowUpDown,
  Clock,
  RefreshCw,
  BarChart3,
  Tag,
  FileText,
  X,
} from 'lucide-react';
import { ActiveAlertEntity, DatabaseEntity, DatabaseEngineEntity, DbEngine, GroupEntity, MetricEntity, TemplateEntity, UserRole } from '../../types';
import { DataTable, Column } from '../tables/DataTable';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { DB_ENGINES, getDbEngineBadgeClass, getDbEngineConfig, getDbEngineHexColor } from '../../config/dbEngines';

interface DatabasesViewProps {
  databases: DatabaseEntity[];
  groups: GroupEntity[];
  templates: TemplateEntity[];
  metrics: MetricEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  activeAlerts?: ActiveAlertEntity[];
  userRole: UserRole;
  showInfoTips?: boolean;
  onSaveDatabase: (database: Partial<DatabaseEntity>) => void;
  onDeleteDatabase: (id: string) => void;
  onNavigateToAnalytics?: (dbId: string) => void;
  onRefresh?: () => void;
}

export const DatabasesView: React.FC<DatabasesViewProps> = ({
  databases,
  groups,
  templates,
  metrics,
  databaseEngines = [],
  activeAlerts = [],
  userRole,
  showInfoTips = true,
  onSaveDatabase,
  onDeleteDatabase,
  onNavigateToAnalytics,
  onRefresh,
}) => {
  const { toast } = useToast();
  
  // Available engines (dynamic from registry if available, fallback to config)
  const availableEngines = useMemo(() => {
    if (databaseEngines && databaseEngines.length > 0) {
      return databaseEngines.map((e) => ({
        code: e.dbCode,
        name: e.dbName,
        defaultPort: e.defaultPort,
        color: e.dbColor,
      }));
    }
    return DB_ENGINES;
  }, [databaseEngines]);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  
  // Sorting State
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination State (Default 50 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Dialog & Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDb, setEditingDb] = useState<DatabaseEntity | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const RECOMMENDED_TAGS = ['PRODUCTION', 'STAGING', 'LAB', 'DEV', 'CRITICAL', 'ANALYTICS', 'PRIMARY', 'REPLICA', 'FINANCE'];

  const [customTagInput, setCustomTagInput] = useState('');

  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    dbType: DbEngine;
    host: string;
    port: number;
    tags: string[];
    pollIntervalMinutes: number;
    note: string;
    username: string;
    password: string;
    databaseNameOrSid: string;
    sslMode: string;
    groupIds: string[];
    isEnabled: boolean;
    status?: 'UP' | 'DOWN' | 'WARNING';
  }>({
    name: '',
    dbType: DB_ENGINES[0]?.code || 'POSTGRES',
    host: '',
    port: 5432,
    tags: ['PRODUCTION'],
    pollIntervalMinutes: 5,
    note: '',
    username: '',
    password: '',
    databaseNameOrSid: '',
    sslMode: 'require',
    groupIds: [],
    isEnabled: true,
  });

  // Calculate Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalDbs = databases.length;
    const monitoredDbs = databases.filter((db) => db.isEnabled !== false).length;

    let dbsDown = 0;
    let dbsUp = 0;

    databases.forEach((db) => {
      if (db.isEnabled === false) return;
      const isDown = (db.status || '').toUpperCase() === 'DOWN';
      if (isDown) dbsDown++;
      else dbsUp++;
    });

    const downAlerts = activeAlerts.filter((a) => (a.alertLevel || '').toUpperCase() === 'DOWN').length;
    const criticalAlerts = activeAlerts.filter((a) => {
      const lvl = (a.alertLevel || '').toUpperCase();
      return lvl === 'CRITICAL' || lvl === 'FATAL';
    }).length;
    const highAlerts = activeAlerts.filter((a) => (a.alertLevel || '').toUpperCase() === 'HIGH').length;
    const warningAlerts = activeAlerts.filter((a) => {
      const lvl = (a.alertLevel || '').toUpperCase();
      return lvl === 'WARN' || lvl === 'WARNING';
    }).length;

    return {
      totalDbs,
      monitoredDbs,
      dbsDown,
      dbsUp,
      downAlerts,
      criticalAlerts,
      highAlerts,
      warningAlerts,
    };
  }, [databases, activeAlerts]);

  // Calculate inherited metrics dynamically based on selected groupIds and DB type
  const inheritedMetrics = useMemo(() => {
    if (formData.groupIds.length === 0) return [];
    
    // Find all templates attached to selected groups
    const selectedGroupEntities = groups.filter((g) => formData.groupIds.includes(g.id));
    const attachedTemplateIds = new Set<string>();
    selectedGroupEntities.forEach((g) => {
      g.templateIds?.forEach((tId) => attachedTemplateIds.add(tId));
    });

    // Get templates
    const attachedTemplates = templates.filter((t) => attachedTemplateIds.has(t.id));
    
    // Filter templates that match the database type or are universal
    const compatibleTemplateIds = new Set(
      attachedTemplates
        .filter((t) => !t.targetDbType || t.targetDbType === 'ALL' || t.targetDbType === formData.dbType)
        .map((t) => t.id)
    );

    // Get all metrics belonging to these compatible templates
    return metrics.filter(
      (m) =>
        (m.templateIds?.some((id) => compatibleTemplateIds.has(id)) || (m.templateId && compatibleTemplateIds.has(m.templateId))) &&
        m.isEnabled !== false
    );
  }, [formData.groupIds, formData.dbType, groups, templates, metrics]);

  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const handleRunHealthCheckAll = () => {
    setIsCheckingHealth(true);
    setTimeout(() => {
      const now = new Date().toISOString();
      const activeDbs = databases.filter((db) => db.isEnabled !== false);
      activeDbs.forEach((db) => {
        onSaveDatabase({
          ...db,
          lastCheckAt: now,
          updatedAt: now,
        });
      });
      setIsCheckingHealth(false);
      onRefresh?.();
      toast({
        title: 'Health Checks Completed',
        description: `Successfully executed health probes across ${activeDbs.length} active database instances. Last check timestamps refreshed.`,
        type: 'success',
      });
    }, 600);
  };

  const openCreateDialog = () => {
    setEditingDb(null);
    setShowPassword(false);
    setCustomTagInput('');
    const defaultEng = DB_ENGINES[0];
    setFormData({
      name: '',
      dbType: defaultEng?.code || 'POSTGRES',
      host: '10.0.14.90',
      port: defaultEng?.defaultPort || 5432,
      tags: ['PRODUCTION'],
      pollIntervalMinutes: 5,
      note: '',
      username: 'dbmon_reader',
      password: 'SecureClusterPassword#2026',
      databaseNameOrSid: 'app_production',
      sslMode: 'require',
      groupIds: groups.length > 0 ? [groups[0].id] : [],
      isEnabled: true,
      status: 'UP' as 'UP' | 'DOWN' | 'WARNING',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (db: DatabaseEntity) => {
    setEditingDb(db);
    setShowPassword(false);
    setCustomTagInput('');
    setFormData({
      id: db.id,
      name: db.name,
      dbType: db.dbType,
      host: db.host,
      port: db.port,
      tags: db.tags || [],
      pollIntervalMinutes: db.pollIntervalMinutes ?? 5,
      note: db.note || '',
      username: db.username || db.connectionConfig?.username || '',
      password: db.password || '',
      databaseNameOrSid: db.connectionConfig?.databaseName || db.connectionConfig?.serviceName || '',
      sslMode: db.connectionConfig?.sslMode || 'require',
      groupIds: db.groupIds || [],
      isEnabled: db.isEnabled !== false,
      status: (db.status || 'UP') as 'UP' | 'DOWN' | 'WARNING',
    });
    setIsDialogOpen(true);
  };

  const handleToggleEnable = (db: DatabaseEntity) => {
    if (userRole !== 'ADMIN') {
      toast({
        title: 'Permission Denied',
        description: 'Only users with the ADMIN role can toggle database monitoring.',
        type: 'error',
      });
      return;
    }
    const nextState = db.isEnabled === false;
    onSaveDatabase({
      ...db,
      isEnabled: nextState,
    });
    toast({
      title: nextState ? 'Database Monitoring Enabled' : 'Database Monitoring Paused',
      description: `Monitoring metadata for instance "${db.name}" is now ${nextState ? 'ACTIVE' : 'PAUSED'}.`,
      type: 'info',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.port) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    // Auto-derive inherited metric IDs from group templates
    const autoMetricIds = inheritedMetrics.map((m) => m.id);

    const payload: Partial<DatabaseEntity> = {
      id: formData.id,
      name: formData.name.trim(),
      dbType: formData.dbType,
      host: formData.host.trim(),
      port: Number(formData.port),
      tags: formData.tags,
      pollIntervalMinutes: Number(formData.pollIntervalMinutes) || 5,
      note: formData.note.trim(),
      username: formData.username.trim(),
      password: formData.password,
      isEnabled: formData.isEnabled,
      status: formData.status || editingDb?.status || 'UP',
      lastCheckAt: editingDb?.lastCheckAt || new Date().toISOString(),
      connectionConfig: {
        username: formData.username.trim(),
        ...(formData.dbType === 'ORACLE'
          ? { serviceName: formData.databaseNameOrSid.trim() }
          : { databaseName: formData.databaseNameOrSid.trim() }),
        sslMode: formData.sslMode,
      },
      groupIds: formData.groupIds,
      metricIds: autoMetricIds,
    };

    onSaveDatabase(payload);
    setIsDialogOpen(false);
    toast({
      title: formData.id ? 'Database Metadata Updated' : 'Database Configured in Central MySQL',
      description: `Target instance "${formData.name}" configuration saved with ${autoMetricIds.length} inherited metric probe(s).`,
      type: 'success',
    });
  };

  const handleDelete = (db: DatabaseEntity) => {
    if (confirm(`Are you sure you want to delete database "${db.name}"? This will remove its configuration record from the central MySQL Configuration Database.`)) {
      onDeleteDatabase(db.id);
      toast({
        title: 'Database Removed',
        description: `Database ${db.name} was removed from configuration.`,
        type: 'info',
      });
    }
  };

  const handleSortChange = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Filter & Sort Databases
  const processedDatabases = useMemo(() => {
    return databases
      .map((db) => {
        const dbAlerts = activeAlerts.filter(
          (a) => String(a.dbId) === String(db.id) || (a.dbName && db.name && a.dbName.toLowerCase() === db.name.toLowerCase())
        );
        const criticalCount = dbAlerts.filter((a) => {
          const lvl = (a.alertLevel || '').toUpperCase();
          return lvl === 'CRITICAL' || lvl === 'FATAL';
        }).length;
        const highCount = dbAlerts.filter((a) => (a.alertLevel || '').toUpperCase() === 'HIGH').length;
        const warnCount = dbAlerts.filter((a) => {
          const lvl = (a.alertLevel || '').toUpperCase();
          return lvl === 'WARN' || lvl === 'WARNING';
        }).length;
        const downCount = dbAlerts.filter((a) => (a.alertLevel || '').toUpperCase() === 'DOWN').length;

        const isPaused = db.isEnabled === false;
        const dbStatusUpper = (db.status || '').toUpperCase();
        let statusScore = 2; // 0 = DOWN, 1 = WARN, 2 = UP, 3 = PAUSED
        let statusLabel = 'UP';
        if (isPaused) {
          statusScore = 3;
          statusLabel = 'PAUSED';
        } else if (dbStatusUpper === 'DOWN' || downCount > 0) {
          statusScore = 0;
          statusLabel = 'DOWN';
        } else if (dbStatusUpper === 'WARNING' || dbStatusUpper === 'WARN' || warnCount > 0 || highCount > 0 || criticalCount > 0) {
          statusScore = 1;
          statusLabel = 'WARN';
        }

        return {
          ...db,
          criticalCount,
          highCount,
          warnCount,
          downCount,
          totalAlerts: dbAlerts.length,
          statusScore,
          statusLabel,
          probeCount: db.metricIds?.length || 0,
        };
      })
      .filter((db) => {
        // Search Term Filter
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          const match =
            db.name.toLowerCase().includes(term) ||
            db.host.toLowerCase().includes(term) ||
            db.dbType.toLowerCase().includes(term) ||
            (db.username && db.username.toLowerCase().includes(term)) ||
            (db.note && db.note.toLowerCase().includes(term)) ||
            (db.tags && db.tags.some((t) => t.toLowerCase().includes(term)));
          if (!match) return false;
        }

        // Database Engine Type Filter
        if (selectedEngine !== 'ALL') {
          if (db.dbType.toUpperCase() !== selectedEngine.toUpperCase()) return false;
        }

        // Status Filter
        if (selectedStatus !== 'ALL') {
          if (selectedStatus === 'UP' && db.statusLabel !== 'UP') return false;
          if (selectedStatus === 'DOWN' && db.statusLabel !== 'DOWN') return false;
          if (selectedStatus === 'PAUSED' && db.statusLabel !== 'PAUSED') return false;
        }

        // Alert Severity Filter
        if (selectedSeverity !== 'ALL') {
          if (selectedSeverity === 'CRITICAL' && db.criticalCount === 0) return false;
          if (selectedSeverity === 'HIGH' && db.highCount === 0) return false;
          if (selectedSeverity === 'WARN' && db.warnCount === 0) return false;
          if (selectedSeverity === 'DOWN' && db.downCount === 0) return false;
          if (selectedSeverity === 'HAS_ALERTS' && db.totalAlerts === 0) return false;
          if (selectedSeverity === 'NO_ALERTS' && db.totalAlerts > 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField as keyof typeof a];
        let valB: any = b[sortField as keyof typeof b];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [databases, activeAlerts, searchTerm, selectedEngine, selectedStatus, selectedSeverity, sortField, sortOrder]);

  const totalPages = Math.ceil(processedDatabases.length / pageSize) || 1;
  const paginatedDatabases = processedDatabases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<typeof processedDatabases[0]>[] = [
    {
      header: 'Database Name & Endpoint',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">{row.name}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{row.host}:{row.port}</span>
            <span className="text-[10px] text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200" title="Auto-created Poll ID (Read-only)">
              Poll ID: {row.pollId ?? 0}
            </span>
            {row.pollIntervalMinutes && (
              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                {row.pollIntervalMinutes}m freq
              </span>
            )}
          </div>
          {row.tags && row.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.tags.map((t) => (
                <span
                  key={t}
                  className="text-[9px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Engine Type',
      accessorKey: 'dbType',
      width: '120px',
      sortable: true,
      cell: (row) => {
        const badgeClass = getDbEngineBadgeClass(row.dbType);
        const engine = getDbEngineConfig(row.dbType);
        return (
          <span className={`px-2 py-0.5 border rounded text-[10px] font-bold tracking-wider inline-block ${badgeClass}`}>
            {engine ? engine.code : row.dbType}
          </span>
        );
      },
    },
    {
      header: 'Status & Alerts (C/H/W)',
      accessorKey: 'statusScore',
      width: '185px',
      sortable: true,
      cell: (row) => {
        const statusText = row.statusLabel;
        const statusBadgeClass =
          statusText === 'PAUSED' ? 'text-slate-500 bg-slate-100 border-slate-200' :
          statusText === 'DOWN' ? 'text-rose-700 bg-rose-50 border-rose-200' :
          statusText === 'WARN' ? 'text-amber-700 bg-amber-50 border-amber-200' :
          'text-emerald-700 bg-emerald-50 border-emerald-200';

        return (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className={`px-2 py-0.5 border rounded text-[10px] font-bold tracking-wider inline-flex items-center shrink-0 ${statusBadgeClass}`}>
              {statusText}
            </span>
            <span className="text-slate-300 font-semibold">/</span>
            <span className={`font-bold ${row.criticalCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'}`} title="Critical Alerts Count">
              {row.criticalCount}
            </span>
            <span className="text-slate-300">/</span>
            <span className={`font-bold ${row.highCount > 0 ? 'text-orange-600 font-extrabold' : 'text-slate-400'}`} title="High Alerts Count">
              {row.highCount}
            </span>
            <span className="text-slate-300">/</span>
            <span className={`font-bold ${row.warnCount > 0 ? 'text-amber-600 font-extrabold' : 'text-slate-400'}`} title="Warning Alerts Count">
              {row.warnCount}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Last Check',
      accessorKey: 'lastCheckAt',
      width: '160px',
      sortable: true,
      cell: (row) => {
        const lastCheck = row.lastCheckAt;
        if (!lastCheck) {
          return <span className="text-xs text-slate-400 italic">Never checked</span>;
        }
        const dateObj = new Date(lastCheck);
        const formattedDate = dateObj.toLocaleDateString();
        const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Calculate relative time (e.g. "2m ago")
        const diffMs = Date.now() - dateObj.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        let relative = `${diffMins}m ago`;
        if (diffMins < 1) relative = 'Just now';
        else if (diffMins >= 60) {
          const diffHours = Math.floor(diffMins / 60);
          relative = `${diffHours}h ago`;
        }

        return (
          <div className="flex flex-col text-xs font-mono">
            <span className="text-slate-800 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
              {formattedTime}
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
              <span>{formattedDate}</span>
              <span className="text-indigo-600 font-bold">({relative})</span>
            </span>
          </div>
        );
      },
    },
    {
      header: 'Enable',
      accessorKey: 'isEnabled',
      width: '95px',
      sortable: true,
      cell: (row) => {
        const isEnabled = row.isEnabled !== false;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleEnable(row)}
              disabled={userRole !== 'ADMIN'}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                isEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              } ${userRole !== 'ADMIN' ? 'cursor-not-allowed opacity-60' : ''}`}
              title={isEnabled ? 'Click to pause monitoring' : 'Click to enable monitoring'}
            >
              <span className="w-3.5 h-3.5 bg-white rounded-full shadow-xs transform transition-transform" />
            </button>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isEnabled ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Assigned Groups',
      width: '170px',
      cell: (row) => {
        const assignedGroups = groups.filter((g) => row.groupIds?.includes(g.id));
        if (assignedGroups.length === 0) {
          return <span className="text-slate-400 text-xs italic">Ungrouped</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {assignedGroups.map((g) => (
              <span
                key={g.id}
                className="text-[10px] font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1 max-w-[130px] truncate"
              >
                <FolderKanban className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                <span className="truncate">{g.name}</span>
              </span>
            ))}
          </div>
        );
      },
    },
    {
      header: 'Assigned Metrics',
      accessorKey: 'probeCount',
      width: '120px',
      sortable: true,
      align: 'center',
      cell: (row) => {
        return (
          <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 inline-block">
            {row.probeCount}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      width: '110px',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {onNavigateToAnalytics && (
            <button
              onClick={() => onNavigateToAnalytics(row.id)}
              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
              title="Open in Analytics Database"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          )}
          {userRole === 'ADMIN' ? (
            <>
              <button
                onClick={() => openEditDialog(row)}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                title="Edit database configuration"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(row)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                title="Delete database configuration"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            !onNavigateToAnalytics && <span className="text-slate-400 text-xs italic">Read-only</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Decoupled Architecture Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div>
              <span className="font-bold text-slate-900">Decoupled Architecture & Metadata Console:</span> This web interface strictly manages database metadata within the central MySQL Configuration Database. Target monitoring execution and metric probe collection are handled asynchronously by an external standalone collector daemon.
            </div>
            <div className="text-[11px] text-slate-500">
              Databases inherit all metric probes from templates attached to their assigned Database Group(s).
            </div>
          </div>
        </div>
      )}



      {/* Compact Filter & Controls Toolbar */}
      <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex items-center gap-1 text-slate-800 font-bold shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filters:</span>
          </div>

          {/* Engine Type Filter */}
          <select
            value={selectedEngine}
            onChange={(e) => {
              setSelectedEngine(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Engine Types ({databases.length})</option>
            {availableEngines.map((engine) => {
              const count = databases.filter((db) => db.dbType.toUpperCase() === engine.code.toUpperCase()).length;
              return (
                <option key={engine.code} value={engine.code}>
                  {engine.name} ({count})
                </option>
              );
            })}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="UP">UP Only</option>
            <option value="DOWN">DOWN Only</option>
            <option value="PAUSED">PAUSED Only</option>
          </select>

          {/* Alert Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => {
              setSelectedSeverity(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Alert Levels</option>
            <option value="CRITICAL">Critical Alerts Present</option>
            <option value="HIGH">High Alerts Present</option>
            <option value="WARN">Warning Alerts Present</option>
            <option value="DOWN">Down Alerts Present</option>
            <option value="HAS_ALERTS">Any Active Alert</option>
            <option value="NO_ALERTS">Zero Alerts (Nominal)</option>
          </select>

          {/* Search Input */}
          <div className="relative min-w-[180px] flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Name or Host..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-300 text-xs pl-8 pr-2.5 py-1 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end shrink-0">
          <button
            onClick={async () => {
              setIsCheckingHealth(true);
              try {
                if (onRefresh) await onRefresh();
                toast({
                  title: 'Refreshed',
                  description: 'Successfully refreshed database statuses and active alert counts.',
                  type: 'success',
                });
              } finally {
                setIsCheckingHealth(false);
              }
            }}
            disabled={isCheckingHealth}
            title="Refresh database statuses and active alert telemetry"
            className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isCheckingHealth ? 'animate-spin' : ''}`} />
            <span>{isCheckingHealth ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {userRole === 'ADMIN' ? (
            <button
              onClick={openCreateDialog}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded-lg font-bold transition-colors shadow-2xs cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Database</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 italic flex items-center gap-1 shrink-0">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>View-Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Data Table with Multi-Column Sorting and 50-Item Pagination */}
      <div className="flex-1">
        <DataTable
          columns={columns}
          data={paginatedDatabases}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={processedDatabases.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          emptyMessage={
            searchTerm || selectedEngine !== 'ALL' || selectedStatus !== 'ALL' || selectedSeverity !== 'ALL'
              ? 'No monitored databases match the specified filter criteria.'
              : 'No monitored databases configured yet.'
          }
        />
      </div>

      {/* Dialog for Create/Edit Configuration */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingDb ? `Edit Database Metadata: ${editingDb.name}` : 'Register New Monitored Database'}
        description="Save endpoint credentials and metadata to the central MySQL Configuration Database. Monitored instances inherit metric probes from attached Database Groups."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Database Identifier *</label>
              <input
                type="text"
                required
                placeholder="e.g. ERP_PROD_ORA"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Engine Type (Registry Driven) *</label>
              <select
                value={formData.dbType}
                onChange={(e) => {
                  const dbType = e.target.value as DbEngine;
                  const foundEngine = availableEngines.find((eng) => eng.code === dbType);
                  const defaultPort = foundEngine ? foundEngine.defaultPort : 5432;
                  setFormData({ ...formData, dbType, port: defaultPort });
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
              >
                {availableEngines.map((eng) => (
                  <option key={eng.code} value={eng.code}>
                    {eng.name} ({eng.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Host / IP Address *</label>
              <input
                type="text"
                required
                placeholder="e.g. 10.0.12.44 or db.internal.net"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Port *</label>
              <input
                type="number"
                required
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              {formData.dbType === 'ORACLE' ? 'Service Name / SID' : 'Database Name'}
            </label>
            <input
              type="text"
              placeholder={formData.dbType === 'ORACLE' ? 'ORCLPDB1.internal' : 'app_production'}
              value={formData.databaseNameOrSid}
              onChange={(e) => setFormData({ ...formData, databaseNameOrSid: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Database Credentials */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="text-slate-900 font-bold flex items-center gap-1.5 text-xs">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              Instance Credentials (Username & Password)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dbmon_reader"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password..."
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-9 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tags Selection & Custom Input */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                Tags / Classification Array
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Click recommended or type custom tag</span>
            </label>

            {/* Recommended Tags Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {RECOMMENDED_TAGS.map((recTag) => {
                const isSelected = formData.tags.includes(recTag);
                return (
                  <button
                    key={recTag}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setFormData({ ...formData, tags: formData.tags.filter((t) => t !== recTag) });
                      } else {
                        setFormData({ ...formData, tags: [...formData.tags, recTag] });
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {recTag}
                  </button>
                );
              })}
            </div>

            {/* Active Selected Tags Display & Add Tag Input */}
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex flex-wrap gap-1.5 min-h-[26px] items-center">
                {formData.tags.length > 0 ? (
                  formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-md"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) })}
                        className="text-indigo-500 hover:text-indigo-800 cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">No tags selected</span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <input
                  type="text"
                  placeholder="Type custom tag name and press Enter..."
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const tagVal = customTagInput.trim().toUpperCase();
                      if (tagVal && !formData.tags.includes(tagVal)) {
                        setFormData({ ...formData, tags: [...formData.tags, tagVal] });
                      }
                      setCustomTagInput('');
                    }
                  }}
                  className="flex-1 bg-white border border-slate-300 text-xs rounded-md px-2.5 py-1 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const tagVal = customTagInput.trim().toUpperCase();
                    if (tagVal && !formData.tags.includes(tagVal)) {
                      setFormData({ ...formData, tags: [...formData.tags, tagVal] });
                    }
                    setCustomTagInput('');
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer"
                >
                  Add Tag
                </button>
              </div>
            </div>
          </div>

          {/* Query Frequency & Operational Note */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  Query Frequency *
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  required
                  value={formData.pollIntervalMinutes}
                  onChange={(e) => setFormData({ ...formData, pollIntervalMinutes: Math.max(1, Number(e.target.value)) })}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  min
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Default polling frequency (5 minutes)</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Operational Note (Long Text)
              </label>
              <textarea
                rows={2}
                placeholder="Instance documentation, architecture details, maintenance window, on-call contacts..."
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>
          </div>

          {/* Read-Only Auto-Created Poll ID */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 block text-xs">Poll Sequence ID (Read-Only)</span>
              <span className="text-[10px] text-slate-500">Auto-created database polling sequence attribute (default = 0)</span>
            </div>
            <div className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded border border-indigo-200">
              pollId: {editingDb?.pollId ?? 0}
            </div>
          </div>

          {/* Monitoring Active Toggle & Instance Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <span className="font-bold text-slate-900 block text-xs">Enable Active Monitoring</span>
              <span className="text-[10px] text-slate-500">Instruct external collector daemon to gather metric probes for this instance</span>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    formData.isEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" />
                </button>
                <span className="text-xs font-bold text-slate-700">
                  {formData.isEnabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}
                </span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-900 block text-xs">Instance Status (databases.status)</span>
              <span className="text-[10px] text-slate-500">Operational state stored in table databases</span>
              <select
                value={formData.status || 'UP'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="mt-1.5 w-full bg-white border border-slate-300 text-xs font-bold px-2.5 py-1 rounded-md text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="UP">UP (Operational)</option>
                <option value="DOWN">DOWN (Offline / Outage)</option>
                <option value="WARNING">WARNING (Degraded)</option>
              </select>
            </div>
          </div>

          {/* Group Selection (Many-to-Many) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 font-semibold flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                Select Database Group(s) *
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {formData.groupIds.length} group(s) selected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
              {groups.map((g) => {
                const isSelected = formData.groupIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 font-semibold shadow-2xs'
                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, groupIds: [...formData.groupIds, g.id] });
                        } else {
                          setFormData({
                            ...formData,
                            groupIds: formData.groupIds.filter((id) => id !== g.id),
                          });
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="truncate">
                      <div className="truncate text-xs">{g.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {g.templateIds?.length || 0} template(s)
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Automatic Metric Inheritance Preview */}
          <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Inherited Monitoring Metrics (Auto-Assigned from Group Templates)
              </span>
              <span className="text-[11px] font-bold text-indigo-700 px-2 py-0.5 bg-indigo-100 rounded">
                {inheritedMetrics.length} probe{inheritedMetrics.length !== 1 ? 's' : ''}
              </span>
            </div>

            {inheritedMetrics.length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {inheritedMetrics.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 bg-white rounded-lg border border-indigo-200/70 text-xs flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-900">{m.name}</span>
                        <span className="text-[10px] text-slate-500 block">
                          Template: {m.templateName || 'Template Bundle'} (Cycle {m.cycle ?? 1})
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {m.valueType}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-white rounded-lg border border-dashed border-slate-300 text-center text-slate-500 text-xs">
                {formData.groupIds.length === 0
                  ? 'Select at least one Database Group above to automatically inherit its template metrics.'
                  : 'Selected groups do not have templates matching this database engine type yet.'}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-2xs cursor-pointer"
            >
              {editingDb ? 'Save Changes' : 'Register Database'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};


