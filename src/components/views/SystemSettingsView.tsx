import React, { useState, useEffect } from 'react';
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
  Unlock,
  Users,
  UserPlus,
  KeyRound,
  UserX,
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
  Sparkles
} from 'lucide-react';
import {
  SystemSettingsEntity,
  UserRole,
  User,
  DatabaseEngineEntity,
  AlertNotificationMethodEntity,
  AlertMethodType
} from '../../types';
import { useToast } from '../ui/Toast';
import { api } from '../../lib/api';
import { Dialog } from '../ui/Dialog';
import { getDbEngineBadgeClass } from '../../config/dbEngines';

interface SystemSettingsViewProps {
  settings: SystemSettingsEntity;
  userRole: UserRole;
  databaseEngines: DatabaseEngineEntity[];
  alertMethods: AlertNotificationMethodEntity[];
  onSaveSettings: (newSettings: SystemSettingsEntity) => void;
  onSaveEngine: (engine: Partial<DatabaseEngineEntity>) => Promise<any>;
  onDeleteEngine: (id: string) => Promise<void>;
  onSaveAlertMethod: (method: Partial<AlertNotificationMethodEntity>) => Promise<any>;
  onDeleteAlertMethod: (id: string) => Promise<void>;
  onResetAllData: () => Promise<void>;
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
  databaseEngines,
  alertMethods,
  onSaveSettings,
  onSaveEngine,
  onDeleteEngine,
  onSaveAlertMethod,
  onDeleteAlertMethod,
  onResetAllData,
}) => {
  const { toast } = useToast();
  const isAdmin = userRole === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'collector' | 'engines' | 'alerts' | 'accounts'>('collector');

  // --- Stateful User Accounts Management ---
  const [currentUser, setCurrentUser] = useState<string>(() => {
    try {
      const u = JSON.parse(localStorage.getItem('dbm_current_user') || '');
      return u?.username || 'admin';
    } catch {
      return 'admin';
    }
  });

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);

  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'VIEWER' as 'ADMIN' | 'VIEWER',
    isLocked: false,
  });

  const [resetPasswordForm, setResetPasswordForm] = useState({
    userId: '',
    username: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const [selfPasswordForm, setSelfPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      console.warn('Failed to load user accounts list dynamically:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'accounts') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username.trim()) {
      toast({ title: 'Validation Error', description: 'Username is required.', type: 'error' });
      return;
    }
    if (!userForm.password) {
      toast({ title: 'Validation Error', description: 'Password is required.', type: 'error' });
      return;
    }
    if (userForm.password !== userForm.confirmPassword) {
      toast({ title: 'Validation Error', description: 'Passwords do not match.', type: 'error' });
      return;
    }

    try {
      await api.createUser({
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
        isLocked: userForm.isLocked,
      });

      toast({
        title: 'Success',
        description: `User account "${userForm.username}" successfully created.`,
        type: 'success',
      });

      setUserForm({
        username: '',
        password: '',
        confirmPassword: '',
        role: 'VIEWER',
        isLocked: false,
      });
      setIsAddUserOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Creation Failed', description: err.message, type: 'error' });
    }
  };

  const handleToggleLockUser = async (user: User) => {
    if (user.username.toLowerCase() === currentUser.toLowerCase()) {
      toast({ title: 'Operation Prevented', description: 'Action denied: You cannot lock your own logged-in user account.', type: 'error' });
      return;
    }

    const nextLockState = !user.isLocked;
    try {
      await api.updateUser(user.id, { isLocked: nextLockState });
      toast({
        title: nextLockState ? 'Account Locked' : 'Account Unlocked',
        description: `User "${user.username}" is now ${nextLockState ? 'LOCKED' : 'ACTIVE'}.`,
        type: 'info',
      });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err.message, type: 'error' });
    }
  };

  const handleToggleUserRole = async (user: User) => {
    if (user.username.toLowerCase() === currentUser.toLowerCase()) {
      toast({ title: 'Operation Prevented', description: 'Action denied: You cannot alter your own security role.', type: 'error' });
      return;
    }

    const nextRole = user.role === 'ADMIN' ? 'VIEWER' : 'ADMIN';
    try {
      await api.updateUser(user.id, { role: nextRole });
      toast({
        title: 'Role Updated',
        description: `Security role for "${user.username}" updated to ${nextRole}.`,
        type: 'success',
      });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err.message, type: 'error' });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.username.toLowerCase() === currentUser.toLowerCase()) {
      toast({ title: 'Operation Prevented', description: 'Action denied: You cannot delete your own logged-in user account.', type: 'error' });
      return;
    }

    if (!window.confirm(`Are you absolutely sure you want to permanently delete the user account "${user.username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteUser(user.id);
      toast({
        title: 'Account Removed',
        description: `User account "${user.username}" has been deleted.`,
        type: 'success',
      });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Deletion Failed', description: err.message, type: 'error' });
    }
  };

  const handleOpenResetPassword = (user: User) => {
    setResetPasswordForm({
      userId: user.id,
      username: user.username,
      newPassword: '',
      confirmNewPassword: '',
    });
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordForm.newPassword) {
      toast({ title: 'Validation Error', description: 'New password is required.', type: 'error' });
      return;
    }
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmNewPassword) {
      toast({ title: 'Validation Error', description: 'Passwords do not match.', type: 'error' });
      return;
    }

    try {
      await api.updateUser(resetPasswordForm.userId, { password: resetPasswordForm.newPassword });
      setIsResetPasswordModalOpen(false);
      toast({
        title: 'Password Updated',
        description: `Password for "${resetPasswordForm.username}" successfully updated.`,
        type: 'success',
      });
    } catch (err: any) {
      toast({ title: 'Reset Failed', description: err.message, type: 'error' });
    }
  };

  const handleSelfPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfPasswordForm.newPassword) {
      toast({ title: 'Validation Error', description: 'New password is required.', type: 'error' });
      return;
    }
    if (selfPasswordForm.newPassword !== selfPasswordForm.confirmNewPassword) {
      toast({ title: 'Validation Error', description: 'Passwords do not match.', type: 'error' });
      return;
    }

    try {
      const usersList = users.length > 0 ? users : await api.getUsers();
      const match = usersList.find((u) => u.username.toLowerCase() === currentUser.toLowerCase());
      if (!match) throw new Error(`Logged in account "${currentUser}" not found in current directory context.`);

      await api.updateUser(match.id, { password: selfPasswordForm.newPassword });
      setSelfPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      toast({
        title: 'Credentials Updated',
        description: 'Your account password has been successfully changed.',
        type: 'success',
      });
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message, type: 'error' });
    }
  };

  // Collector Endpoint Health State
  const defaultUrl = settings.collectorEndpoint || 'http://localhost:3000/api/collector/mock-health';
  const [collectorUrl, setCollectorUrl] = useState<string>(defaultUrl);
  const [showInfoTips, setShowInfoTips] = useState<boolean>(settings.showInfoTips !== false);
  const [timestampFormat, setTimestampFormat] = useState<string>(settings.timestampFormat || 'HH24:MI:SS DD/MM/YYYY');
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);

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

  // Alert Method Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [editingAlertMethod, setEditingAlertMethod] = useState<AlertNotificationMethodEntity | null>(null);
  const [jsonValidationError, setJsonValidationError] = useState<string | null>(null);
  const [alertForm, setAlertForm] = useState({
    id: '',
    name: '',
    type: 'EMAIL' as AlertMethodType,
    statusOnOff: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    configJsonStr: JSON.stringify({
      smtpHost: 'smtp.mailgun.org',
      smtpPort: 587,
      smtpUser: 'alerts@dbfarm.internal',
      useTls: true,
      fromAddress: 'Database Sentinel <noreply-alerts@dbfarm.internal>',
    }, null, 2),
  });

  const getPresetTemplate = (type: AlertMethodType): string => {
    switch (type) {
      case 'EMAIL':
        return JSON.stringify({
          smtpHost: 'smtp.mailgun.org',
          smtpPort: 587,
          smtpUser: 'alerts@dbfarm.internal',
          useTls: true,
          fromAddress: 'Database Sentinel <noreply-alerts@dbfarm.internal>',
        }, null, 2);
      case 'TELEGRAM':
        return JSON.stringify({
          botToken: '123456789:ABCdefGhIJKlmNoPQRstUVwxyZ',
          apiBaseUrl: 'https://api.telegram.org',
          defaultChatTopic: 'DB_ALERTS',
          parseMode: 'HTML',
        }, null, 2);
      case 'SLACK':
        return JSON.stringify({
          webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
          channelName: '#db-sentinel-alerts',
          username: 'DB Farm Sentinel',
        }, null, 2);
      case 'WEBHOOK':
        return JSON.stringify({
          webhookUrl: 'https://api.incidentmanagement.internal/v1/alerts',
          httpMethod: 'POST',
          headers: {
            'Authorization': 'Bearer YOUR_INTEGRATION_TOKEN_HERE',
            'Content-Type': 'application/json',
          },
        }, null, 2);
      case 'SMS':
        return JSON.stringify({
          provider: 'TWILIO',
          accountSid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          authToken: 'YOUR_AUTH_TOKEN_HERE',
          fromNumber: '+18005550199',
        }, null, 2);
      default:
        return JSON.stringify({
          webhookUrl: 'https://api.incidentmanagement.internal/v1/alerts',
        }, null, 2);
    }
  };

  const handleJsonChange = (text: string) => {
    setAlertForm(prev => ({ ...prev, configJsonStr: text }));
    try {
      if (text.trim()) {
        JSON.parse(text);
      }
      setJsonValidationError(null);
    } catch (e: any) {
      setJsonValidationError(e.message);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(alertForm.configJsonStr);
      const formatted = JSON.stringify(parsed, null, 2);
      setAlertForm(prev => ({ ...prev, configJsonStr: formatted }));
      setJsonValidationError(null);
    } catch (e: any) {
      setJsonValidationError(`Cannot format: ${e.message}`);
    }
  };

  const [testingMethodId, setTestingMethodId] = useState<string | null>(null);

  // Sync state when settings prop updates
  useEffect(() => {
    if (settings.showInfoTips !== undefined) {
      setShowInfoTips(settings.showInfoTips !== false);
    }
    if (settings.collectorEndpoint) {
      setCollectorUrl(settings.collectorEndpoint);
    }
  }, [settings.showInfoTips, settings.collectorEndpoint]);

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
      collectorEndpoint: collectorUrl,
      showInfoTips: nextVal,
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

  // Run Health Check
  const runHealthCheck = async (targetUrl?: string, silent = false) => {
    const urlToTest = targetUrl || collectorUrl;
    if (!urlToTest.trim()) {
      if (!silent) {
        toast({
          title: 'Invalid URL',
          description: 'Please specify a valid Collector API Target Endpoint URL.',
          type: 'error',
        });
      }
      return;
    }

    setIsCheckingHealth(true);
    try {
      const res = await api.checkCollectorHealth(urlToTest);
      setHealthResult(res);

      if (!silent) {
        if (res.isHealthy) {
          toast({
            title: 'Collector Module Healthy',
            description: `HTTP 200 OK response received from ${res.targetUrl} (${res.responseTimeMs}ms).`,
            type: 'success',
          });
        } else {
          toast({
            title: 'Collector Module Unhealthy',
            description: res.message,
            type: 'error',
          });
        }
      }
    } catch (err: any) {
      const fallbackResult: HealthCheckResult = {
        targetUrl: urlToTest,
        statusCode: 0,
        statusText: 'Check Failed',
        isHealthy: false,
        responseTimeMs: 0,
        timestamp: new Date().toISOString(),
        error: err.message || 'Request execution error',
        message: `Health check routine failed to reach endpoint: ${err.message}`,
      };
      setHealthResult(fallbackResult);
      if (!silent) {
        toast({
          title: 'Health Check Failed',
          description: fallbackResult.message,
          type: 'error',
        });
      }
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    runHealthCheck(defaultUrl, true);
  }, []);

  const handleSaveEndpoint = (e: React.FormEvent) => {
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
      collectorEndpoint: collectorUrl,
      showInfoTips: showInfoTips,
      timestampFormat: timestampFormat,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };

    onSaveSettings(updatedSettings);
    toast({
      title: 'Configuration Saved',
      description: 'Collector API Target Endpoint URL updated in central database.',
      type: 'success',
    });

    runHealthCheck(collectorUrl, false);
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

  // --- Alert Notification Method Handlers ---
  const handleOpenAddAlertMethod = () => {
    setEditingAlertMethod(null);
    setJsonValidationError(null);
    setAlertForm({
      id: '',
      name: '',
      type: 'EMAIL',
      statusOnOff: 'ACTIVE',
      configJsonStr: getPresetTemplate('EMAIL'),
    });
    setIsAlertModalOpen(true);
  };

  const handleOpenEditAlertMethod = (method: AlertNotificationMethodEntity) => {
    setEditingAlertMethod(method);
    setJsonValidationError(null);
    setAlertForm({
      id: method.id,
      name: method.name,
      type: method.type,
      statusOnOff: method.statusOnOff || 'ACTIVE',
      configJsonStr: JSON.stringify(method.configJson || {}, null, 2),
    });
    setIsAlertModalOpen(true);
  };

  const handleSaveAlertMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertForm.name.trim()) {
      toast({ title: 'Validation Error', description: 'Dispatcher Name is required.', type: 'error' });
      return;
    }

    let configJson: Record<string, any> = {};
    try {
      configJson = JSON.parse(alertForm.configJsonStr);
    } catch (err: any) {
      setJsonValidationError(err.message);
      toast({
        title: 'Invalid JSON Configuration',
        description: 'Please correct the JSON syntax errors before saving.',
        type: 'error',
      });
      return;
    }

    try {
      await onSaveAlertMethod({
        id: alertForm.id || undefined,
        name: alertForm.name.trim(),
        type: alertForm.type,
        statusOnOff: alertForm.statusOnOff,
        configJson,
      });
      setIsAlertModalOpen(false);
      toast({
        title: editingAlertMethod ? 'Dispatcher Updated' : 'Dispatcher Registered',
        description: `Notification method "${alertForm.name}" (${alertForm.type}) saved.`,
        type: 'success',
      });
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message, type: 'error' });
    }
  };

  const handleToggleAlertMethodStatus = async (method: AlertNotificationMethodEntity) => {
    const nextStatus = method.statusOnOff === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await onSaveAlertMethod({ ...method, statusOnOff: nextStatus });
    toast({
      title: 'Status Updated',
      description: `Notification method "${method.name}" is now ${nextStatus}.`,
      type: 'info',
    });
  };

  const handleTestDispatcher = (method: AlertNotificationMethodEntity) => {
    setTestingMethodId(method.id);
    setTimeout(() => {
      setTestingMethodId(null);
      toast({
        title: 'Synthetic Dispatcher Test Succeeded',
        description: `Dispatched test payload via "${method.name}" (${method.type}). Status: 200 OK Delivered.`,
        type: 'success',
      });
    }, 750);
  };

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Header Banner */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3 text-xs text-slate-600">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">System Settings & Infrastructure Control</div>
            <div>
              Configure collector endpoint health checks, dynamic database engine registries, protocol notification dispatchers, and application-wide preferences.
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
          <span>Collector API & Health</span>
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
          <span>Database Engines Registry</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-100 text-indigo-800 font-mono">
            {databaseEngines.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'alerts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Alert Notification Dispatchers</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-100 text-indigo-800 font-mono">
            {alertMethods.length}
          </span>
        </button>

        <button
          id="btn-tab-manage-accounts"
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Manage Accounts</span>
        </button>
      </div>

      {/* TAB 1: Collector API & UI Preferences */}
      {activeTab === 'collector' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveEndpoint} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5 font-bold text-slate-900 text-base">
                <Activity className="w-5 h-5 text-indigo-600" />
                <span>Collector API Health Check Configuration</span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium hidden sm:inline">Presets:</span>
                <button
                  type="button"
                  onClick={() => setCollectorUrl('http://localhost:3000/api/collector/mock-health')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-[11px] transition-colors cursor-pointer"
                >
                  Mock Local API
                </button>
                <button
                  type="button"
                  onClick={() => setCollectorUrl('https://api-collector.dbfarm.internal/v2/health')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-[11px] transition-colors cursor-pointer"
                >
                  Production Cluster
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-600" />
                Target Endpoint URL
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="url"
                  required
                  disabled={!isAdmin}
                  value={collectorUrl}
                  onChange={(e) => setCollectorUrl(e.target.value)}
                  placeholder="http://localhost:3000/api/collector/mock-health"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 font-mono text-xs sm:text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-70 shadow-2xs"
                />

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => runHealthCheck()}
                    disabled={isCheckingHealth}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>{isCheckingHealth ? 'Running GET Check...' : 'Run Health Check'}</span>
                  </button>

                  {isAdmin ? (
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-md shadow-indigo-600/20 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Endpoint</span>
                    </button>
                  ) : (
                    <div className="text-xs text-slate-500 italic flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Read-Only</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                * The health check routine issues an <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono font-semibold">HTTP GET</code> request to this URL.
                The Collector module is considered <strong className="text-emerald-700">OPERATIONAL / HEALTHY</strong> if and only if the response returns an <code className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1 py-0.5 rounded font-mono font-bold">HTTP 200 OK</code> status code.
              </p>
            </div>

            {/* Health Result Banner */}
            {healthResult && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                  healthResult.isHealthy
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/70 border-rose-200 text-rose-950'
                }`}
              >
                {healthResult.isHealthy ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      {healthResult.isHealthy ? 'Status: 200 OK — Module Operational' : 'Status: Health Check Failed'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      Response: {healthResult.responseTimeMs}ms
                    </span>
                  </div>
                  <div>{healthResult.message}</div>
                  <div className="text-[10px] font-mono text-slate-600">Target: {healthResult.targetUrl}</div>
                </div>
              </div>
            )}

            {/* Interface Preferences Card */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>Info & Guidance Tips Visibility</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Toggle the display of explanatory architecture banners and help tips across all views (default: Visible).
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
                  <span>Global Timestamp Format</span>
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
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60 shadow-2xs"
                >
                  <option value="HH24:MI:SS DD/MM/YYYY">HH24:MI:SS DD/MM/YYYY (14:30:15 22/08/2026)</option>
                  <option value="DD/MM/YYYY HH24:MI:SS">DD/MM/YYYY HH24:MI:SS (22/08/2026 14:30:15)</option>
                  <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss (2026-08-22 14:30:15)</option>
                </select>
              </div>
            </div>
          </div>
        </form>

        {/* Danger Zone Section */}
        <div id="danger-zone-settings" className="bg-red-50/40 border border-red-200 rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div className="font-bold text-red-900 text-base">Danger Zone</div>
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900">Reset All System Data</div>
              <p className="text-[11px] text-slate-600 leading-relaxed max-w-2xl">
                Destructive operation! Deletes all tables and records related to database servers, logical database groups, health monitoring templates, metric threshold configurations, active alert logs, notification dispatch history, and time-series telemetry metrics. Preserves global settings, database engines registry, protocol dispatcher configurations, and audit trail logs.
              </p>
            </div>

            {isAdmin ? (
              <button
                id="btn-reset-all-data"
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset All Data</span>
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

      {/* TAB 3: Alert Notification Dispatchers */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Send className="w-5 h-5 text-indigo-600" />
                  <span>Dynamic Alert Notification Dispatchers</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protocol dispatchers (Email, Telegram Bot, Slack, Webhook) stored dynamically in database table with protocol parameters.
                </p>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenAddAlertMethod}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Notification Dispatcher</span>
                </button>
              )}
            </div>

            {/* Alert Methods Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Dispatcher Name</th>
                    <th className="py-3 px-4">Protocol Type</th>
                    <th className="py-3 px-4">Configuration Summary</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {alertMethods.map((method) => {
                    const cfg = method.configJson || {};
                    let summaryText = '';
                    if (method.type === 'EMAIL') {
                      summaryText = `Host: ${cfg.smtpHost || 'smtp'}:${cfg.smtpPort || 587}, From: ${cfg.fromAddress || 'alerts'}`;
                    } else if (method.type === 'TELEGRAM') {
                      summaryText = `Endpoint: ${cfg.apiBaseUrl || 'https://api.telegram.org'}, Topic: ${cfg.defaultChatTopic || 'ALERTS'}`;
                    } else if (method.type === 'SLACK') {
                      summaryText = `Channel: ${cfg.channelName || '#alerts'}, Webhook: configured`;
                    } else {
                      summaryText = JSON.stringify(cfg);
                    }

                    return (
                      <tr key={method.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {method.name}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                              method.type === 'TELEGRAM'
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : method.type === 'EMAIL'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : method.type === 'SLACK'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {method.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-sm truncate">
                          {summaryText}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => handleToggleAlertMethodStatus(method)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                              method.statusOnOff === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                method.statusOnOff === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {method.statusOnOff || 'ACTIVE'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTestDispatcher(method)}
                              disabled={testingMethodId === method.id}
                              className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                              title="Test Alert Dispatcher"
                            >
                              {testingMethodId === method.id ? 'Testing...' : 'Test Dispatch'}
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAlertMethod(method)}
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                  title="Edit Dispatcher"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Are you sure you want to delete notification method "${method.name}"?`)) {
                                      await onDeleteAlertMethod(method.id);
                                      toast({ title: 'Method Deleted', description: `Dispatcher ${method.name} removed.`, type: 'info' });
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title="Delete Dispatcher"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Manage Accounts */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* Header Description */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">User Accounts & Access Management</h3>
                <p className="text-slate-500 text-xs">
                  Create, lock, configure roles, and manage credentials for directory administrators and system operators.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left/Main Column: Self Update Password or Admin Create User */}
            <div className="space-y-6 lg:col-span-1">
              {/* Account Security: Update Current User Password */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-900 text-sm">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  <span>Update My Password</span>
                </div>
                
                <form onSubmit={handleSelfPasswordSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Logged-In Account
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentUser}
                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold text-slate-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      New Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter new password"
                      value={selfPasswordForm.newPassword}
                      onChange={(e) => setSelfPasswordForm({ ...selfPasswordForm, newPassword: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Confirm New Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Re-type new password"
                      value={selfPasswordForm.confirmNewPassword}
                      onChange={(e) => setSelfPasswordForm({ ...selfPasswordForm, confirmNewPassword: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Password Changes</span>
                  </button>
                </form>
              </div>

              {/* Admin Panel: Add New Account Form */}
              {isAdmin && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-900 text-sm">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <span>Create User Account</span>
                  </div>

                  <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Username (Unique) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. jdoe"
                        value={userForm.username}
                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Security Role *
                      </label>
                      <select
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="VIEWER">VIEWER (Read-Only access)</option>
                        <option value="ADMIN">ADMIN (Full administrative access)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Initial Password *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Enter secure password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Confirm Initial Password *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Re-type initial password"
                        value={userForm.confirmPassword}
                        onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register User Account</span>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Right Column: Existing Accounts Directory List (Admin Only) */}
            <div className="lg:col-span-2 space-y-6">
              {isAdmin ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>User Accounts Directory ({users.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchUsers}
                      className="text-xs text-indigo-600 hover:text-indigo-500 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                      <span>Refresh Directory</span>
                    </button>
                  </div>

                  {isLoadingUsers ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-xs text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                      <span>Synchronizing credentials directory...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-mono text-[10px]">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Username</th>
                            <th className="px-4 py-3 font-semibold">Security Role</th>
                            <th className="px-4 py-3 font-semibold">Account Status</th>
                            <th className="px-4 py-3 font-semibold">Created Date</th>
                            <th className="px-4 py-3 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {users.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                                No registered user accounts found in credentials directory.
                              </td>
                            </tr>
                          ) : (
                            users.map((user) => {
                              const isSelf = user.username.toLowerCase() === currentUser.toLowerCase();
                              return (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3.5">
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <span>{user.username}</span>
                                      {isSelf && (
                                        <span className="text-[9px] bg-slate-100 text-slate-500 font-mono px-1 py-0.2 rounded">
                                          CURRENT
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <button
                                      type="button"
                                      disabled={isSelf}
                                      onClick={() => handleToggleUserRole(user)}
                                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1 transition-all ${
                                        user.role === 'ADMIN'
                                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                                      } ${isSelf ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                                      title={isSelf ? "You cannot demote yourself" : "Click to toggle role"}
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      {user.role}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <button
                                      type="button"
                                      disabled={isSelf}
                                      onClick={() => handleToggleLockUser(user)}
                                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1.5 transition-all ${
                                        user.isLocked
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                      } ${isSelf ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                                      title={isSelf ? "You cannot lock yourself out" : "Click to toggle account lock"}
                                    >
                                      {user.isLocked ? (
                                        <>
                                          <Lock className="w-3 h-3" />
                                          <span>LOCKED</span>
                                        </>
                                      ) : (
                                        <>
                                          <Unlock className="w-3 h-3" />
                                          <span>ACTIVE</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenResetPassword(user)}
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                        title="Reset User Password"
                                      >
                                        <KeyRound className="w-3.5 h-3.5" />
                                      </button>
                                      
                                      <button
                                        type="button"
                                        disabled={isSelf}
                                        onClick={() => handleDeleteUser(user)}
                                        className={`p-1.5 rounded-md transition-colors ${
                                          isSelf
                                            ? 'text-slate-300 cursor-not-allowed'
                                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                        }`}
                                        title={isSelf ? "You cannot delete your own account" : "Delete User Account"}
                                      >
                                        <UserX className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-2">
                  <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-slate-800 text-sm">Security Policy Restriction</h4>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    Directory administration is restricted to System Administrators. Operations Viewers can update their own security passwords on the left panel.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Reset User Password Modal */}
      <Dialog
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={`Reset Password for "${resetPasswordForm.username}"`}
        description="Establish a new system password for this user account. The change takes effect immediately."
        maxWidth="md"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              New Secure Password *
            </label>
            <input
              type="password"
              required
              placeholder="Enter new password"
              value={resetPasswordForm.newPassword}
              onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Confirm Secure Password *
            </label>
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={resetPasswordForm.confirmNewPassword}
              onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmNewPassword: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors shadow-2xs cursor-pointer"
            >
              Update Password
            </button>
          </div>
        </form>
      </Dialog>

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

      {/* Alert Method Modal */}
      <Dialog
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        title={editingAlertMethod ? 'Edit Alert Notification Method' : 'Register Alert Notification Method'}
        description="Configure generic Raw JSON parameters (API keys, webhooks, SMTP) persisted directly in config_json."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveAlertMethodSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">
                Dispatcher Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Corporate SMTP Dispatcher"
                value={alertForm.name}
                onChange={(e) => setAlertForm({ ...alertForm, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Channel Type *
              </label>
              <select
                value={alertForm.type}
                onChange={(e) => {
                  const newType = e.target.value as AlertMethodType;
                  setAlertForm(prev => ({
                    ...prev,
                    type: newType,
                    configJsonStr: getPresetTemplate(newType),
                  }));
                  setJsonValidationError(null);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                <option value="EMAIL">EMAIL (SMTP Relay)</option>
                <option value="TELEGRAM">TELEGRAM (Bot API)</option>
                <option value="SLACK">SLACK (Webhook API)</option>
                <option value="WEBHOOK">CUSTOM WEBHOOK (HTTP POST)</option>
                <option value="SMS">SMS GATEWAY</option>
              </select>
            </div>
          </div>

          {/* Raw JSON Configuration Editor */}
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-100 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-white text-xs">Raw JSON Configuration Editor (config_json)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Format JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleJsonChange(getPresetTemplate(alertForm.type));
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors cursor-pointer"
                >
                  Reset Template
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={alertForm.configJsonStr}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-indigo-500 selection:bg-indigo-600/40 leading-relaxed"
              placeholder='{ "key": "value" }'
              spellCheck={false}
            />

            {jsonValidationError ? (
              <div className="flex items-center gap-2 text-rose-400 text-[11px] bg-rose-950/50 p-2 rounded-lg border border-rose-800/60 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>JSON Syntax Error: {jsonValidationError}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid JSON Payload Schema
                </span>
                <span>Direct Persistence to `config_json`</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Dispatcher Status</label>
            <select
              value={alertForm.statusOnOff}
              onChange={(e) => setAlertForm({ ...alertForm, statusOnOff: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAlertModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!jsonValidationError}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-colors shadow-2xs cursor-pointer"
            >
              {editingAlertMethod ? 'Save Dispatcher Changes' : 'Register Dispatcher'}
            </button>
          </div>
        </form>
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
    </div>
  );
};
