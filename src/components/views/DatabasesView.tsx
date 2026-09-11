import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Download,
  Upload,
  FileJson,
  FileDown,
  FileUp,
  Layers,
  Lock,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { ActiveAlertEntity, DatabaseEntity, DatabaseEngineEntity, DbEngine, GroupEntity, MetricEntity, TemplateEntity, UserRole } from '../../types';
import { DataTable, Column } from '../tables/DataTable';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { DB_ENGINES, getDbEngineBadgeClass, getDbEngineConfig, getDbEngineHexColor } from '../../config/dbEngines';
import { useTranslation } from '../../i18n/LanguageContext';
import { DatabaseEngineFilter } from '../common/DatabaseEngineFilter';
import { DatabaseEngineSummaryGrid } from '../common/DatabaseEngineSummaryGrid';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

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
  onNavigateToSettings?: () => void;
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
  onNavigateToSettings,
  onRefresh,
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();

  // License Status State (checks database_poll_log for worker license expiry errors)
  const [licenseStatus, setLicenseStatus] = useState<{
    failCount: number;
    isLicensed: boolean;
    checked: boolean;
    loading: boolean;
  }>({
    failCount: 0,
    isLicensed: true,
    checked: false,
    loading: false,
  });

  const checkLicenseStatus = async () => {
    try {
      setLicenseStatus((prev) => ({ ...prev, loading: true }));
      const res = await api.getLicenseStatus();
      setLicenseStatus({
        failCount: res.failCount || 0,
        isLicensed: res.isLicensed !== false && (res.failCount || 0) === 0,
        checked: true,
        loading: false,
      });
    } catch (err) {
      console.warn('Failed to check license status:', err);
      setLicenseStatus((prev) => ({ ...prev, loading: false, checked: true }));
    }
  };

  useEffect(() => {
    checkLicenseStatus();
  }, []);
  
  // Available engines (dynamic from registry if available, fallback to config) - only active engines
  const availableEngines = useMemo(() => {
    if (databaseEngines && databaseEngines.length > 0) {
      const activeList = databaseEngines.filter((e) => e.statusOnOff === 'ACTIVE');
      if (activeList.length > 0) {
        return activeList.map((e) => ({
          code: e.dbCode,
          name: e.dbName,
          defaultPort: e.defaultPort || 1521,
          color: e.dbColor,
        }));
      }
    }
    return DB_ENGINES;
  }, [databaseEngines]);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<string>('ALL');
  const [selectedSystem, setSelectedSystem] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');

  // Extract unique systems for system filter dropdown
  const availableSystems = useMemo(() => {
    const systems = new Set<string>();
    databases.forEach((db) => {
      if (db.databaseSystem && db.databaseSystem.trim()) {
        systems.add(db.databaseSystem.trim());
      }
    });
    return Array.from(systems).sort((a, b) => a.localeCompare(b));
  }, [databases]);

  // Compute active filters count and reset handler
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (selectedEngine !== 'ALL') count++;
    if (selectedSystem !== 'ALL') count++;
    if (selectedStatus !== 'ALL') count++;
    if (selectedSeverity !== 'ALL') count++;
    return count;
  }, [searchTerm, selectedEngine, selectedSystem, selectedStatus, selectedSeverity]);

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedEngine('ALL');
    setSelectedSystem('ALL');
    setSelectedStatus('ALL');
    setSelectedSeverity('ALL');
    setCurrentPage(1);
  }, []);
  
  // Sorting State
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination State (Default 25 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Dialog & Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDb, setEditingDb] = useState<DatabaseEntity | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Export / Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    type: 'BUNDLE' | 'SINGLE';
    databases: Array<{
      id?: string;
      name: string;
      databaseSystem?: string;
      dbType: DbEngine;
      host: string;
      port: number;
      pollId?: number;
      tags?: string[];
      pollIntervalMinutes?: number;
      note?: string;
      username?: string;
      password?: string;
      databaseNameOrSid?: string;
      sslMode?: string;
      connectionConfig?: Record<string, any>;
      groupIds?: string[];
      isEnabled?: boolean;
      status?: 'UP' | 'DOWN';
    }>;
  } | null>(null);
  const [importAssignGroupIds, setImportAssignGroupIds] = useState<string[]>([]);
  const [importGenerateNewIds, setImportGenerateNewIds] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const RECOMMENDED_TAGS = ['PRODUCTION', 'PRIMARY', 'STANDBY', 'STAGING', 'LAB', 'DEV', 'CRITICAL', 'ANALYTICS', 'REPLICA', 'FINANCE', 'RAC', 'DATAGUARD','OS', 'SERVER','WINDOWS','UBUNTU','CENTOS','ORACLELINUX','REDHAT','OPENSUSE'];

  const [customTagInput, setCustomTagInput] = useState('');

  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    databaseSystem: string;
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
    databaseSystem: '',
    dbType: DB_ENGINES[0]?.code || 'ORACLE',
    host: '',
    port: 1521,
    tags: ['PRODUCTION'],
    pollIntervalMinutes: 10,
    note: '',
    username: '',
    password: '',
    databaseNameOrSid: '',
    sslMode: 'no',
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
        title: t('databases.healthChecksCompleted'),
        description: t('databases.healthChecksDesc', { count: activeDbs.length }),
        type: 'success',
      });
    }, 600);
  };

  // Helper to ensure password is exported as secure AES ciphertext
  const getExportCiphertext = (db: DatabaseEntity): string => {
    if (db.passwordEncrypted && db.passwordEncrypted.startsWith('enc:')) {
      return db.passwordEncrypted;
    }
    if (db.password && db.password.startsWith('enc:')) {
      return db.password;
    }
    if (db.passwordEncrypted) {
      return db.passwordEncrypted;
    }
    if (db.password) {
      try {
        return `enc:24be969ea89dd77dc256beab28bd03af:${btoa(unescape(encodeURIComponent(db.password)))}`;
      } catch {
        return `enc:24be969ea89dd77dc256beab28bd03af:${db.password}`;
      }
    }
    return '';
  };

  // ----------------------------------------------------
  // EXPORT ALL DATABASES (JSON BUNDLE)
  // ----------------------------------------------------
  const handleExportAllDatabases = () => {
    if (userRole !== 'ADMIN') {
      toast({
        title: t('activeAlerts.permissionDenied') || 'Permission Denied',
        description: 'Only administrators can export database configurations.',
        type: 'error',
      });
      return;
    }

    if (databases.length === 0) {
      toast({
        title: t('databases.noDbsToExport'),
        description: t('databases.noDbsToExportDesc'),
        type: 'warning',
      });
      return;
    }

    const exportBundle = {
      $schema: 'https://database-monitoring/schema/database-bundle-v1.json',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'MONITORING_DATABASE_BUNDLE',
      count: databases.length,
      databases: databases.map((db) => {
        const cipherPass = getExportCiphertext(db);
        return {
          id: db.id,
          name: db.name,
          databaseSystem: db.databaseSystem || '',
          dbType: db.dbType,
          host: db.host,
          port: db.port,
          pollId: db.pollId ?? 0,
          tags: db.tags || [],
          pollIntervalMinutes: db.pollIntervalMinutes ?? 5,
          note: db.note || '',
          username: db.username || db.connectionConfig?.username || '',
          password: cipherPass, // Exported securely as AES ciphertext
          passwordEncrypted: cipherPass,
          ciphertext: cipherPass,
          databaseNameOrSid: db.connectionConfig?.databaseName || db.connectionConfig?.serviceName || '',
          sslMode: db.connectionConfig?.sslMode || 'require',
          connectionConfig: db.connectionConfig || {},
          groupIds: db.groupIds || [],
          isEnabled: db.isEnabled !== false,
          status: db.status || 'UP',
        };
      }),
    };

    const jsonString = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_monitored_databases_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t('databases.dbsExported'),
      description: t('databases.dbsExportedDesc', { count: databases.length }),
      type: 'success',
    });
  };

  // ----------------------------------------------------
  // EXPORT SINGLE DATABASE (JSON)
  // ----------------------------------------------------
  const handleExportSingleDatabase = useCallback((db: DatabaseEntity) => {
    if (userRole !== 'ADMIN') {
      toast({
        title: t('activeAlerts.permissionDenied') || 'Permission Denied',
        description: 'Only administrators can export database configurations.',
        type: 'error',
      });
      return;
    }

    const cipherPass = getExportCiphertext(db);
    const exportPayload = {
      $schema: 'https://database-monitoring/schema/database-v1.json',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'MONITORING_DATABASE',
      database: {
        id: db.id,
        name: db.name,
        databaseSystem: db.databaseSystem || '',
        dbType: db.dbType,
        host: db.host,
        port: db.port,
        pollId: db.pollId ?? 0,
        tags: db.tags || [],
        pollIntervalMinutes: db.pollIntervalMinutes ?? 5,
        note: db.note || '',
        username: db.username || db.connectionConfig?.username || '',
        password: cipherPass, // Exported securely as AES ciphertext
        passwordEncrypted: cipherPass,
        ciphertext: cipherPass,
        databaseNameOrSid: db.connectionConfig?.databaseName || db.connectionConfig?.serviceName || '',
        sslMode: db.connectionConfig?.sslMode || 'require',
        connectionConfig: db.connectionConfig || {},
        groupIds: db.groupIds || [],
        isEnabled: db.isEnabled !== false,
        status: db.status || 'UP',
      },
    };

    const safeName = db.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database_${safeName}_${db.dbType.toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t('databases.dbExportedSingle'),
      description: t('databases.dbExportedSingleDesc', { name: db.name }),
      type: 'success',
    });
  }, [userRole, toast, t]);

  // ----------------------------------------------------
  // IMPORT DATABASES FROM JSON
  // ----------------------------------------------------
  const parseDatabaseItem = (raw: any) => {
    const name = raw.name || raw.databaseName || 'Imported Database';
    const databaseSystem = raw.databaseSystem || raw.database_system || raw.system || '';
    const dbType = (raw.dbType || raw.engine || 'ORACLE').toUpperCase() as DbEngine;
    const host = raw.host || '127.0.0.1';
    const foundEng = getDbEngineConfig(dbType);
    const port = Number(raw.port) || foundEng?.defaultPort || 1521;
    const tags = Array.isArray(raw.tags) ? raw.tags : [];
    const pollIntervalMinutes = Number(raw.pollIntervalMinutes) || 5;
    const note = raw.note || '';
    const username = raw.username || raw.connectionConfig?.username || '';
    const password = raw.ciphertext || raw.passwordEncrypted || raw.password || '';
    const passwordEncrypted = raw.passwordEncrypted || raw.ciphertext || (password.startsWith('enc:') ? password : '');
    const databaseNameOrSid =
      raw.databaseNameOrSid || raw.connectionConfig?.databaseName || raw.connectionConfig?.serviceName || '';
    const sslMode = raw.sslMode || raw.connectionConfig?.sslMode || 'require';
    const connectionConfig = raw.connectionConfig || {};
    const groupIds = Array.isArray(raw.groupIds) ? raw.groupIds : [];
    const isEnabled = raw.isEnabled !== false;
    const status = raw.status || 'UP';

    return {
      id: raw.id,
      name,
      databaseSystem,
      dbType,
      host,
      port,
      pollId: raw.pollId,
      tags,
      pollIntervalMinutes,
      note,
      username,
      password,
      passwordEncrypted,
      databaseNameOrSid,
      sslMode,
      connectionConfig,
      groupIds,
      isEnabled,
      status,
    };
  };

  const parseJsonContent = (content: string) => {
    setImportFileError(null);
    setImportPreview(null);

    try {
      const parsed = JSON.parse(content);
      if (!parsed) throw new Error('Empty or invalid JSON payload');

      // Case 1: Database Bundle
      if (parsed.type === 'MONITORING_DATABASE_BUNDLE' && Array.isArray(parsed.databases)) {
        const dbs = parsed.databases.map(parseDatabaseItem);
        if (dbs.length === 0) throw new Error('Bundle contains no database entries.');
        setImportPreview({ type: 'BUNDLE', databases: dbs });
        return;
      }

      // Case 2: Array of databases
      if (Array.isArray(parsed)) {
        const dbs = parsed.map(parseDatabaseItem);
        if (dbs.length === 0) throw new Error('Array contains no database entries.');
        setImportPreview({ type: 'BUNDLE', databases: dbs });
        return;
      }

      // Case 3: Single Database object
      const dbObj = parsed.database || parsed;
      if (!dbObj.name && !dbObj.host) {
        throw new Error('JSON is missing required database identifier (name or host).');
      }
      const singleDb = parseDatabaseItem(dbObj);
      setImportPreview({
        type: 'SINGLE',
        databases: [singleDb],
      });
    } catch (err: any) {
      setImportFileError(err.message || 'Failed to parse JSON file');
      setImportPreview(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      parseJsonContent(content);
    };
    reader.onerror = () => {
      setImportFileError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!importPreview || importPreview.databases.length === 0) return;

    setIsImporting(true);
    try {
      let count = 0;
      for (const item of importPreview.databases) {
        const dbId = importGenerateNewIds
          ? `db-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`
          : item.id || `db-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`;

        const mergedGroups = Array.from(new Set([...(item.groupIds || []), ...importAssignGroupIds]));

        const payload: Partial<DatabaseEntity> = {
          id: dbId,
          name: item.name.trim(),
          databaseSystem: item.databaseSystem?.trim() || '',
          dbType: item.dbType,
          host: item.host.trim(),
          port: Number(item.port),
          tags: item.tags,
          pollIntervalMinutes: Number(item.pollIntervalMinutes) || 5,
          note: item.note,
          username: item.username,
          password: item.password, // Password format used directly as saved in DB (AES ciphertext or plain text)
          passwordEncrypted: item.passwordEncrypted || (item.password?.startsWith('enc:') ? item.password : undefined),
          isEnabled: item.isEnabled !== false,
          status: item.status || 'UP',
          connectionConfig: {
            username: item.username,
            ...(item.dbType === 'ORACLE'
              ? { serviceName: item.databaseNameOrSid }
              : { databaseName: item.databaseNameOrSid }),
            sslMode: item.sslMode || 'require',
            ...(item.connectionConfig || {}),
          },
          groupIds: mergedGroups,
        };

        await onSaveDatabase(payload);
        count++;
      }

      toast({
        title: t('databases.dbsImported'),
        description: t('databases.dbsImportedDesc', { count }),
        type: 'success',
      });

      setIsImportModalOpen(false);
      setImportJsonText('');
      setImportPreview(null);
      setImportFileError(null);
      setImportAssignGroupIds([]);
      onRefresh?.();
    } catch (err: any) {
      toast({
        title: t('databases.importError'),
        description: err.message || 'An error occurred during database import.',
        type: 'error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const openCreateDialog = () => {
    setEditingDb(null);
    setShowPassword(false);
    setCustomTagInput('');
    const defaultEng = availableEngines[0] || DB_ENGINES[0];
    setFormData({
      name: '',
      databaseSystem: '',
      dbType: (defaultEng?.code || 'ORACLE') as DbEngine,
      host: '',
      port: defaultEng?.defaultPort || 1521,
      tags: ['PRODUCTION'],
      pollIntervalMinutes: 10,
      note: '',
      username: 'dbadm',
      password: '',
      databaseNameOrSid: '',
      sslMode: 'no',
      groupIds: groups.length > 0 ? [groups[0].id] : [],
      isEnabled: true,
      status: 'UP' as 'UP' | 'DOWN' | 'WARNING',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = useCallback((db: DatabaseEntity) => {
    setEditingDb(db);
    setShowPassword(false);
    setCustomTagInput('');
    setFormData({
      id: db.id,
      name: db.name,
      databaseSystem: db.databaseSystem || '',
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
  }, []);

  const handleToggleEnable = useCallback((db: DatabaseEntity) => {
    if (userRole !== 'ADMIN') {
      toast({
        title: t('databases.permissionDenied'),
        description: t('databases.adminOnlyToggle'),
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
      title: nextState ? t('databases.monitoringEnabled') : t('databases.monitoringPaused'),
      description: t('databases.monitoringToastDesc', { name: db.name, state: nextState ? 'ACTIVE' : 'PAUSED' }),
      type: 'info',
    });
  }, [userRole, toast, t, onSaveDatabase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.port) {
      toast({ title: t('databases.validationError'), description: t('databases.fillRequiredFields'), type: 'error' });
      return;
    }

    const payload: Partial<DatabaseEntity> = {
      id: formData.id,
      name: formData.name.trim(),
      databaseSystem: formData.databaseSystem.trim(),
      dbType: formData.dbType,
      host: formData.host.trim(),
      port: Number(formData.port),
      tags: formData.tags,
      pollIntervalMinutes: Number(formData.pollIntervalMinutes) || 5,
      note: formData.note.trim(),
      username: formData.username.trim(),
      password: formData.password,
      isEnabled: formData.isEnabled,
      status: editingDb?.status || formData.status || 'UP',
      lastCheckAt: editingDb?.lastCheckAt || new Date().toISOString(),
      connectionConfig: {
        username: formData.username.trim(),
        ...(formData.dbType === 'ORACLE'
          ? { serviceName: formData.databaseNameOrSid.trim() }
          : { databaseName: formData.databaseNameOrSid.trim() }),
        sslMode: formData.sslMode,
      },
      groupIds: editingDb?.groupIds || formData.groupIds || [],
      metricIds: editingDb?.metricIds || [],
    };

    onSaveDatabase(payload);
    setIsDialogOpen(false);
    toast({
      title: formData.id ? t('databases.metadataUpdated') : t('databases.databaseRegistered'),
      description: t('databases.saveSuccessDesc', { name: formData.name }),
      type: 'success',
    });
  };

  const handleDelete = useCallback((db: DatabaseEntity) => {
    if (confirm(t('databases.deleteConfirm', { name: db.name }))) {
      onDeleteDatabase(db.id);
      toast({
        title: t('databases.databaseRemoved'),
        description: t('databases.databaseRemovedDesc', { name: db.name }),
        type: 'info',
      });
    }
  }, [t, onDeleteDatabase, toast]);

  const handleSortChange = useCallback((field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  }, [sortField]);

  // Filter & Sort Databases (Optimized with O(A) indexing for fast rendering with many databases)
  const processedDatabases = useMemo(() => {
    // 1. Build fast active alert lookup maps by id and lowercase dbName in a single O(A) pass
    const alertsByDbId = new Map<string, { critical: number; high: number; warn: number; down: number; total: number }>();
    const alertsByDbName = new Map<string, { critical: number; high: number; warn: number; down: number; total: number }>();

    for (let i = 0; i < activeAlerts.length; i++) {
      const a = activeAlerts[i];
      const lvl = (a.alertLevel || '').toUpperCase();
      const isCritical = lvl === 'CRITICAL' || lvl === 'FATAL';
      const isHigh = lvl === 'HIGH';
      const isWarn = lvl === 'WARN' || lvl === 'WARNING';
      const isDown = lvl === 'DOWN';

      const idKey = String(a.dbId || (a as any).databaseId || '');
      if (idKey) {
        let stats = alertsByDbId.get(idKey);
        if (!stats) {
          stats = { critical: 0, high: 0, warn: 0, down: 0, total: 0 };
          alertsByDbId.set(idKey, stats);
        }
        stats.total++;
        if (isCritical) stats.critical++;
        else if (isHigh) stats.high++;
        else if (isWarn) stats.warn++;
        else if (isDown) stats.down++;
      }

      if (a.dbName) {
        const nameKey = a.dbName.trim().toLowerCase();
        let stats = alertsByDbName.get(nameKey);
        if (!stats) {
          stats = { critical: 0, high: 0, warn: 0, down: 0, total: 0 };
          alertsByDbName.set(nameKey, stats);
        }
        stats.total++;
        if (isCritical) stats.critical++;
        else if (isHigh) stats.high++;
        else if (isWarn) stats.warn++;
        else if (isDown) stats.down++;
      }
    }

    const trimmedSearch = searchTerm.trim().toLowerCase();
    const hasSearch = Boolean(trimmedSearch);
    const hasEngineFilter = selectedEngine !== 'ALL';
    const selectedEngineUpper = selectedEngine.toUpperCase();
    const hasSystemFilter = selectedSystem !== 'ALL';
    const hasStatusFilter = selectedStatus !== 'ALL';
    const hasSeverityFilter = selectedSeverity !== 'ALL';

    const result = [];

    for (let i = 0; i < databases.length; i++) {
      const db = databases[i];

      // Fast O(1) alert lookup
      const alertStats =
        alertsByDbId.get(String(db.id)) ||
        alertsByDbName.get(db.name ? db.name.trim().toLowerCase() : '') ||
        { critical: 0, high: 0, warn: 0, down: 0, total: 0 };

      const criticalCount = alertStats.critical;
      const highCount = alertStats.high;
      const warnCount = alertStats.warn;
      const downCount = alertStats.down;
      const totalAlerts = alertStats.total;

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

      // Filter: Search Term
      if (hasSearch) {
        const match =
          (db.name && db.name.toLowerCase().includes(trimmedSearch)) ||
          (db.databaseSystem && db.databaseSystem.toLowerCase().includes(trimmedSearch)) ||
          (db.host && db.host.toLowerCase().includes(trimmedSearch)) ||
          (db.dbType && db.dbType.toLowerCase().includes(trimmedSearch)) ||
          (db.username && db.username.toLowerCase().includes(trimmedSearch)) ||
          (db.note && db.note.toLowerCase().includes(trimmedSearch)) ||
          (db.tags && db.tags.some((t) => t.toLowerCase().includes(trimmedSearch)));
        if (!match) continue;
      }

      // Filter: Database Engine Type
      if (hasEngineFilter) {
        if ((db.dbType || '').toUpperCase() !== selectedEngineUpper) continue;
      }

      // Filter: System (Friendly Service Name)
      if (hasSystemFilter) {
        if ((db.databaseSystem || '').trim() !== selectedSystem) continue;
      }

      // Filter: Status
      if (hasStatusFilter) {
        if (selectedStatus === 'UP' && statusLabel !== 'UP') continue;
        if (selectedStatus === 'DOWN' && statusLabel !== 'DOWN') continue;
        if (selectedStatus === 'PAUSED' && statusLabel !== 'PAUSED') continue;
      }

      // Filter: Alert Severity
      if (hasSeverityFilter) {
        if (selectedSeverity === 'CRITICAL' && criticalCount === 0) continue;
        if (selectedSeverity === 'HIGH' && highCount === 0) continue;
        if (selectedSeverity === 'WARN' && warnCount === 0) continue;
        if (selectedSeverity === 'DOWN' && downCount === 0) continue;
        if (selectedSeverity === 'HAS_ALERTS' && totalAlerts === 0) continue;
        if (selectedSeverity === 'NO_ALERTS' && totalAlerts > 0) continue;
      }

      result.push({
        ...db,
        criticalCount,
        highCount,
        warnCount,
        downCount,
        totalAlerts,
        statusScore,
        statusLabel,
      });
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [databases, activeAlerts, searchTerm, selectedEngine, selectedSystem, selectedStatus, selectedSeverity, sortField, sortOrder]);

  // ----------------------------------------------------
  // EXPORT FILTERED DATABASES TO CSV (FOR STATS)
  // Excludes passwords, splits all tags into separate columns with 'x' / ''
  // ----------------------------------------------------
  const handleExportFilteredCsv = () => {
    if (!processedDatabases || processedDatabases.length === 0) {
      toast({
        title: t('alertHistory.noDataToExport') || 'No Data to Export',
        description: 'No databases match the current search and filter criteria to export.',
        type: 'warning',
      });
      return;
    }

    // Collect all unique tags across all databases in workspace
    const allUniqueTags = Array.from(
      new Set(
        databases.flatMap((db) => db.tags || [])
      )
    )
      .filter((tag): tag is string => Boolean(tag))
      .sort((a, b) => a.localeCompare(b));

    // CSV Cell Escape helper
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    // Base info headers (All info EXCEPT passwords / secrets)
    const baseHeaders = [
      'Database ID',
      'Database Name',
      'System',
      'Engine Type',
      'Host',
      'Port',
      'Database Name / SID',
      'Username',
      'Auth Method',
      'Environment',
      'Status',
      'Is Enabled',
      'Poll ID',
      'Poll Interval (Min)',
      'Assigned Groups',
      'Last Check At',
      'Created At',
      'Updated At',
      'Total Alerts',
      'Down Alerts',
      'Critical Alerts',
      'High Alerts',
      'Warning Alerts',
      'Notes',
    ];

    // Tag column headers (e.g., "Tag: PRODUCTION", "Tag: LAB")
    const tagHeaders = allUniqueTags.map((tag) => `Tag: ${tag}`);

    const fullHeaders = [...baseHeaders, ...tagHeaders];

    // Rows mapping
    const rows = processedDatabases.map((db) => {
      const groupNames = (groups || [])
        .filter((g) => db.groupIds?.includes(g.id))
        .map((g) => g.name)
        .join('; ');

      const dbTags = new Set(db.tags || []);

      const baseValues = [
        escapeCsv(db.id),
        escapeCsv(db.name),
        escapeCsv(db.databaseSystem || ''),
        escapeCsv(db.dbType),
        escapeCsv(db.host),
        escapeCsv(db.port),
        escapeCsv(db.databaseName || ''),
        escapeCsv(db.username || ''),
        escapeCsv(db.authMethod || 'PASSWORD'),
        escapeCsv(db.environment || 'PRODUCTION'),
        escapeCsv(db.statusLabel || db.status || 'UP'),
        escapeCsv(db.isEnabled !== false ? 'Yes' : 'No'),
        escapeCsv(db.pollId ?? 0),
        escapeCsv(db.pollIntervalMinutes ?? 5),
        escapeCsv(groupNames),
        escapeCsv(db.lastCheckAt || ''),
        escapeCsv(db.createdAt || ''),
        escapeCsv(db.updatedAt || ''),
        escapeCsv(db.totalAlerts ?? 0),
        escapeCsv(db.downCount ?? 0),
        escapeCsv(db.criticalCount ?? 0),
        escapeCsv(db.highCount ?? 0),
        escapeCsv(db.warnCount ?? 0),
        escapeCsv(db.note || ''),
      ];

      // Tag columns: 'x' if database has tag, '' if not
      const tagValues = allUniqueTags.map((tag) => escapeCsv(dbTags.has(tag) ? 'x' : ''));

      return [...baseValues, ...tagValues];
    });

    // Add UTF-8 BOM so Excel opens non-ASCII characters cleanly
    const csvContent = '\uFEFF' + [fullHeaders.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `monitored_databases_stats_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: t('alertHistory.exportedTitle') || 'Export Successful',
      description: `Exported ${processedDatabases.length} database(s) to CSV with tag statistics matrix.`,
      type: 'success',
    });
  };

  const totalPages = Math.ceil(processedDatabases.length / pageSize) || 1;
  const paginatedDatabases = processedDatabases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns = useMemo<Column<typeof processedDatabases[0]>[]>(() => [
    {
      header: t('databases.databaseNameAndEndpoint'),
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
            <span className="text-[10px] text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200" title={t('databases.pollIdTitle')}>
              Poll ID: {row.pollId ?? 0}
            </span>
            {row.pollIntervalMinutes && (
              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                {t('databases.freqMins', { min: row.pollIntervalMinutes })}
              </span>
            )}
          </div>
          {row.tags && row.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {row.tags.map((tTag) => (
                <span
                  key={tTag}
                  className="text-[9px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200"
                >
                  {tTag}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      header: t('databases.system'),
      accessorKey: 'databaseSystem',
      width: '150px',
      sortable: true,
      cell: (row) => {
        const sys = row.databaseSystem;
        if (!sys) {
          return <span className="text-xs text-slate-400 italic">-</span>;
        }
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate font-semibold text-slate-800" title={sys}>
              {sys}
            </span>
          </div>
        );
      },
    },
    {
      header: t('databases.engineType'),
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
      header: t('databases.statusAndAlerts'),
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
            <span className={`font-bold ${row.criticalCount > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'}`} title={t('databases.criticalAlertsCount')}>
              {row.criticalCount}
            </span>
            <span className="text-slate-300">/</span>
            <span className={`font-bold ${row.highCount > 0 ? 'text-orange-600 font-extrabold' : 'text-slate-400'}`} title={t('databases.highAlertsCount')}>
              {row.highCount}
            </span>
            <span className="text-slate-300">/</span>
            <span className={`font-bold ${row.warnCount > 0 ? 'text-amber-600 font-extrabold' : 'text-slate-400'}`} title={t('databases.warningAlertsCount')}>
              {row.warnCount}
            </span>
          </div>
        );
      },
    },
    {
      header: t('databases.lastCheck'),
      accessorKey: 'lastCheckAt',
      width: '160px',
      sortable: true,
      cell: (row) => {
        const lastCheck = row.lastCheckAt;
        if (!lastCheck) {
          return <span className="text-xs text-slate-400 italic">{t('common.never')}</span>;
        }
        const dateObj = new Date(lastCheck);
        const formattedDate = dateObj.toLocaleDateString();
        const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Calculate relative time (e.g. "2m ago")
        const diffMs = Date.now() - dateObj.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        let relative = t('common.minsAgo', { count: diffMins });
        if (diffMins < 1) relative = t('common.justNow');
        else if (diffMins >= 60) {
          const diffHours = Math.floor(diffMins / 60);
          relative = t('common.hoursAgo', { count: diffHours });
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
      header: t('databases.enable'),
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
              title={isEnabled ? t('databases.clickToPauseMonitoring') : t('databases.clickToEnableMonitoring')}
            >
              <span className="w-3.5 h-3.5 bg-white rounded-full shadow-xs transform transition-transform" />
            </button>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isEnabled ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isEnabled ? t('databases.statusOn') : t('databases.statusOff')}
            </span>
          </div>
        );
      },
    },
    {
      header: t('databases.actions'),
      align: 'right',
      width: '130px',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {onNavigateToAnalytics && (
            <button
              onClick={() => onNavigateToAnalytics(row.id)}
              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
              title={t('databases.openInAnalytics')}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          )}
          {userRole === 'ADMIN' ? (
            <>
              <button
                onClick={() => handleExportSingleDatabase(row)}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                title={t('databases.exportConfigJson')}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openEditDialog(row)}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                title={t('databases.editConfig')}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(row)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                title={t('databases.deleteConfig')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            !onNavigateToAnalytics && <span className="text-slate-400 text-xs italic">{t('common.readOnly')}</span>
          )}
        </div>
      ),
    },
  ], [t, userRole, handleToggleEnable, handleExportSingleDatabase, openEditDialog, handleDelete, onNavigateToAnalytics]);

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* License Expiry / Invalid Alert Panel */}
      {licenseStatus.checked && (!licenseStatus.isLicensed || licenseStatus.failCount > 0) && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5 md:mt-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <span>{t('databases.licenseExpiredTitle')}</span>
                <span className="px-2 py-0.5 text-xs bg-rose-200/80 text-rose-800 rounded-full font-mono font-bold">
                  {licenseStatus.failCount > 0 ? `${licenseStatus.failCount} Failures` : 'Invalid / Expired'}
                </span>
              </h4>
              <p className="text-xs text-rose-700 leading-relaxed max-w-3xl">
                {t('databases.licenseExpiredDesc', { count: licenseStatus.failCount })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={checkLicenseStatus}
              disabled={licenseStatus.loading}
              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              title={t('databases.licenseRecheck')}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", licenseStatus.loading && "animate-spin")} />
              <span>{licenseStatus.loading ? t('databases.licenseRechecking') : t('databases.licenseRecheck')}</span>
            </button>
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <span>{t('databases.licenseExpiredAction')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Decoupled Architecture Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div>
              <span className="font-bold text-slate-900">{t('databases.guidanceTitle')}</span> {t('databases.guidanceDesc')}
            </div>
            <div className="text-[11px] text-slate-500">
              {t('databases.guidanceSub')}
            </div>
          </div>
        </div>
      )}



      {/* Top Summary Cards Grid */}
      <DatabaseEngineSummaryGrid
        databases={databases}
        databaseEngines={databaseEngines}
        activeAlerts={activeAlerts}
        selectedEngine={selectedEngine}
        selectedStatus={selectedStatus}
        onSelectEngine={(eng) => {
          setSelectedEngine(eng);
          setCurrentPage(1);
        }}
        onSelectStatus={(st) => {
          setSelectedStatus(st);
          setCurrentPage(1);
        }}
      />

      {/* Clean, Friendly & Beautiful Filter & Controls Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-3.5 space-y-3">
        {/* Row 1: Primary Search & Actions Suite */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left: Prominent Search Input with Clear Button */}
          <div className="relative flex-1 min-w-[240px] max-w-lg">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t('databases.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                title={t('databases.clearSearch')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Actions Group (Export CSV, JSON, Import, Refresh, Add DB) */}
          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 text-xs">
            <button
              onClick={handleExportFilteredCsv}
              title="Export filtered database list and tag statistics matrix to CSV"
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100/80 active:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{t('databases.exportCsv')}</span>
            </button>

            {userRole === 'ADMIN' && (
              <>
                <button
                  onClick={handleExportAllDatabases}
                  title="Export all database connection configurations to JSON"
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{t('databases.exportJson')}</span>
                </button>

                <button
                  onClick={() => {
                    setImportJsonText('');
                    setImportFileError(null);
                    setImportPreview(null);
                    setImportAssignGroupIds([]);
                    setIsImportModalOpen(true);
                  }}
                  title="Import database configurations from JSON file or snippet"
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{t('databases.importJson')}</span>
                </button>
              </>
            )}

            <button
              onClick={async () => {
                setIsCheckingHealth(true);
                try {
                  if (onRefresh) await onRefresh();
                  toast({
                    title: t('common.refreshed'),
                    description: 'Successfully refreshed database statuses and active alert counts.',
                    type: 'success',
                  });
                } finally {
                  setIsCheckingHealth(false);
                }
              }}
              disabled={isCheckingHealth}
              title="Refresh database statuses and active alert telemetry"
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100/80 active:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-2xs hover:shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span>{isCheckingHealth ? t('common.loading') : t('common.refresh')}</span>
            </button>

            {userRole === 'ADMIN' ? (
              <button
                onClick={openCreateDialog}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all shadow-xs hover:shadow-sm cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('databases.addDatabase')}</span>
              </button>
            ) : (
              <div className="text-xs text-slate-400 italic flex items-center gap-1 shrink-0 px-2">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('common.readOnly')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Ordered Filters & Active Reset Controls */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-600 font-bold px-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t('common.filter')}:</span>
            </div>

            {/* 1. Engine Filter */}
            <div className="relative flex items-center">
              <DatabaseEngineFilter
                value={selectedEngine}
                onChange={(val) => {
                  setSelectedEngine(val);
                  setCurrentPage(1);
                }}
                databases={databases}
                databaseEngines={databaseEngines}
                allLabel={t('common.allEngines')}
                className={cn(
                  'bg-slate-50/80 border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs transition-colors',
                  selectedEngine !== 'ALL'
                    ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 font-bold ring-1 ring-indigo-300/40'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                )}
              />
            </div>

            {/* 2. System Filter */}
            <div className="relative flex items-center">
              <select
                value={selectedSystem}
                onChange={(e) => {
                  setSelectedSystem(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  'bg-slate-50/80 border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs transition-colors max-w-[170px] truncate',
                  selectedSystem !== 'ALL'
                    ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 font-bold ring-1 ring-indigo-300/40'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                )}
              >
                <option value="ALL">{t('databases.allSystems')}</option>
                {availableSystems.map((sys) => (
                  <option key={sys} value={sys}>
                    {sys}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Status Filter */}
            <div className="relative flex items-center">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  'bg-slate-50/80 border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs transition-colors',
                  selectedStatus !== 'ALL'
                    ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 font-bold ring-1 ring-indigo-300/40'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                )}
              >
                <option value="ALL">{t('common.allStatuses')}</option>
                <option value="UP">{t('databases.upOnly')}</option>
                <option value="DOWN">{t('databases.downOnly')}</option>
                <option value="PAUSED">{t('databases.pausedOnly')}</option>
              </select>
            </div>

            {/* 4. Alert Severity Filter */}
            <div className="relative flex items-center">
              <select
                value={selectedSeverity}
                onChange={(e) => {
                  setSelectedSeverity(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  'bg-slate-50/80 border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs transition-colors',
                  selectedSeverity !== 'ALL'
                    ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 font-bold ring-1 ring-indigo-300/40'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                )}
              >
                <option value="ALL">{t('common.allAlertLevels')}</option>
                <option value="CRITICAL">{t('databases.sevCriticalPresent')}</option>
                <option value="HIGH">{t('databases.sevHighPresent')}</option>
                <option value="WARN">{t('databases.sevWarnPresent')}</option>
                <option value="DOWN">{t('databases.sevDownPresent')}</option>
                <option value="HAS_ALERTS">{t('databases.sevAnyActiveAlert')}</option>
                <option value="NO_ALERTS">{t('databases.sevZeroAlerts')}</option>
              </select>
            </div>

            {/* Active Filter Count & Reset Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                title={t('databases.resetFilters')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3 h-3 text-rose-600" />
                <span>{t('databases.resetFilters')}</span>
                <span className="bg-rose-200 text-rose-800 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {activeFiltersCount}
                </span>
              </button>
            )}
          </div>

          {/* Right: Showing status counter */}
          <div className="text-xs text-slate-500 font-medium px-1 flex items-center gap-1.5">
            {processedDatabases.length !== databases.length ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold text-[11px]">
                {t('databases.filteredOfTotal', { filtered: processedDatabases.length, total: databases.length })}
              </span>
            ) : (
              <span className="text-slate-500 text-[11px] font-medium">
                {databases.length} {databases.length === 1 ? 'database' : 'databases'}
              </span>
            )}
          </div>
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
              ? t('databases.noDatabasesFound')
              : t('common.noDataFound')
          }
        />
      </div>

      {/* Dialog for Create/Edit Configuration */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingDb ? t('databases.editDatabaseTitle', { name: editingDb.name }) : t('databases.registerDatabaseTitle')}
        description={t('databases.dialogDesc')}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('databases.databaseIdentifierLabel')}</label>
              <input
                type="text"
                required
                placeholder={t('databases.databaseIdentifierPlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('databases.systemLabel')}</label>
              <input
                type="text"
                placeholder={t('databases.systemPlaceholder')}
                value={formData.databaseSystem}
                onChange={(e) => setFormData({ ...formData, databaseSystem: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('databases.engineTypeLabel')}</label>
              <select
                value={formData.dbType}
                onChange={(e) => {
                  const dbType = e.target.value as DbEngine;
                  const foundEngine = availableEngines.find((eng) => eng.code.toUpperCase() === dbType.toUpperCase()) || getDbEngineConfig(dbType);
                  const defaultPort = foundEngine ? foundEngine.defaultPort : 1521;
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
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {formData.dbType === 'ORACLE' ? t('databases.serviceNameOrSidLabel') : t('databases.databaseNameLabel')}
              </label>
              <input
                type="text"
                placeholder={formData.dbType === 'ORACLE' ? 'ORCLPDB1.internal' : 'app_production'}
                value={formData.databaseNameOrSid}
                onChange={(e) => setFormData({ ...formData, databaseNameOrSid: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">{t('databases.hostLabel')}</label>
              <input
                type="text"
                required
                placeholder={t('databases.hostPlaceholder')}
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('databases.portLabel')}</label>
              <input
                type="number"
                required
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Database Credentials */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="text-slate-900 font-bold flex items-center gap-1.5 text-xs">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              {t('databases.instanceCredentials')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">{t('databases.usernameLabel')}</label>
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
                <label className="block text-slate-600 font-medium mb-1">{t('databases.passwordLabel')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('databases.passwordPlaceholder')}
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
                {t('databases.tagsLabel')}
              </span>
              <span className="text-[10px] text-slate-500 font-normal">{t('databases.tagsHelp')}</span>
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
                  <span className="text-[11px] text-slate-400 italic">{t('databases.noTagsSelected')}</span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <input
                  type="text"
                  placeholder={t('databases.typeCustomTagPlaceholder')}
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
                  {t('databases.addTag')}
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
                  {t('databases.queryFrequencyLabel')}
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
                  {t('databases.minutesAbbr')}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">{t('databases.queryFrequencyHelp')}</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                {t('databases.operationalNoteLabel')}
              </label>
              <textarea
                rows={2}
                placeholder={t('databases.operationalNotePlaceholder')}
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>
          </div>

          {/* Monitoring Active Toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 block text-xs">{t('databases.enableActiveMonitoring')}</span>
              <span className="text-[10px] text-slate-500">{t('databases.enableActiveMonitoringHelp')}</span>
            </div>
            <div className="flex items-center gap-2">
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
                {formData.isEnabled ? t('databases.enabledOn') : t('databases.disabledOff')}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-2xs cursor-pointer"
            >
              {editingDb ? t('databases.saveChanges') : t('databases.registerDatabase')}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Dialog for JSON Database Import */}
      <Dialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={t('databases.importModalTitle')}
        description={t('databases.importModalDesc')}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Upload Dropzone / Button */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 rounded-xl p-5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800">{t('databases.clickToUploadJson')}</span>
              <span className="text-slate-500 block text-[11px]">{t('databases.uploadJsonDesc')}</span>
            </div>
          </div>

          {/* Or Paste Raw JSON */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-700 font-semibold flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5 text-indigo-600" />
                {t('databases.orPasteJsonLabel')}
              </label>
              {importJsonText && (
                <button
                  type="button"
                  onClick={() => {
                    setImportJsonText('');
                    setImportPreview(null);
                    setImportFileError(null);
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  {t('databases.clear')}
                </button>
              )}
            </div>
            <textarea
              rows={4}
              placeholder={`{\n  "type": "MONITORING_DATABASE_BUNDLE",\n  "databases": [\n    {\n      "name": "Prod Postgres Main",\n      "dbType": "POSTGRES",\n      "host": "10.0.1.5",\n      "port": 5432,\n      "username": "dbmon_reader",\n      "password": "..."\n    }\n  ]\n}`}
              value={importJsonText}
              onChange={(e) => {
                const text = e.target.value;
                setImportJsonText(text);
                if (text.trim()) {
                  parseJsonContent(text);
                } else {
                  setImportPreview(null);
                  setImportFileError(null);
                }
              }}
              className="w-full bg-slate-900 text-slate-100 font-mono text-[11px] border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Error Banner */}
          {importFileError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{importFileError}</span>
            </div>
          )}

          {/* Import Preview Section */}
          {importPreview && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {t('databases.validatedCount', { count: importPreview.databases.length })}
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {importPreview.type}
                </span>
              </div>

              {/* Scrollable list of parsed databases */}
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-200">
                {importPreview.databases.map((db, idx) => {
                  const cfg = getDbEngineConfig(db.dbType);
                  const badgeClass = getDbEngineBadgeClass(db.dbType);
                  return (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeClass}`}
                          >
                            {cfg?.name || db.dbType}
                          </span>
                          <span className="font-bold text-slate-900">{db.name}</span>
                          {db.databaseSystem && (
                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                              {db.databaseSystem}
                            </span>
                          )}
                          {db.id && (
                            <span className="text-[10px] text-slate-400 font-mono">({db.id})</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {db.host}:{db.port} • User: {db.username || '<none>'}
                          {db.password && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 text-[9px] font-sans">
                              <Lock className="w-2.5 h-2.5" /> Password Set
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {db.tags && db.tags.length > 0 && (
                          <div className="flex gap-1">
                            {db.tags.slice(0, 2).map((t, ti) => (
                              <span key={ti} className="text-[9px] font-semibold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Import Options */}
              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">{t('databases.idAssignmentStrategy')}</label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-xs">
                    <input
                      type="checkbox"
                      checked={importGenerateNewIds}
                      onChange={(e) => setImportGenerateNewIds(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>{t('databases.generateFreshIds')}</span>
                  </label>
                  <p className="text-[10px] text-slate-400">{t('databases.uncheckToUpdate')}</p>
                </div>

                {groups.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">{t('databases.attachToGroupsLabel')}</label>
                    <div className="max-h-24 overflow-y-auto space-y-1 bg-white p-2 rounded border border-slate-300">
                      {groups.map((grp) => (
                        <label key={grp.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={importAssignGroupIds.includes(grp.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setImportAssignGroupIds([...importAssignGroupIds, grp.id]);
                              } else {
                                setImportAssignGroupIds(importAssignGroupIds.filter((id) => id !== grp.id));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <FolderKanban className="w-3 h-3 text-indigo-500" />
                          <span className="truncate">{grp.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(false);
                setImportJsonText('');
                setImportPreview(null);
                setImportFileError(null);
                setImportAssignGroupIds([]);
              }}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!importPreview || importPreview.databases.length === 0 || isImporting}
              onClick={handleExecuteImport}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('databases.importing')}</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {t('databases.importDatabasesCount', { count: importPreview ? importPreview.databases.length : '' })}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};


