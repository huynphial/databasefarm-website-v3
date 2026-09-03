import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/views/DashboardView';
import { ActiveAlertsView } from './components/views/ActiveAlertsView';
import { DatabasesView } from './components/views/DatabasesView';
import { MetricsView } from './components/views/MetricsView';
import { TemplatesView } from './components/views/TemplatesView';
import { GroupsView } from './components/views/GroupsView';
import { AlertHistoryView } from './components/views/AlertHistoryView';
import { AnalyticsDatabaseView } from './components/views/AnalyticsDatabaseView';
import { SystemSettingsView } from './components/views/SystemSettingsView';
import { AuditLogsView } from './components/views/AuditLogsView';
import { RawMeasurementsView } from './components/views/RawMeasurementsView';
import { AlertNotificationLogView } from './components/views/AlertNotificationLogView';
import { MonitorPollLogView } from './components/views/MonitorPollLogView';
import { AccountView } from './components/views/AccountView';
import { LoginView } from './components/views/LoginView';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './i18n';
import { storage } from './lib/storage';
import { api } from './lib/api';
import { autoSyncDatabaseTemplateMetrics } from './lib/utils';
import { AUTH_CONFIG, getSessionTimeoutMs } from './config/authConfig';
import {
  User,
  DatabaseEntity,
  DatabaseEngineEntity,
  AlertNotificationMethodEntity,
  AlertNotificationLogEntity,
  AlertNotificationQueueEntity,
  DatabasePollQueueEntity,
  DatabasePollLogEntity,
  RawMeasurementEntity,
  MetricEntity,
  TemplateEntity,
  GroupEntity,
  ActiveAlertEntity,
  AlertHistoryEntity,
  MetricHistoryEntity,
  SystemSettingsEntity,
  UserRole,
} from './types';

const VALID_NAVIGATION_TABS: NavigationTab[] = [
  'dashboard',
  'raw-measurements',
  'databases',
  'groups',
  'templates',
  'analytics-database',
  'metrics',
  'active-alerts',
  'alert-history',
  'alert-notification-logs',
  'monitor-poll-logs',
  'audit-logs',
  'system-settings',
  'account',
];

const getInitialNavigationTab = (): NavigationTab => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && (VALID_NAVIGATION_TABS as string[]).includes(hash)) {
      return hash as NavigationTab;
    }
    const saved = localStorage.getItem('dbmon_active_tab');
    if (saved && (VALID_NAVIGATION_TABS as string[]).includes(saved)) {
      return saved as NavigationTab;
    }
  }
  return 'dashboard';
};

function MainAppContent() {
  const { toast } = useToast();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return storage.getUser();
  });

  // Active Tab persisted across F5 / page reloads
  const [activeTab, setActiveTab] = useState<NavigationTab>(getInitialNavigationTab);
  const [analyticsInitialDbId, setAnalyticsInitialDbId] = useState<string | undefined>(undefined);

  // Storage Type state indicator
  const [storageType, setStorageType] = useState<'prisma' | 'memory'>('memory');

  // Core Data Store States
  const [databases, setDatabases] = useState<DatabaseEntity[]>([]);
  const [databaseEngines, setDatabaseEngines] = useState<DatabaseEngineEntity[]>([]);
  const [alertMethods, setAlertMethods] = useState<AlertNotificationMethodEntity[]>([]);
  const [rawMeasurements, setRawMeasurements] = useState<RawMeasurementEntity[]>([]);
  const [metrics, setMetrics] = useState<MetricEntity[]>([]);
  const [templates, setTemplates] = useState<TemplateEntity[]>([]);
  const [groups, setGroups] = useState<GroupEntity[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlertEntity[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntity[]>([]);
  const [alertNotificationLogs, setAlertNotificationLogs] = useState<AlertNotificationLogEntity[]>([]);
  const [alertNotificationQueue, setAlertNotificationQueue] = useState<AlertNotificationQueueEntity[]>([]);
  const [databasePollQueue, setDatabasePollQueue] = useState<DatabasePollQueueEntity[]>([]);
  const [databasePollLogs, setDatabasePollLogs] = useState<DatabasePollLogEntity[]>([]);
  const [metricHistory, setMetricHistory] = useState<MetricHistoryEntity[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettingsEntity>(() => storage.getSystemSettings());

  // Ref to handle concurrent data load requests safely
  const loadDataCountRef = useRef(0);

  // Load Data from Backend API / Storage
  const loadData = useCallback(async () => {
    const requestId = ++loadDataCountRef.current;
    try {
      const [
        sInfo,
        dbs,
        engines,
        methods,
        raws,
        mets,
        tpls,
        grps,
        active,
        history,
        notifLogs,
        notifQueue,
        dbPollQueue,
        dbPollLogs,
        mHistory,
        settings,
      ] = await Promise.all([
        api.getStorageInfo().catch(() => ({ storageType: 'memory' as const, isPrismaActive: false })),
        api.getDatabases().catch(() => storage.getDatabases()),
        api.getDatabaseEngines().catch(() => []),
        api.getAlertNotificationMethods().catch(() => []),
        api.getRawMeasurements().catch(() => []),
        api.getMetrics().catch(() => storage.getMetrics()),
        api.getTemplates().catch(() => storage.getTemplates()),
        api.getGroups().catch(() => storage.getGroups()),
        api.getActiveAlerts().catch(() => storage.getActiveAlerts()),
        api.getAlertHistory().catch(() => storage.getAlertHistory()),
        api.getAlertNotificationLogs().catch(() => storage.getAlertNotificationLogs()),
        api.getAlertNotificationQueue().catch(() => storage.getAlertNotificationQueue()),
        api.getDatabasePollQueue().catch(() => storage.getDatabasePollQueue()),
        api.getDatabasePollLogs().catch(() => storage.getDatabasePollLogs()),
        api.getMetricHistory().catch(() => storage.getMetricHistory()),
        api.getSystemSettings().catch(() => storage.getSystemSettings()),
      ]);

      if (requestId !== loadDataCountRef.current) return;

      const { syncedDatabases } = autoSyncDatabaseTemplateMetrics(dbs, grps, tpls, mets);

      setStorageType(sInfo.storageType);
      setDatabases(syncedDatabases);
      setDatabaseEngines(engines);
      setAlertMethods(methods);
      setRawMeasurements(raws);
      setMetrics(mets);
      setTemplates(tpls);
      setGroups(grps);
      setActiveAlerts(active);
      setAlertHistory(history);
      setAlertNotificationLogs(notifLogs);
      setAlertNotificationQueue(notifQueue);
      setDatabasePollQueue(dbPollQueue);
      setDatabasePollLogs(dbPollLogs);
      setMetricHistory(mHistory);
      setSystemSettings(settings);

      // Cache locally for offline availability
      storage.setDatabases(syncedDatabases);
      storage.setMetrics(mets);
      storage.setTemplates(tpls);
      storage.setGroups(grps);
      storage.setActiveAlerts(active);
      storage.setAlertHistory(history);
      storage.setAlertNotificationLogs(notifLogs);
      storage.setAlertNotificationQueue(notifQueue);
      storage.setDatabasePollQueue(dbPollQueue);
      storage.setDatabasePollLogs(dbPollLogs);
      storage.setMetricHistory(mHistory);
      storage.setSystemSettings(settings);
    } catch (e) {
      console.warn('API sync warning, using local storage cache fallback:', e);
    }
  }, []);

  // Sync activeTab to localStorage and window hash
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dbmon_active_tab', activeTab);
      if (window.location.hash !== `#${activeTab}`) {
        window.history.replaceState(null, '', `#${activeTab}`);
      }
    }
  }, [activeTab]);

  // Handle browser navigation / hash change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && (VALID_NAVIGATION_TABS as string[]).includes(hash)) {
        setActiveTab(hash as NavigationTab);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Auto refresh newest data whenever activeTab changes (including initial load)
  useEffect(() => {
    loadData();
  }, [activeTab, loadData]);

  const handleSaveEngine = async (engine: Partial<DatabaseEngineEntity>) => {
    try {
      const saved = await api.saveDatabaseEngine(engine);
      const refreshed = await api.getDatabaseEngines();
      setDatabaseEngines(refreshed);
      return saved;
    } catch (e: any) {
      toast({ title: 'Error Saving Engine', description: e.message, type: 'error' });
      throw e;
    }
  };

  const handleDeleteEngine = async (id: string) => {
    try {
      await api.deleteDatabaseEngine(id);
      setDatabaseEngines((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      toast({ title: 'Error Deleting Engine', description: e.message, type: 'error' });
      throw e;
    }
  };

  const handleSaveAlertMethod = async (method: Partial<AlertNotificationMethodEntity>) => {
    try {
      const saved = await api.saveAlertNotificationMethod(method);
      const refreshed = await api.getAlertNotificationMethods();
      setAlertMethods(refreshed);
      return saved;
    } catch (e: any) {
      toast({ title: 'Error Saving Alert Method', description: e.message, type: 'error' });
      throw e;
    }
  };

  const handleDeleteAlertMethod = async (id: string) => {
    try {
      await api.deleteAlertNotificationMethod(id);
      setAlertMethods((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      toast({ title: 'Error Deleting Alert Method', description: e.message, type: 'error' });
      throw e;
    }
  };

  const handleSaveSystemSettings = async (newSettings: SystemSettingsEntity) => {
    try {
      const updated = await api.updateSystemSettings(newSettings);
      setSystemSettings(updated);
      storage.setSystemSettings(updated);
      toast({ title: 'Settings Saved', description: 'System configuration updated successfully.', type: 'success' });
    } catch (e: any) {
      storage.setSystemSettings(newSettings);
      setSystemSettings(newSettings);
      toast({ title: 'Settings Saved Locally', description: newSettings.collectorEndpoint, type: 'info' });
    }
  };

  const handleResetAllData = async () => {
    try {
      await api.resetData().catch((e) => {
        console.warn('API reset failed, resetting client-side state directly:', e);
      });
      
      // Clear client storage cache
      storage.resetData();

      // Clear all state hooks
      setDatabases([]);
      setMetrics([]);
      setTemplates([]);
      setGroups([]);
      setActiveAlerts([]);
      setAlertHistory([]);
      setAlertNotificationLogs([]);
      setAlertNotificationQueue([]);
      setDatabasePollQueue([]);
      setDatabasePollLogs([]);
      setMetricHistory([]);
      setRawMeasurements([]);

      toast({
        title: 'System Reset Successful',
        description: 'All monitoring databases, groups, templates, metrics, alerts, and histories have been cleared.',
        type: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Reset Failed',
        description: err.message || 'An error occurred during global data reset.',
        type: 'error',
      });
    }
  };

  // Login handler
  const handleLogin = (username: string, role: UserRole) => {
    const user: User = {
      id: role === 'ADMIN' ? 'usr-admin-01' : 'usr-viewer-02',
      username,
      role,
      createdAt: new Date().toISOString(),
    };
    const now = Date.now();
    storage.setUser(user);
    storage.setLastActivity(now);
    setCurrentUser(user);
  };

  // Session Inactivity & Auto-Expiry Management
  const lastActivityRef = useRef<number>(Date.now());

  const getActiveSessionTimeoutMinutes = useCallback(() => {
    const fromVal = systemSettings.sessionTimeoutMinutes ?? systemSettings.SESSION_TIMEOUT_MINUTES;
    const num = Number(fromVal);
    if (!isNaN(num) && num > 0) return num;
    return getSessionTimeoutMs() / 60000;
  }, [systemSettings]);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > 2000) {
      lastActivityRef.current = now;
      storage.setLastActivity(now);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const timeoutMinutes = getActiveSessionTimeoutMinutes();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    // Initial check on load/mount
    const initialLast = storage.getLastActivity();
    if (Date.now() - initialLast >= timeoutMs) {
      setCurrentUser(null);
      storage.setUser(null);
      storage.clearLastActivity();
      toast({
        title: 'Session Expired',
        description: `Your session expired after ${timeoutMinutes} minutes of inactivity.`,
        type: 'error',
      });
      return;
    }

    lastActivityRef.current = initialLast;

    const events = AUTH_CONFIG.session?.activityEvents || [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, updateActivity, { passive: true });
    });

    const timerId = setInterval(() => {
      const currentLast = storage.getLastActivity();
      if (Date.now() - currentLast >= timeoutMs) {
        setCurrentUser(null);
        storage.setUser(null);
        storage.clearLastActivity();
        toast({
          title: 'Session Expired',
          description: `You have been logged out due to ${timeoutMinutes} minutes of inactivity.`,
          type: 'error',
        });
      }
    }, 3000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, updateActivity);
      });
      clearInterval(timerId);
    };
  }, [currentUser, updateActivity, toast, getActiveSessionTimeoutMinutes]);

  // Switch role handler
  const handleRoleChange = (newRole: UserRole) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, role: newRole };
    storage.setUser(updatedUser);
    setCurrentUser(updatedUser);
    toast({
      title: 'Role Switched',
      description: `Active session role set to ${newRole}.`,
      type: 'info',
    });
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    storage.setUser(null);
    storage.clearLastActivity();
    toast({ title: 'Signed Out', description: 'Session ended successfully.', type: 'info' });
  };

  // Transactional Clear Alert
  const handleClearAlert = async (alertId: string) => {
    try {
      await api.clearActiveAlert(alertId, currentUser?.id, currentUser?.username);
      const [nextActive, nextHistory] = await Promise.all([
        api.getActiveAlerts(),
        api.getAlertHistory(),
      ]);
      setActiveAlerts(nextActive);
      setAlertHistory(nextHistory);
      storage.setActiveAlerts(nextActive);
      storage.setAlertHistory(nextHistory);
    } catch (e) {
      console.error('Failed to clear active alert on backend:', e);
      const targetAlert = activeAlerts.find((a) => a.id === alertId);
      if (!targetAlert) return;
      const nextActive = activeAlerts.filter((a) => a.id !== alertId);
      setActiveAlerts(nextActive);
      storage.setActiveAlerts(nextActive);

      const historyEntry: AlertHistoryEntity = {
        id: `hist-${Date.now()}`,
        dbId: targetAlert.dbId,
        dbName: targetAlert.dbName,
        metricId: targetAlert.metricId,
        metricName: targetAlert.metricName,
        objectName: targetAlert.objectName,
        attributeName: targetAlert.attributeName,
        resolutionStatus: 'CLEARED_BY_USER',
        alertLevel: targetAlert.alertLevel,
        message: targetAlert.message,
        createdAt: targetAlert.createdAt,
        clearedAt: new Date().toISOString(),
        clearedById: currentUser?.id || null,
        clearedByName: currentUser?.username || 'admin',
      };
      const nextHistory = [historyEntry, ...alertHistory];
      setAlertHistory(nextHistory);
      storage.setAlertHistory(nextHistory);
    }
  };

  // Transactional Acknowledge Alert (OPEN -> ACKNOWLEDGED)
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await api.acknowledgeActiveAlert(alertId, currentUser?.id, currentUser?.username);
      const nextActive = await api.getActiveAlerts();
      setActiveAlerts(nextActive);
      storage.setActiveAlerts(nextActive);
    } catch (e) {
      const nextActive = activeAlerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status: 'ACKNOWLEDGED' as const,
              acknowledgedAt: new Date().toISOString(),
              acknowledgedById: currentUser?.id,
              acknowledgedByName: currentUser?.username,
            }
          : a
      );
      setActiveAlerts(nextActive);
      storage.setActiveAlerts(nextActive);
    }
  };

  // Databases CRUD
  const handleSaveDatabase = async (dbData: Partial<DatabaseEntity>) => {
    try {
      if (dbData.id) {
        await api.updateDatabase(dbData.id, dbData);
      } else {
        await api.createDatabase(dbData);
      }
      const refreshed = await api.getDatabases();
      setDatabases(refreshed);
      storage.setDatabases(refreshed);
      toast({ title: 'Database Saved', description: `${dbData.name || 'Database'} saved to storage provider (${storageType.toUpperCase()}).`, type: 'success' });
    } catch (e) {
      // Local fallback
      let updated: DatabaseEntity[];
      if (dbData.id) {
        updated = databases.map((d) =>
          d.id === dbData.id ? ({ ...d, ...dbData, updatedAt: new Date().toISOString() } as DatabaseEntity) : d
        );
      } else {
        const newDb: DatabaseEntity = {
          id: `db-${Date.now().toString().slice(-4)}`,
          name: dbData.name || 'NEW_DB',
          dbType: dbData.dbType || 'POSTGRES',
          host: dbData.host || '127.0.0.1',
          port: dbData.port || 5432,
          tags: dbData.tags || [],
          pollIntervalMinutes: dbData.pollIntervalMinutes ?? 5,
          note: dbData.note || '',
          username: dbData.username || 'dbmon_reader',
          password: dbData.password || '',
          connectionConfig: dbData.connectionConfig || {},
          groupIds: dbData.groupIds || [],
          metricIds: dbData.metricIds || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updated = [newDb, ...databases];
      }
      setDatabases(updated);
      storage.setDatabases(updated);
    }
  };

  const handleDeleteDatabase = async (id: string) => {
    try {
      await api.deleteDatabase(id);
      const [refreshedDbs, refreshedActive] = await Promise.all([
        api.getDatabases(),
        api.getActiveAlerts(),
      ]);
      setDatabases(refreshedDbs);
      setActiveAlerts(refreshedActive);
      storage.setDatabases(refreshedDbs);
      storage.setActiveAlerts(refreshedActive);
      toast({ title: 'Database Deleted', description: 'Database and associated metrics unlinked.', type: 'info' });
    } catch (e) {
      const nextDbs = databases.filter((d) => d.id !== id);
      setDatabases(nextDbs);
      storage.setDatabases(nextDbs);

      const nextActive = activeAlerts.filter((a) => a.dbId !== id);
      setActiveAlerts(nextActive);
      storage.setActiveAlerts(nextActive);
    }
  };

  // Metrics CRUD
  const handleSaveMetric = async (metricData: Partial<MetricEntity>) => {
    try {
      if (metricData.id) {
        await api.updateMetric(metricData.id, metricData);
      } else {
        await api.createMetric(metricData);
      }
      const [refreshedMets, refreshedDbs] = await Promise.all([
        api.getMetrics(),
        api.getDatabases(),
      ]);
      const { syncedDatabases } = autoSyncDatabaseTemplateMetrics(refreshedDbs, groups, templates, refreshedMets);
      setMetrics(refreshedMets);
      setDatabases(syncedDatabases);
      storage.setMetrics(refreshedMets);
      storage.setDatabases(syncedDatabases);
      toast({ title: 'Metric Saved', description: `${metricData.name || 'Metric'} persisted in ${storageType.toUpperCase()} store.`, type: 'success' });
    } catch (e) {
      let updated: MetricEntity[];
      if (metricData.id) {
        updated = metrics.map((m) =>
          m.id === metricData.id ? ({ ...m, ...metricData, updatedAt: new Date().toISOString() } as MetricEntity) : m
        );
      } else {
        const newMetric: MetricEntity = {
          id: `met-${Date.now().toString().slice(-4)}`,
          name: metricData.name || 'New Metric',
          sqlQuery: metricData.sqlQuery || 'SELECT 1',
          valueType: metricData.valueType || 'NUMBER',
          thresholdWarn: metricData.thresholdWarn,
          thresholdHigh: metricData.thresholdHigh,
          thresholdCritical: metricData.thresholdCritical,
          cycle: metricData.cycle ?? 1,
          templateId: metricData.templateId,
          templateName: metricData.templateName,
          isEnabled: metricData.isEnabled !== false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updated = [newMetric, ...metrics];
      }
      const { syncedDatabases } = autoSyncDatabaseTemplateMetrics(databases, groups, templates, updated);
      setMetrics(updated);
      setDatabases(syncedDatabases);
      storage.setMetrics(updated);
      storage.setDatabases(syncedDatabases);
    }
  };

  const handleDeleteMetric = async (id: string) => {
    try {
      await api.deleteMetric(id);
      const [refreshedMets, refreshedActive] = await Promise.all([
        api.getMetrics(),
        api.getActiveAlerts(),
      ]);
      setMetrics(refreshedMets);
      setActiveAlerts(refreshedActive);
      storage.setMetrics(refreshedMets);
      storage.setActiveAlerts(refreshedActive);
      toast({ title: 'Metric Removed', description: 'Metric definition unlinked.', type: 'info' });
    } catch (e) {
      const nextMetrics = metrics.filter((m) => m.id !== id);
      setMetrics(nextMetrics);
      storage.setMetrics(nextMetrics);

      const nextActive = activeAlerts.filter((a) => a.metricId !== id);
      setActiveAlerts(nextActive);
      storage.setActiveAlerts(nextActive);
    }
  };

  // Templates CRUD
  const handleSaveTemplate = async (tplData: Partial<TemplateEntity>) => {
    try {
      if (tplData.id) {
        await api.updateTemplate(tplData.id, tplData);
      } else {
        await api.createTemplate(tplData);
      }
      const [refreshedTpls, refreshedDbs] = await Promise.all([
        api.getTemplates(),
        api.getDatabases(),
      ]);
      const { syncedDatabases } = autoSyncDatabaseTemplateMetrics(refreshedDbs, groups, refreshedTpls, metrics);
      setTemplates(refreshedTpls);
      setDatabases(syncedDatabases);
      storage.setTemplates(refreshedTpls);
      storage.setDatabases(syncedDatabases);
      toast({ title: 'Template Saved', description: `${tplData.name || 'Template'} saved successfully.`, type: 'success' });
    } catch (e) {
      let updated: TemplateEntity[];
      if (tplData.id) {
        updated = templates.map((t) =>
          t.id === tplData.id ? ({ ...t, ...tplData, updatedAt: new Date().toISOString() } as TemplateEntity) : t
        );
      } else {
        const newTpl: TemplateEntity = {
          id: `tpl-${Date.now().toString().slice(-4)}`,
          name: tplData.name || 'New Template',
          description: tplData.description || null,
          targetDbType: tplData.targetDbType || 'POSTGRES',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updated = [newTpl, ...templates];
      }
      const { syncedDatabases } = autoSyncDatabaseTemplateMetrics(databases, groups, updated, metrics);
      setTemplates(updated);
      setDatabases(syncedDatabases);
      storage.setTemplates(updated);
      storage.setDatabases(syncedDatabases);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await api.deleteTemplate(id);
      const refreshed = await api.getTemplates();
      setTemplates(refreshed);
      storage.setTemplates(refreshed);
      toast({ title: 'Template Removed', description: 'Template unlinked successfully.', type: 'info' });
    } catch (e) {
      const nextTpls = templates.filter((t) => t.id !== id);
      setTemplates(nextTpls);
      storage.setTemplates(nextTpls);
    }
  };

  // Groups CRUD
  const handleSaveGroup = async (groupData: Partial<GroupEntity>, assignedDbIds?: string[]) => {
    try {
      if (groupData.id) {
        await api.updateGroup(groupData.id, groupData, assignedDbIds);
      } else {
        await api.createGroup(groupData, assignedDbIds);
      }
      const [refreshedGroups, refreshedDbs] = await Promise.all([
        api.getGroups(),
        api.getDatabases(),
      ]);
      const { syncedDatabases } = autoSyncDatabaseTemplateMetrics(refreshedDbs, refreshedGroups, templates, metrics);
      setGroups(refreshedGroups);
      setDatabases(syncedDatabases);
      storage.setGroups(refreshedGroups);
      storage.setDatabases(syncedDatabases);
      toast({ title: 'Group Saved', description: `${groupData.name || 'Group'} saved to ${storageType.toUpperCase()} database.`, type: 'success' });
    } catch (e) {
      let updated: GroupEntity[];
      let targetGroupId = groupData.id;

      if (groupData.id) {
        updated = groups.map((g) =>
          g.id === groupData.id ? ({ ...g, ...groupData, updatedAt: new Date().toISOString() } as GroupEntity) : g
        );
      } else {
        targetGroupId = `grp-${Date.now().toString().slice(-4)}`;
        const newGroup: GroupEntity = {
          id: targetGroupId,
          name: groupData.name || 'New Group',
          description: groupData.description || null,
          databaseIds: assignedDbIds || groupData.databaseIds || [],
          templateIds: groupData.templateIds || [],
          notificationMappings: groupData.notificationMappings || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updated = [newGroup, ...groups];
      }

      let currentDbs = databases;
      if (assignedDbIds && targetGroupId) {
        currentDbs = databases.map((db) => {
          const hasGroup = db.groupIds?.includes(targetGroupId!);
          const shouldHave = assignedDbIds.includes(db.id);

          if (shouldHave && !hasGroup) {
            return { ...db, groupIds: [...(db.groupIds || []), targetGroupId!] };
          } else if (!shouldHave && hasGroup) {
            return { ...db, groupIds: (db.groupIds || []).filter((gid) => gid !== targetGroupId) };
          }
          return db;
        });
      }

      const { syncedDatabases } = autoSyncDatabaseTemplateMetrics(currentDbs, updated, templates, metrics);
      setGroups(updated);
      setDatabases(syncedDatabases);
      storage.setGroups(updated);
      storage.setDatabases(syncedDatabases);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await api.deleteGroup(id);
      const [refreshedGroups, refreshedDbs] = await Promise.all([
        api.getGroups(),
        api.getDatabases(),
      ]);
      setGroups(refreshedGroups);
      setDatabases(refreshedDbs);
      storage.setGroups(refreshedGroups);
      storage.setDatabases(refreshedDbs);
      toast({ title: 'Group Removed', description: 'Database group unlinked.', type: 'info' });
    } catch (e) {
      const nextGroups = groups.filter((g) => g.id !== id);
      setGroups(nextGroups);
      storage.setGroups(nextGroups);

      const updatedDbs = databases.map((db) => ({
        ...db,
        groupIds: (db.groupIds || []).filter((gid) => gid !== id),
      }));
      setDatabases(updatedDbs);
      storage.setDatabases(updatedDbs);
    }
  };

  const handleSelectTab = (tab: NavigationTab, initialDbId?: string) => {
    setAnalyticsInitialDbId(initialDbId);
    setActiveTab(tab);

    if (currentUser) {
      api.logAudit({
        userId: currentUser.username,
        actionType: 'PAGE_VIEW',
        targetEntity: 'NAVIGATION',
        targetId: tab,
        details: `Navigated to tab "${tab}"${initialDbId ? ` for database "${initialDbId}"` : ''}`,
      }).catch(() => {});
    }
  };

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden antialiased">
      {/* Fixed Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          userRole={currentUser.role}
          storageType={storageType}
          sessionTimeoutMinutes={getActiveSessionTimeoutMinutes()}
          databasePollLogs={databasePollLogs}
        />

        {/* Tab View Routing */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
          {activeTab === 'dashboard' && (
            <DashboardView
              databases={databases}
              activeAlerts={activeAlerts}
              onClearAlert={handleClearAlert}
              onRefresh={loadData}
              userRole={currentUser.role}
              onNavigateToDatabases={() => handleSelectTab('databases')}
              onNavigateToAnalytics={(dbId) => handleSelectTab('analytics-database', dbId)}
              onNavigateToActiveAlerts={() => handleSelectTab('active-alerts')}
            />
          )}

          {activeTab === 'active-alerts' && (
            <ActiveAlertsView
              databases={databases}
              activeAlerts={activeAlerts}
              onClearAlert={handleClearAlert}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onRefresh={loadData}
              userRole={currentUser.role}
              showInfoTips={systemSettings.showInfoTips !== false}
            />
          )}

          {activeTab === 'alert-notification-logs' && (
            <AlertNotificationLogView
              queue={alertNotificationQueue}
              logs={alertNotificationLogs}
              databases={databases}
              databaseEngines={databaseEngines}
              alertMethods={alertMethods}
              userRole={currentUser.role}
              showInfoTips={systemSettings.showInfoTips !== false}
              onRefresh={loadData}
              onSaveAlertMethod={handleSaveAlertMethod}
              onDeleteAlertMethod={handleDeleteAlertMethod}
            />
          )}

          {activeTab === 'monitor-poll-logs' && (
            <MonitorPollLogView
              queue={databasePollQueue}
              logs={databasePollLogs}
              databases={databases}
              databaseEngines={databaseEngines}
              userRole={currentUser.role}
              showInfoTips={systemSettings.showInfoTips !== false}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'databases' && (
            <DatabasesView
              databases={databases}
              databaseEngines={databaseEngines}
              groups={groups}
              templates={templates}
              metrics={metrics}
              activeAlerts={activeAlerts}
              userRole={currentUser.role}
              showInfoTips={systemSettings.showInfoTips !== false}
              onSaveDatabase={handleSaveDatabase}
              onDeleteDatabase={handleDeleteDatabase}
              onNavigateToAnalytics={(dbId) => handleSelectTab('analytics-database', dbId)}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'raw-measurements' && (
            <RawMeasurementsView
              measurements={rawMeasurements}
              databases={databases}
              metrics={metrics}
              databaseEngines={databaseEngines}
              timestampFormat={systemSettings.timestampFormat}
              onRefresh={loadData}
              showInfoTips={systemSettings.showInfoTips !== false}
            />
          )}

          {activeTab === 'metrics' && (
            <MetricsView
              metrics={metrics}
              templates={templates}
              databaseEngines={databaseEngines}
              userRole={currentUser.role}
              showInfoTips={systemSettings.showInfoTips !== false}
              onSaveMetric={handleSaveMetric}
              onDeleteMetric={handleDeleteMetric}
            />
          )}

          {activeTab === 'templates' && (
            <TemplatesView
              templates={templates}
              metrics={metrics}
              databaseEngines={databaseEngines}
              userRole={currentUser.role}
              showInfoTips={systemSettings.showInfoTips !== false}
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onSaveMetric={handleSaveMetric}
            />
          )}

          {activeTab === 'groups' && (
            <GroupsView
              groups={groups}
              databases={databases}
              templates={templates}
              databaseEngines={databaseEngines}
              alertMethods={alertMethods}
              activeAlerts={activeAlerts}
              userRole={currentUser.role}
              showInfoTips={systemSettings.showInfoTips !== false}
              onSaveGroup={handleSaveGroup}
              onDeleteGroup={handleDeleteGroup}
            />
          )}

          {activeTab === 'alert-history' && (
            <AlertHistoryView
              alertHistory={alertHistory}
              databases={databases}
              onRefresh={loadData}
              showInfoTips={systemSettings.showInfoTips !== false}
            />
          )}

          {activeTab === 'analytics-database' && (
            <AnalyticsDatabaseView
              databases={databases}
              metrics={metrics}
              rawMeasurements={rawMeasurements}
              metricHistory={metricHistory}
              activeAlerts={activeAlerts}
              databaseEngines={databaseEngines}
              systemSettings={systemSettings}
              userRole={currentUser.role}
              initialDbId={analyticsInitialDbId}
              onRefresh={loadData}
              onClearAlert={handleClearAlert}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              showInfoTips={systemSettings.showInfoTips !== false}
            />
          )}

          {activeTab === 'system-settings' && (
            <SystemSettingsView
              settings={systemSettings}
              userRole={currentUser.role}
              databases={databases}
              databaseEngines={databaseEngines}
              alertMethods={alertMethods}
              databasePollLogs={databasePollLogs}
              onSaveSettings={handleSaveSystemSettings}
              onSaveEngine={handleSaveEngine}
              onDeleteEngine={handleDeleteEngine}
              onSaveAlertMethod={handleSaveAlertMethod}
              onDeleteAlertMethod={handleDeleteAlertMethod}
              onResetAllData={handleResetAllData}
              onRefreshData={loadData}
            />
          )}

          {activeTab === 'account' && (
            <AccountView
              currentUser={currentUser}
              sessionTimeoutMinutes={getActiveSessionTimeoutMinutes()}
            />
          )}

          {activeTab === 'audit-logs' && (
            <AuditLogsView
              userRole={currentUser.role}
              showInfoTips={systemSettings.showInfoTips !== false}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <MainAppContent />
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
