import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  ShieldCheck,
  Eye,
  Info,
  Lock,
  Zap,
  Clock,
  Server,
  Activity,
  ArrowRight,
  Database,
  Send,
  Plus,
  Edit2,
  Trash2,
  Sliders,
  Check,
  Copy,
  Terminal,
  Layers,
  Code,
  Sparkles,
  Search
} from 'lucide-react';
import {
  SystemSettingsEntity,
  SystemSettingItem,
  UserRole,
  DatabaseEntity,
  DatabaseEngineEntity,
  AlertNotificationMethodEntity,
  AlertMethodType,
  DatabasePollLogEntity
} from '../../types';
import { useToast } from '../ui/Toast';
import { api } from '../../lib/api';
import { Dialog } from '../ui/Dialog';
import { getDbEngineBadgeClass } from '../../config/dbEngines';
import { useTranslation } from '../../i18n';

interface SystemSettingsViewProps {
  settings: SystemSettingsEntity;
  userRole: UserRole;
  databases?: DatabaseEntity[];
  databaseEngines: DatabaseEngineEntity[];
  alertMethods: AlertNotificationMethodEntity[];
  databasePollLogs?: DatabasePollLogEntity[];
  onSaveSettings: (newSettings: SystemSettingsEntity) => void;
  onSaveEngine: (engine: Partial<DatabaseEngineEntity>) => Promise<any>;
  onDeleteEngine: (id: string) => Promise<void>;
  onSaveAlertMethod: (method: Partial<AlertNotificationMethodEntity>) => Promise<any>;
  onDeleteAlertMethod: (id: string) => Promise<void>;
  onResetAllData: () => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

interface HealthCheckResult {
  targetUrl: string;
  statusCode: number;
  statusText: string;
  isHealthy: boolean;
  responseTimeMs: number;
  timestamp: string;
  responseData?: any;
  message: string;
  error?: string;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  settings,
  userRole,
  databases = [],
  databaseEngines,
  alertMethods,
  databasePollLogs = [],
  onSaveSettings,
  onSaveEngine,
  onDeleteEngine,
  onSaveAlertMethod,
  onDeleteAlertMethod,
  onResetAllData,
  onRefreshData,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isAdmin = userRole === 'ADMIN';

  // Danger Zone - Clean All Monitor Data state
  const [cleanMonitorDays, setCleanMonitorDays] = useState<number>(0);
  const [cleanMonitorDbId, setCleanMonitorDbId] = useState<string>('ALL');
  const [isCleanMonitorConfirmOpen, setIsCleanMonitorConfirmOpen] = useState(false);
  const [isCleaningMonitor, setIsCleaningMonitor] = useState(false);

  // Danger Zone - Clean Raw Query History state
  const [cleanRawDays, setCleanRawDays] = useState<number>(0);
  const [cleanRawDbId, setCleanRawDbId] = useState<string>('ALL');
  const [isCleanRawConfirmOpen, setIsCleanRawConfirmOpen] = useState(false);
  const [isCleaningRaw, setIsCleaningRaw] = useState(false);

  const handleCleanAllMonitorData = async () => {
    setIsCleaningMonitor(true);
    try {
      const res = await api.cleanAllMonitorData({
        daysToKeep: Number(cleanMonitorDays) || 0,
        dbId: cleanMonitorDbId,
      });
      toast({
        title: 'Monitor Data Cleaned',
        description: `Purged ${res.activeAlertsDeleted} active alert(s), ${res.alertHistoryDeleted} alert history record(s), ${res.metricDataPointsDeleted} metric telemetry point(s), and ${res.notificationLogsDeleted} notification log(s) older than ${cleanMonitorDays} day(s).`,
        type: 'success',
      });
      setIsCleanMonitorConfirmOpen(false);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      toast({
        title: 'Cleanup Failed',
        description: err.message || 'Failed to clean monitor data.',
        type: 'error',
      });
    } finally {
      setIsCleaningMonitor(false);
    }
  };

  const handleCleanRawQueryHistory = async () => {
    setIsCleaningRaw(true);
    try {
      const res = await api.cleanRawQueryHistory({
        daysToKeep: Number(cleanRawDays) || 0,
        dbId: cleanRawDbId,
      });
      toast({
        title: 'Raw Query History Cleaned',
        description: `Purged ${res.metricDataPointsDeleted} raw query metric history record(s) older than ${cleanRawDays} day(s) (alert history retained).`,
        type: 'success',
      });
      setIsCleanRawConfirmOpen(false);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      toast({
        title: 'Cleanup Failed',
        description: err.message || 'Failed to clean raw query history.',
        type: 'error',
      });
    } finally {
      setIsCleaningRaw(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'collector' | 'engines' | 'kv-settings'>('collector');

  // Key-Value Settings State
  const [settingItems, setSettingItems] = useState<SystemSettingItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [isKvModalOpen, setIsKvModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<SystemSettingItem | null>(null);
  const [kvForm, setKvForm] = useState({ id: '', name: '', value: '' });

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(
    settings.sessionTimeoutMinutes || Number(settings.SESSION_TIMEOUT_MINUTES) || 30
  );

  const loadSettingItems = async () => {
    setIsLoadingItems(true);
    try {
      const items = await api.getSystemSettingsList();
      setSettingItems(items);
    } catch (err: any) {
      console.error('Failed to fetch setting items:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'kv-settings') {
      loadSettingItems();
    }
  }, [activeTab]);

  useEffect(() => {
    if (settings.sessionTimeoutMinutes || settings.SESSION_TIMEOUT_MINUTES) {
      setSessionTimeoutMinutes(
        settings.sessionTimeoutMinutes || Number(settings.SESSION_TIMEOUT_MINUTES) || 30
      );
    }
  }, [settings.sessionTimeoutMinutes, settings.SESSION_TIMEOUT_MINUTES]);

  const handleOpenAddKv = () => {
    setEditingItem(null);
    setKvForm({ id: '', name: '', value: '' });
    setIsKvModalOpen(true);
  };

  const handleOpenEditKv = (item: SystemSettingItem) => {
    setEditingItem(item);
    setKvForm({ id: item.id, name: item.name, value: item.value });
    setIsKvModalOpen(true);
  };

  const handleSaveKvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kvForm.name.trim()) {
      toast({ title: 'Validation Error', description: 'Setting Name is required.', type: 'error' });
      return;
    }

    try {
      const saved = await api.saveSystemSettingItem({
        id: kvForm.id || undefined,
        name: kvForm.name.trim(),
        value: kvForm.value,
        updatedBy: 'admin',
      });
      setIsKvModalOpen(false);
      toast({
        title: editingItem ? 'Setting Updated' : 'Setting Created',
        description: `Setting "${saved.name}" saved successfully.`,
        type: 'success',
      });
      loadSettingItems();

      const nextSettings: SystemSettingsEntity = {
        ...settings,
        [saved.name]: saved.value,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin',
      };
      if (saved.name === 'SESSION_TIMEOUT_MINUTES') {
        const timeoutNum = parseInt(saved.value, 10) || 30;
        nextSettings.sessionTimeoutMinutes = timeoutNum;
        nextSettings.SESSION_TIMEOUT_MINUTES = saved.value;
        setSessionTimeoutMinutes(timeoutNum);
      }
      onSaveSettings(nextSettings);
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message || 'Failed to save setting item.', type: 'error' });
    }
  };

  const handleDeleteKv = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete setting "${name}"?`)) return;
    try {
      await api.deleteSystemSettingItem(id);
      toast({ title: 'Setting Deleted', description: `Deleted setting "${name}".`, type: 'info' });
      loadSettingItems();
      if (name === 'SESSION_TIMEOUT_MINUTES' || name === 'sessionTimeoutMinutes') {
        const nextSettings: SystemSettingsEntity = {
          ...settings,
          sessionTimeoutMinutes: 30,
          SESSION_TIMEOUT_MINUTES: '30',
          updatedAt: new Date().toISOString(),
          updatedBy: 'admin',
        };
        setSessionTimeoutMinutes(30);
        onSaveSettings(nextSettings);
      }
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err.message, type: 'error' });
    }
  };

  // Database Poll Logs State & Fetching for 30-min check
  const [pollLogs, setPollLogs] = useState<DatabasePollLogEntity[]>(databasePollLogs || []);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState<boolean>(false);
  const [showInfoTips, setShowInfoTips] = useState<boolean>(settings.showInfoTips !== false);
  const [timestampFormat, setTimestampFormat] = useState<string>(settings.timestampFormat || 'HH24:MI:SS DD/MM/YYYY');

  // Reset All Data State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetDataSubmit = async () => {
    setIsResetting(true);
    try {
      await onResetAllData();
      setIsResetConfirmOpen(false);
    } catch (err: any) {
      toast({ title: 'Reset Failed', description: err.message, type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  // Engine Modal State
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false);
  const [editingEngine, setEditingEngine] = useState<DatabaseEngineEntity | null>(null);
  const [engineForm, setEngineForm] = useState({
    id: '',
    dbCode: '',
    dbName: '',
    dbColor: '#2563EB',
    defaultPort: 5432,
    statusOnOff: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    description: '',
  });

  // Sync state when settings or databasePollLogs props update
  useEffect(() => {
    if (settings.showInfoTips !== undefined) {
      setShowInfoTips(settings.showInfoTips !== false);
    }
    if (settings.timestampFormat) {
      setTimestampFormat(settings.timestampFormat);
    }
  }, [settings.showInfoTips, settings.timestampFormat]);

  useEffect(() => {
    if (databasePollLogs) {
      setPollLogs(databasePollLogs);
    }
  }, [databasePollLogs]);

  // Refresh database_poll_log records
  const handleRefreshCollectorStatus = async () => {
    setIsRefreshingStatus(true);
    try {
      if (onRefreshData) {
        await onRefreshData();
      }
      const logs = await api.getDatabasePollLogs('ALL', undefined, undefined, 100);
      setPollLogs(logs);
      toast({
        title: 'Status Refreshed',
        description: 'Latest database_poll_log telemetry records loaded.',
        type: 'info',
      });
    } catch (err: any) {
      toast({
        title: 'Refresh Failed',
        description: err.message || 'Failed to fetch database_poll_log records',
        type: 'error',
      });
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  // 30-minute status evaluation rule based on database_poll_log.started_at
  const now = Date.now();
  const thirtyMinutesMs = 30 * 60 * 1000;

  const sortedPollLogs = useMemo(() => {
    return [...(pollLogs || [])]
      .filter((log) => Boolean(log.startedAt))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [pollLogs]);

  const latestPollLog = sortedPollLogs[0] || null;
  const latestTimestampMs = latestPollLog ? new Date(latestPollLog.startedAt).getTime() : 0;
  const timeDiffMs = latestTimestampMs > 0 ? now - latestTimestampMs : Infinity;
  const isCollectorOn = latestTimestampMs > 0 && timeDiffMs >= 0 && timeDiffMs <= thirtyMinutesMs;

  const pollsInLast30Min = useMemo(() => {
    const n = Date.now();
    return sortedPollLogs.filter((l) => {
      const t = new Date(l.startedAt).getTime();
      return n - t >= 0 && n - t <= thirtyMinutesMs;
    }).length;
  }, [sortedPollLogs]);

  const timeElapsedText = useMemo(() => {
    if (!latestTimestampMs || latestTimestampMs === 0) return 'No sweeps recorded';
    if (timeDiffMs < 0) return 'Just now';
    const mins = Math.floor(timeDiffMs / 60000);
    if (mins < 1) return 'Just now (< 1 min ago)';
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m ago`;
  }, [latestTimestampMs, timeDiffMs]);

  // Toggle Info Tips
  const handleToggleInfoTips = () => {
    if (!isAdmin) {
      toast({
        title: 'Permission Denied',
        description: 'Only users with the ADMIN role can modify system settings.',
        type: 'error',
      });
      return;
    }

    const nextVal = !showInfoTips;
    setShowInfoTips(nextVal);

    const updatedSettings: SystemSettingsEntity = {
      ...settings,
      showInfoTips: nextVal,
      timestampFormat: timestampFormat,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };

    onSaveSettings(updatedSettings);
    toast({
      title: 'Guidance Preference Updated',
      description: `Info & Guidance boxes are now ${nextVal ? 'VISIBLE' : 'HIDDEN'} system-wide.`,
      type: 'info',
    });
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast({
        title: 'Permission Denied',
        description: 'Only users with the ADMIN role can modify system settings.',
        type: 'error',
      });
      return;
    }

    const updatedSettings: SystemSettingsEntity = {
      ...settings,
      showInfoTips: showInfoTips,
      timestampFormat: timestampFormat,
      sessionTimeoutMinutes: Number(sessionTimeoutMinutes) || 30,
      SESSION_TIMEOUT_MINUTES: String(Number(sessionTimeoutMinutes) || 30),
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };

    onSaveSettings(updatedSettings);
    toast({
      title: 'Preferences Saved',
      description: 'System-wide preferences and timestamp format saved successfully.',
      type: 'success',
    });
  };

  // --- Database Engine Handlers ---
  const handleOpenAddEngine = () => {
    setEditingEngine(null);
    setEngineForm({
      id: '',
      dbCode: '',
      dbName: '',
      dbColor: '#2563EB',
      defaultPort: 5432,
      statusOnOff: 'ACTIVE',
      description: '',
    });
    setIsEngineModalOpen(true);
  };

  const handleOpenEditEngine = (engine: DatabaseEngineEntity) => {
    setEditingEngine(engine);
    setEngineForm({
      id: engine.id,
      dbCode: engine.dbCode,
      dbName: engine.dbName,
      dbColor: engine.dbColor || '#2563EB',
      defaultPort: engine.defaultPort || 5432,
      statusOnOff: engine.statusOnOff || 'ACTIVE',
      description: engine.description || '',
    });
    setIsEngineModalOpen(true);
  };

  const handleSaveEngineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engineForm.dbCode.trim() || !engineForm.dbName.trim()) {
      toast({ title: 'Validation Error', description: 'Engine Code and Name are required.', type: 'error' });
      return;
    }
    try {
      await onSaveEngine({
        id: engineForm.id || undefined,
        dbCode: engineForm.dbCode.trim().toUpperCase(),
        dbName: engineForm.dbName.trim(),
        dbColor: engineForm.dbColor,
        defaultPort: Number(engineForm.defaultPort) || 5432,
        statusOnOff: engineForm.statusOnOff,
        description: engineForm.description.trim() || undefined,
      });
      setIsEngineModalOpen(false);
      toast({
        title: editingEngine ? 'Engine Updated' : 'Engine Registered',
        description: `Database engine "${engineForm.dbName}" (${engineForm.dbCode.toUpperCase()}) saved.`,
        type: 'success',
      });
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message, type: 'error' });
    }
  };

  const handleToggleEngineStatus = async (engine: DatabaseEngineEntity) => {
    const nextStatus = engine.statusOnOff === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await onSaveEngine({ ...engine, statusOnOff: nextStatus });
    toast({
      title: 'Status Updated',
      description: `Engine "${engine.dbName}" is now ${nextStatus}.`,
      type: 'info',
    });
  };

  if (!isAdmin) {
    return (
      <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3 text-xs text-slate-600">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-slate-900 text-sm">{t('systemSettings.title')}</div>
              <div>{t('systemSettings.subtitle')}</div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-500" />
              VIEWER (Restricted)
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 shadow-2xs max-w-2xl mx-auto my-8">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{t('systemSettings.accessRestrictedTitle')}</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            {t('systemSettings.accessRestrictedSub')}
          </p>
          <div className="pt-2 text-xs text-slate-600">
            {t('systemSettings.visitAccountSettings')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Header Banner */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3 text-xs text-slate-600">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">{t('systemSettings.title')}</div>
            <div>
              {t('systemSettings.subtitle')}
            </div>
            {settings.updatedAt && (
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Last modified: {new Date(settings.updatedAt).toLocaleString()} by <span className="font-bold text-indigo-600">{settings.updatedBy || 'admin'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Role Status Badge */}
        <div className="shrink-0 flex items-center gap-2">
          {isAdmin ? (
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              ADMIN (Full Access)
            </span>
          ) : (
            <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-500" />
              VIEWER (Read-Only)
            </span>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('collector')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'collector'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{t('systemSettings.tabCollector')}</span>
        </button>

        <button
          onClick={() => setActiveTab('engines')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'engines'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{t('systemSettings.tabEngines')}</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-100 text-indigo-800 font-mono">
            {databaseEngines.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('kv-settings')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'kv-settings'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{t('systemSettings.tabKvSettings')}</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-100 text-indigo-800 font-mono">
            {settingItems.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Collector Daemon Status & UI Preferences */}
      {activeTab === 'collector' && (
        <div className="space-y-6">
          {/* Card 1: Background Collector Daemon Status (database_poll_log.started_at) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {t('systemSettings.collectorStatusTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('systemSettings.collectorRuleDesc')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshCollectorStatus}
                  disabled={isRefreshingStatus}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-2xs"
                  title="Reload latest database_poll_log telemetry records"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStatus ? 'animate-spin text-indigo-600' : 'text-slate-600'}`} />
                  <span>{t('systemSettings.refreshCollectorStatus')}</span>
                </button>

                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 border shadow-2xs ${
                    isCollectorOn
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isCollectorOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>{isCollectorOn ? t('systemSettings.collectorStateOn') : t('systemSettings.collectorStateOff')}</span>
                </div>
              </div>
            </div>

            {/* Status Visual Banner */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3.5 text-xs transition-colors ${
                isCollectorOn
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              {isCollectorOn ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <div className="font-bold flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    {isCollectorOn
                      ? 'Collector Worker is ON (Operational)'
                      : 'Collector Worker is OFF (Inactive / No Recent Sweeps)'}
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                    Evaluation Window: 30 Minutes
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed">
                  {isCollectorOn
                    ? 'Active telemetry sweeps detected. Polling sweep logs were recorded in database_poll_log within the last 30 minutes.'
                    : 'No polling sweeps recorded within the last 30 minutes in database_poll_log. The collector background worker is currently offline or idle.'}
                </p>
              </div>
            </div>

            {/* Metric Tiles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Tile 1: Status */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Collector State
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isCollectorOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {isCollectorOn ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {isCollectorOn ? 'Active within 30m' : 'No sweep in >30m'}
                </div>
              </div>

              {/* Tile 2: Latest Started At */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('systemSettings.latestStartedAt')}
                </div>
                <div className="text-xs font-bold text-slate-900 font-mono truncate" title={latestPollLog?.startedAt || 'N/A'}>
                  {latestPollLog?.startedAt
                    ? new Date(latestPollLog.startedAt).toLocaleString()
                    : 'No sweeps recorded'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  {latestPollLog?.dbName ? `DB: ${latestPollLog.dbName}` : 'database_poll_log'}
                </div>
              </div>

              {/* Tile 3: Elapsed Time */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('systemSettings.timeElapsed')}
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {timeElapsedText}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {isCollectorOn ? 'Within 30m threshold' : 'Exceeds 30m window'}
                </div>
              </div>

              {/* Tile 4: Polls in 30 Min */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('systemSettings.pollsInLast30Min')}
                </div>
                <div className="text-base font-extrabold text-indigo-600 font-mono">
                  {pollsInLast30Min} sweep{pollsInLast30Min !== 1 ? 's' : ''}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  Total poll logs: {pollLogs.length}
                </div>
              </div>
            </div>

            {/* Diagnostic Details of Latest Sweep */}
            {latestPollLog && (
              <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 text-[11px] flex items-center justify-between">
                  <span>Latest Probe Sweep Record (database_poll_log)</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    latestPollLog.status === 'success'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {latestPollLog.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-600">
                  <div>
                    <span className="text-slate-400 font-sans">Database:</span> {latestPollLog.dbName} ({latestPollLog.dbId})
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans">Started At:</span> {new Date(latestPollLog.startedAt).toLocaleTimeString()}
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans">Finished At:</span> {latestPollLog.finishedAt ? new Date(latestPollLog.finishedAt).toLocaleTimeString() : 'In-progress'}
                  </div>
                </div>
                {latestPollLog.errorMessage && (
                  <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                    <span className="font-bold">Error: </span>
                    {latestPollLog.errorMessage}
                  </div>
                )}
              </div>
            )}

            <div className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
              * The collector daemon health is evaluated strictly from table <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono font-semibold">database_poll_log</code> column <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono font-semibold">started_at</code>. If any poll sweep was started within the last 30 minutes, the status is <strong className="text-emerald-700">ON</strong>; if no new data exists in 30 minutes, the status is <strong className="text-slate-700">OFF</strong>.
            </div>
          </div>

          {/* Card 2: Application Preferences Form */}
          <form onSubmit={handleSavePreferences} className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5 font-bold text-slate-900 text-base">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>Interface & Global Preferences</span>
              </div>

              {isAdmin ? (
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('systemSettings.savePreferences')}</span>
                </button>
              ) : (
                <div className="text-xs text-slate-500 italic flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Read-Only</span>
                </div>
              )}
            </div>

            {/* Interface Preferences Card */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>{t('systemSettings.infoTipsTitle')}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {t('systemSettings.infoTipsDesc')}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={handleToggleInfoTips}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    showInfoTips ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                  } ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" />
                </button>
                <span className={`text-xs font-bold font-mono ${showInfoTips ? 'text-indigo-700' : 'text-slate-500'}`}>
                  {showInfoTips ? 'VISIBLE (ON)' : 'HIDDEN (OFF)'}
                </span>
              </div>
            </div>

            {/* Global Timestamp Format Card */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>{t('systemSettings.timestampFormatTitle')}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Select system-wide default datetime display format strictly (e.g. HH24:MI:SS DD/MM/YYYY).
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  disabled={!isAdmin}
                  value={timestampFormat}
                  onChange={(e) => setTimestampFormat(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60 shadow-2xs cursor-pointer"
                >
                  <option value="HH24:MI:SS DD/MM/YYYY">HH24:MI:SS DD/MM/YYYY (14:30:15 22/08/2026)</option>
                  <option value="DD/MM/YYYY HH24:MI:SS">DD/MM/YYYY HH24:MI:SS (22/08/2026 14:30:15)</option>
                  <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss (2026-08-22 14:30:15)</option>
                </select>
              </div>
            </div>
          </form>

        {/* Danger Zone Section */}
        <div id="danger-zone-settings" className="bg-red-50/40 border border-red-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <div className="font-bold text-red-900 text-base">Danger Zone</div>
              <p className="text-[11px] text-red-700">Data retention & maintenance cleanup actions</p>
            </div>
          </div>

          

          {/* Option 2: Clean Raw Query History */}
          <div className="p-4 bg-white border border-red-200 rounded-xl shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-600" />
                  <span>Clean Raw Query History</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Deletes monitor data history older than the specified days to keep. Alert history and alert notification logs are retained intact. (Example: 0 deletes all monitor measurement history, 1 deletes older than today).
                </p>
              </div>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setIsCleanRawConfirmOpen(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  Clean Raw Query History
                </button>
              ) : (
                <div className="text-xs text-slate-500 italic flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Only</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Days to Keep Data (default = 0):
                </label>
                <input
                  type="number"
                  min={0}
                  value={cleanRawDays}
                  onChange={(e) => setCleanRawDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Target Database (default = ALL):
                </label>
                <select
                  value={cleanRawDbId}
                  onChange={(e) => setCleanRawDbId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">ALL Databases (Default)</option>
                  {databases.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.name} ({db.host}:{db.port})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Option 1: Clean All Monitor Data */}
          <div className="p-4 bg-white border border-red-200 rounded-xl shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Clean All Monitor Data</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Deletes history alerts, active alerts, monitor data history, and alert notification logs older than the specified days to keep. (Example: 0 deletes all data, 1 deletes data older than today).
                </p>
              </div>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setIsCleanMonitorConfirmOpen(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  Clean All Monitor Data
                </button>
              ) : (
                <div className="text-xs text-slate-500 italic flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Only</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Days to Keep Data (default = 0):
                </label>
                <input
                  type="number"
                  min={0}
                  value={cleanMonitorDays}
                  onChange={(e) => setCleanMonitorDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Target Database (default = ALL):
                </label>
                <select
                  value={cleanMonitorDbId}
                  onChange={(e) => setCleanMonitorDbId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="ALL">ALL Databases (Default)</option>
                  {databases.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.name} ({db.host}:{db.port})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Option 3: Reset All System Data */}
          <div className="p-4 bg-white border border-red-200 rounded-xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>Reset All System Data</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed max-w-2xl">
                Destructive operation! Deletes all tables and records related to database servers, logical database groups, health monitoring templates, metric threshold configurations, active alert logs, notification dispatch history, and time-series telemetry metrics. Preserves global settings, database engines registry, protocol dispatcher configurations, and audit trail logs.
              </p>
            </div>

            {isAdmin ? (
              <button
                id="btn-reset-all-data"
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                Reset All Data
              </button>
            ) : (
              <div className="text-xs text-slate-500 italic flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Admin Only</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* TAB 2: Database Engines Registry */}
      {activeTab === 'engines' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600" />
                  <span>Database-Driven Engine Registry</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage dynamically supported database engines stored in the MySQL central table (code, name, brand color, default port, status).
                </p>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenAddEngine}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Database Engine</span>
                </button>
              )}
            </div>

            {/* Engines Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Engine Code</th>
                    <th className="py-3 px-4">Display Name</th>
                    <th className="py-3 px-4">Brand Color</th>
                    <th className="py-3 px-4">Default Port</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {databaseEngines.map((engine) => (
                    <tr key={engine.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {engine.dbCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {engine.dbName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: engine.dbColor || '#2563EB' }}
                          />
                          <span className="font-mono text-[11px] text-slate-600">
                            {engine.dbColor || '#2563EB'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {engine.defaultPort}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggleEngineStatus(engine)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                            engine.statusOnOff === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              engine.statusOnOff === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {engine.statusOnOff || 'ACTIVE'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate text-[11px]">
                        {engine.description || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditEngine(engine)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                              title="Edit Engine"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete engine "${engine.dbName}"?`)) {
                                  await onDeleteEngine(engine.id);
                                  toast({ title: 'Engine Deleted', description: `Engine ${engine.dbName} removed.`, type: 'info' });
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Delete Engine"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Key-Value System Settings Panel */}
      {activeTab === 'kv-settings' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-base">System Configuration Parameters (Key-Value Store)</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Manage runtime setting key-value pairs (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">id, name, value, updatedAt, updatedBy</code>).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSettingItems}
                  disabled={isLoadingItems}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingItems ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>Refresh</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenAddKv}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Setting Parameter</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Filter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter settings by key name or value..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 font-mono">ID</th>
                    <th className="py-3 px-4">Setting Key (Name)</th>
                    <th className="py-3 px-4">Setting Value</th>
                    <th className="py-3 px-4">Updated At</th>
                    <th className="py-3 px-4">Updated By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {settingItems
                    .filter(
                      (item) =>
                        item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
                        item.value.toLowerCase().includes(itemSearchQuery.toLowerCase())
                    )
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{item.id}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {item.name === 'SESSION_TIMEOUT_MINUTES' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Clock className="w-3 h-3 text-indigo-600" />
                              {item.name}
                            </span>
                          ) : (
                            item.name
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 max-w-xs truncate">
                          {item.value}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{item.updatedBy || 'admin'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditKv(item)}
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                  title="Edit Parameter"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKv(item.id, item.name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title="Delete Parameter"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {settingItems.length === 0 && !isLoadingItems && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs italic">
                        No system settings items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Engine Modal */}
      <Dialog
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        title={editingEngine ? 'Edit Database Engine' : 'Register Database Engine'}
        description="Configure dynamic database engine identifier, hex brand color, default network port, and status."
        maxWidth="xl"
      >
        <form onSubmit={handleSaveEngineSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Engine Code (Unique) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ORACLE, POSTGRES, CLICKHOUSE"
                value={engineForm.dbCode}
                onChange={(e) => setEngineForm({ ...engineForm, dbCode: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Display Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Oracle Database"
                value={engineForm.dbName}
                onChange={(e) => setEngineForm({ ...engineForm, dbName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Brand Hex Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={engineForm.dbColor}
                  onChange={(e) => setEngineForm({ ...engineForm, dbColor: e.target.value })}
                  className="w-9 h-9 shrink-0 rounded-lg border border-slate-300 p-0.5 cursor-pointer bg-white"
                />
                <input
                  type="text"
                  value={engineForm.dbColor}
                  onChange={(e) => setEngineForm({ ...engineForm, dbColor: e.target.value })}
                  className="w-full min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Default Port
              </label>
              <input
                type="number"
                required
                value={engineForm.defaultPort}
                onChange={(e) => setEngineForm({ ...engineForm, defaultPort: parseInt(e.target.value, 10) || 5432 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Status
              </label>
              <select
                value={engineForm.statusOnOff}
                onChange={(e) => setEngineForm({ ...engineForm, statusOnOff: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Description & Notes
            </label>
            <textarea
              rows={2}
              placeholder="Architecture specifics, client driver notes, or version compatibility..."
              value={engineForm.description}
              onChange={(e) => setEngineForm({ ...engineForm, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEngineModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors shadow-2xs cursor-pointer"
            >
              {editingEngine ? 'Save Engine Changes' : 'Register Engine'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Clean All Monitor Data Confirmation Dialog */}
      <Dialog
        isOpen={isCleanMonitorConfirmOpen}
        onClose={() => setIsCleanMonitorConfirmOpen(false)}
        title="Clean All Monitor Data?"
        description="Permanently delete historical and active monitoring alerts and logs?"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">CONFIRMATION:</span> This operation will delete:
              <ul className="list-disc list-inside mt-1.5 space-y-1 pl-1 font-mono text-[11px]">
                <li>Active Alerts & Alert History older than <span className="font-bold text-red-700">{cleanMonitorDays} day(s)</span></li>
                <li>Metric Telemetry Data Points older than <span className="font-bold text-red-700">{cleanMonitorDays} day(s)</span></li>
                <li>Alert Notification Dispatch Logs older than <span className="font-bold text-red-700">{cleanMonitorDays} day(s)</span></li>
                <li>Target Database Scope: <span className="font-bold text-slate-900">{cleanMonitorDbId === 'ALL' ? 'ALL Databases' : databases.find(d => d.id === cleanMonitorDbId)?.name || cleanMonitorDbId}</span></li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={isCleaningMonitor}
              onClick={() => setIsCleanMonitorConfirmOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isCleaningMonitor}
              onClick={handleCleanAllMonitorData}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              {isCleaningMonitor ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Cleaning...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Clean All Monitor Data</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Clean Raw Query History Confirmation Dialog */}
      <Dialog
        isOpen={isCleanRawConfirmOpen}
        onClose={() => setIsCleanRawConfirmOpen(false)}
        title="Clean Raw Query History?"
        description="Permanently delete time-series metric measurement points while keeping alert history?"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">CONFIRMATION:</span> This operation will delete:
              <ul className="list-disc list-inside mt-1.5 space-y-1 pl-1 font-mono text-[11px]">
                <li>Metric Measurement History Points older than <span className="font-bold text-amber-700">{cleanRawDays} day(s)</span></li>
                <li>Target Database Scope: <span className="font-bold text-slate-900">{cleanRawDbId === 'ALL' ? 'ALL Databases' : databases.find(d => d.id === cleanRawDbId)?.name || cleanRawDbId}</span></li>
                <li className="text-emerald-700 font-semibold">Alert History & Notification Logs will remain intact!</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={isCleaningRaw}
              onClick={() => setIsCleanRawConfirmOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isCleaningRaw}
              onClick={handleCleanRawQueryHistory}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              {isCleaningRaw ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Cleaning...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Clean Raw Query History</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Reset All Data Confirmation Dialog */}
      <Dialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title="Reset All Database Monitoring Data?"
        description="Are you absolutely sure you want to perform a global system reset? This operation is permanent and cannot be undone."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">CRITICAL WARNING:</span> Proceeding will permanently purge:
              <ul className="list-disc list-inside mt-1.5 space-y-1 pl-1">
                <li>All registered <span className="font-bold">database connections</span> and monitoring statuses</li>
                <li>All <span className="font-bold">logical groups</span> and template mappings</li>
                <li>All health check <span className="font-bold">templates</span> and custom <span className="font-bold">metrics</span> definitions</li>
                <li>All historical and active <span className="font-bold">incidents / alert logs</span></li>
                <li>All time-series <span className="font-bold">metric data points / telemetry history</span></li>
              </ul>
              <div className="mt-2 font-semibold">
                Audit logs, system settings, supported database engines registry, and alert notification dispatchers will be preserved intact.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={isResetting}
              onClick={() => setIsResetConfirmOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-reset-all-data"
              type="button"
              disabled={isResetting}
              onClick={handleResetDataSubmit}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Resetting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Reset All Data</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Key-Value Setting Parameter Dialog */}
      <Dialog
        isOpen={isKvModalOpen}
        onClose={() => setIsKvModalOpen(false)}
        title={editingItem ? 'Edit System Setting Parameter' : 'Add System Setting Parameter'}
        description="Configure runtime setting key-value pair"
        maxWidth="md"
      >
        <form onSubmit={handleSaveKvSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Setting Key (Name):</label>
            <input
              type="text"
              required
              disabled={!!editingItem}
              value={kvForm.name}
              onChange={(e) => setKvForm({ ...kvForm, name: e.target.value })}
              placeholder="e.g. SESSION_TIMEOUT_MINUTES"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Setting Value:</label>
            <textarea
              required
              rows={3}
              value={kvForm.value}
              onChange={(e) => setKvForm({ ...kvForm, value: e.target.value })}
              placeholder="e.g. 30"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsKvModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors shadow-2xs cursor-pointer"
            >
              {editingItem ? 'Save Setting Changes' : 'Create Setting Parameter'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
