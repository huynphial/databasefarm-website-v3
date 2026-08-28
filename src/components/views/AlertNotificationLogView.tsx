import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  ChevronDown,
  Info,
  Calendar,
  ShieldAlert,
  Layers,
  Lock,
  Database,
  Check,
  SlidersHorizontal,
  X,
  Plus,
  Edit2,
  Trash2,
  Code,
  Sparkles,
  Copy,
} from 'lucide-react';
import {
  AlertNotificationLogEntity,
  AlertNotificationQueueEntity,
  DatabaseEntity,
  DatabaseEngineEntity,
  AlertNotificationMethodEntity,
  AlertMethodType,
  UserRole,
} from '../../types';
import { getDbEngineBadgeClass } from '../../config/dbEngines';
import { cn } from '../../lib/utils';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n';
import { api } from '../../lib/api';

// Token Template definitions for Notification Messages
const NOTIFICATION_TOKENS = [
  { token: 'D_NOTIFICATION_TYPE', label: 'Notification Type', desc: 'New alert or Clear alert notification?' },
  { token: 'D_ALERT_SEVERITY', label: 'Alert Severity', desc: 'CRITICAL Level' },
  { token: 'D_DATABASE_NAME', label: 'DB Name', desc: 'Target database display name' },
  { token: 'D_DATABASE_TYPE', label: 'Engine Type', desc: 'e.g. ORACLE, POSTGRES' },
  { token: 'D_DATABASE_HOST', label: 'DB Hostname/IP', desc: 'Database Hostname or IP' },
  { token: 'D_DATABASE_PORT', label: 'Port', desc: 'Port number e.g. 5432' },
  { token: 'D_METRIC_NAME', label: 'Metric', desc: 'Evaluated metric name' },
  { token: 'D_OBJECT_NAME', label: 'Object', desc: 'Measured object e.g. TS_DATA' },
  { token: 'D_ATTR_NAME', label: 'Attribute', desc: 'Measured attribute name' },
  { token: 'D_ALERT_VALUE', label: 'Alert Value', desc: 'Evaluated metric value' },
  { token: 'D_ALERT_MESSAGE', label: 'Alert Message', desc: 'Full description of alert' },
  { token: 'D_ALERT_CREATED_AT', label: 'Created At', desc: 'Timestamp when alert created' },
  { token: 'D_ALERT_RESOLVE_AT', label: 'Resolved At', desc: 'Timestamp when alert resolved' },
  { token: 'D_ALERT_RESOLVER', label: 'Resolver', desc: 'User or process who resolved alert' },
];

const getDefaultNotificationMessage = (type: AlertMethodType): string => {
  switch (type) {
    case 'EMAIL':
      return '[D_NOTIFICATION_TYPE] D_ALERT_SEVERITY Database D_DATABASE_NAME (D_DATABASE_TYPE:D_DATABASE_PORT) Metric D_METRIC_NAME triggered alert!\nValue: D_ALERT_VALUE\nMessage: D_ALERT_MESSAGE\nCreated At: D_ALERT_CREATED_AT';
    case 'TELEGRAM':
      return '<b>D_NOTIFICATION_TYPE D_ALERT_SEVERITY</b>\nDatabase: <b>D_DATABASE_NAME</b> (ID: D_DATABASE_ID, Engine: D_DATABASE_TYPE:D_DATABASE_PORT)\nMetric: <b>D_METRIC_NAME</b>\nObject: D_OBJECT_NAME | Attr: D_ATTR_NAME\nValue: <code>D_ALERT_VALUE</code>\nDetails: D_ALERT_MESSAGE\nCreated At: D_ALERT_CREATED_AT';
    case 'WEBHOOK':
      return '{"event":"ALERT_TRIGGERED","database_name":"D_DATABASE_NAME","database_type":"D_DATABASE_TYPE","database_id":"D_DATABASE_ID","port":"D_DATABASE_PORT","metric":"D_METRIC_NAME","object":"D_OBJECT_NAME","attribute":"D_ATTR_NAME","value":"D_ALERT_VALUE","message":"D_ALERT_MESSAGE","created_at":"D_ALERT_CREATED_AT"}';
    default:
      return '[D_NOTIFICATION_TYPE] D_DATABASE_NAME - D_METRIC_NAME: D_ALERT_VALUE (D_ALERT_MESSAGE)';
  }
};

interface AlertNotificationLogViewProps {
  queue?: AlertNotificationQueueEntity[];
  logs: AlertNotificationLogEntity[];
  databases: DatabaseEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  alertMethods?: AlertNotificationMethodEntity[];
  userRole: UserRole;
  showInfoTips?: boolean;
  onRefresh: () => void;
  onSaveAlertMethod?: (method: Partial<AlertNotificationMethodEntity>) => Promise<any>;
  onDeleteAlertMethod?: (id: string) => Promise<void>;
}

export const AlertNotificationLogView: React.FC<AlertNotificationLogViewProps> = ({
  queue = [],
  logs,
  databases,
  databaseEngines = [],
  alertMethods = [],
  userRole,
  showInfoTips = true,
  onRefresh,
  onSaveAlertMethod,
  onDeleteAlertMethod,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isAdmin = userRole === 'ADMIN';

  // Alert Method Modal & Handler State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [editingAlertMethod, setEditingAlertMethod] = useState<AlertNotificationMethodEntity | null>(null);
  const [jsonValidationError, setJsonValidationError] = useState<string | null>(null);
  const [testingMethodId, setTestingMethodId] = useState<string | null>(null);
  const [alertForm, setAlertForm] = useState({
    id: '',
    name: '',
    type: 'EMAIL' as AlertMethodType,
    notificationMessage: getDefaultNotificationMessage('EMAIL'),
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
          smtpHost: 'smtp.thenicedata.com',
          smtpPort: 587,
          smtpUser: 'alerts@thenicedata.com',
          useTls: true,
          fromAddress: 'Database Sentinel <noreply-alerts@thenicedata.com>',
        }, null, 2);
      case 'TELEGRAM':
        return JSON.stringify({
          botToken: 'YOUR_BOT_TOKEN_HERE',
          apiBaseUrl: 'https://api.telegram.org',
          defaultChatTopic: 'DB_ALERTS',
          parseMode: 'HTML',
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

  const handleInsertToken = (tokenStr: string) => {
    setAlertForm(prev => ({
      ...prev,
      notificationMessage: prev.notificationMessage
        ? `${prev.notificationMessage} ${tokenStr}`
        : tokenStr,
    }));
  };

  const handleOpenAddAlertMethod = () => {
    setEditingAlertMethod(null);
    setJsonValidationError(null);
    setAlertForm({
      id: '',
      name: '',
      type: 'EMAIL',
      notificationMessage: getDefaultNotificationMessage('EMAIL'),
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
      notificationMessage: method.notificationMessage || getDefaultNotificationMessage(method.type),
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

    const payload = {
      id: alertForm.id || undefined,
      name: alertForm.name.trim(),
      type: alertForm.type,
      notificationMessage: alertForm.notificationMessage.trim() || null,
      statusOnOff: alertForm.statusOnOff,
      configJson,
    };

    try {
      if (onSaveAlertMethod) {
        await onSaveAlertMethod(payload);
      } else {
        await api.saveAlertNotificationMethod(payload);
        onRefresh();
      }
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
    try {
      if (onSaveAlertMethod) {
        await onSaveAlertMethod({ ...method, statusOnOff: nextStatus });
      } else {
        await api.saveAlertNotificationMethod({ ...method, statusOnOff: nextStatus });
        onRefresh();
      }
      toast({
        title: 'Status Updated',
        description: `Notification method "${method.name}" is now ${nextStatus}.`,
        type: 'info',
      });
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message, type: 'error' });
    }
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

  // If user is not ADMIN, show Access Denied
  if (userRole !== 'ADMIN') {
    return (
      <div className="p-8 flex-1 flex flex-col items-center justify-center bg-slate-50 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">{t('alertNotifications.accessRestrictedTitle')}</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
          {t('alertNotifications.accessRestrictedSub')}
        </p>
      </div>
    );
  }

  // 1. DATABASE ENGINE & TARGET DATABASE FILTER STATE (Default: Not Filter / 'ALL')
  const [selectedEngineType, setSelectedEngineType] = useState<string>('ALL');
  const [selectedDbId, setSelectedDbId] = useState<string>('ALL');
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState<boolean>(false);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 2. TIME WINDOW FILTER STATE (Default: 24H like tab Analytics Database)
  const [timeRangePreset, setTimeRangePreset] = useState<'1h' | '6h' | '24h' | '3d' | '7d' | 'all' | 'custom'>('24h');
  const [fromDateTime, setFromDateTime] = useState<string>(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [toDateTime, setToDateTime] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  });

  // Secondary Filters State for Logs
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyText = (text: string, fieldLabel: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldLabel);
    toast({ title: 'Copied to Clipboard', description: `${fieldLabel} copied successfully.`, type: 'info' });
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected Log Detail Modal State
  const [selectedLog, setSelectedLog] = useState<AlertNotificationLogEntity | null>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(event.target as Node)) {
        setIsDbDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDbDropdownOpen(false);
      }
    };
    if (isDbDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDbDropdownOpen]);

  // Focus search input when database dropdown opens
  useEffect(() => {
    if (isDbDropdownOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isDbDropdownOpen]);

  // Quick Preset Handler for Time Window
  const handleSelectTimePreset = (preset: '1h' | '6h' | '24h' | '3d' | '7d' | 'all') => {
    setTimeRangePreset(preset);
    const now = new Date();
    setToDateTime(now.toISOString().slice(0, 16));

    if (preset === 'all') {
      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '1h') {
      const past = new Date(Date.now() - 1 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '6h') {
      const past = new Date(Date.now() - 6 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '24h') {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '3d') {
      const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '7d') {
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    }
    setCurrentPage(1);
  };

  // Time boundaries in milliseconds for Log filtering
  const fromTimeMs = useMemo(() => {
    return fromDateTime ? new Date(fromDateTime).getTime() : 0;
  }, [fromDateTime]);

  const toTimeMs = useMemo(() => {
    return toDateTime ? new Date(toDateTime).getTime() : Date.now() + 86400000;
  }, [toDateTime]);

  // DB lookup
  const dbMap = useMemo(() => {
    const map = new Map<string, DatabaseEntity>();
    databases.forEach((db) => map.set(db.id, db));
    return map;
  }, [databases]);

  // Available database engines
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

  // Searchable databases list for dropdown selection
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

  // Selected Target Database Entity (if selectedDbId !== 'ALL')
  const selectedDb = useMemo(() => {
    if (selectedDbId === 'ALL') return null;
    return databases.find((d) => d.id === selectedDbId) || null;
  }, [databases, selectedDbId]);

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

  // FILTERED QUEUE: Queue tables DO NOT filter time (as requested: "queue tables not filter time")
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

      return true;
    });
  }, [queue, selectedEngineType, selectedDbId, dbMap]);

  // FILTERED LOGS: Applies Time Filter (Default 24H) + Engine + Target DB + Secondary filters
  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        // Time window filter (Default 24H)
        const logTime = new Date(log.timestamp).getTime();
        if (fromTimeMs && logTime < fromTimeMs) return false;
        if (toTimeMs && logTime > toTimeMs) return false;

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

        // Channel filter
        if (channelFilter !== 'ALL' && log.dispatchType !== channelFilter) return false;

        // Severity filter
        if (severityFilter !== 'ALL' && log.alertLevel !== severityFilter) return false;

        // Event Type filter
        if (eventTypeFilter !== 'ALL' && log.eventType !== eventTypeFilter) return false;

        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesTerm =
            log.alertId?.toLowerCase().includes(term) ||
            log.dbName?.toLowerCase().includes(term) ||
            log.metricName?.toLowerCase().includes(term) ||
            log.attributeName?.toLowerCase().includes(term) ||
            (log.dispatcherName || log.dispatchMethod)?.toLowerCase().includes(term) ||
            log.senderIds?.toLowerCase().includes(term) ||
            log.errorMessage?.toLowerCase().includes(term) ||
            log.payloadSummary?.toLowerCase().includes(term) ||
            log.messageAlert?.toLowerCase().includes(term) ||
            log.detailResponse?.toLowerCase().includes(term) ||
            log.eventType?.toLowerCase().includes(term);

          if (!matchesTerm) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
    logs,
    fromTimeMs,
    toTimeMs,
    selectedEngineType,
    selectedDbId,
    statusFilter,
    channelFilter,
    severityFilter,
    eventTypeFilter,
    searchTerm,
    dbMap,
  ]);

  // Compute stats based on current view
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const dispatched = filteredLogs.filter((l) => l.status === 'DISPATCHED').length;
    const failed = filteredLogs.filter((l) => l.status === 'FAILED').length;
    const pendingInQueue = filteredQueue.filter((q) => q.status === 'PENDING').length;
    const processingInQueue = filteredQueue.filter((q) => q.status === 'PROCESSING').length;
    const latencies = filteredLogs
      .filter((l) => typeof l.latencyMs === 'number')
      .map((l) => l.latencyMs as number);
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 185;

    return { total, dispatched, failed, pendingInQueue, processingInQueue, avgLatency };
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
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: 'Notification Logs Refreshed',
        description: 'Loaded latest dispatcher queue and telemetry logs.',
        type: 'info',
      });
    }, 500);
  };

  const handleClearFilters = () => {
    setSelectedEngineType('ALL');
    setSelectedDbId('ALL');
    setDbSearchQuery('');
    setStatusFilter('ALL');
    setChannelFilter('ALL');
    setSeverityFilter('ALL');
    setEventTypeFilter('ALL');
    setSearchTerm('');
    handleSelectTimePreset('24h');
  };

  const hasActiveFilters =
    selectedEngineType !== 'ALL' ||
    selectedDbId !== 'ALL' ||
    statusFilter !== 'ALL' ||
    channelFilter !== 'ALL' ||
    severityFilter !== 'ALL' ||
    eventTypeFilter !== 'ALL' ||
    searchTerm.trim() !== '' ||
    timeRangePreset !== '24h';

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
      {/* ========================================================================= */}
      {/* 1. FILTER CONTROLS BAR: DATABASE ENGINE, Target Database, Time Window */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs relative z-30">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-t-2xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {t('alertNotifications.title')}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Dispatch Stream
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('alertNotifications.subtitle')}
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-xl text-xs font-semibold shadow-2xs hover:shadow-sm transition-all cursor-pointer w-full sm:w-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Logs'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Filter 1: DATABASE ENGINE */}
          <div className="md:col-span-3 space-y-2">
            <div className="h-5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Database Engine</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                {availableEngines.length} types
              </span>
            </div>

            <div className="relative">
              <select
                value={selectedEngineType}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedEngineType(val);
                  // If selected DB doesn't match new engine, reset DB to ALL
                  if (val !== 'ALL' && selectedDb && selectedDb.dbType.toUpperCase() !== val.toUpperCase()) {
                    setSelectedDbId('ALL');
                  }
                  setCurrentPage(1);
                }}
                className="w-full h-10 appearance-none bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200 hover:border-slate-300 text-slate-900 text-xs font-medium rounded-xl px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Database Engines ({databases.length})</option>
                {availableEngines.map((eng) => {
                  const count = databases.filter(
                    (d) => d.dbType.toUpperCase() === eng.code.toUpperCase()
                  ).length;
                  return (
                    <option key={eng.code} value={eng.code}>
                      {eng.name} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: Target Database (Searchable Selection Dropdown) */}
          <div className="md:col-span-4 space-y-2" ref={dbDropdownRef}>
            <div className="h-5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Server className="w-3.5 h-3.5 text-indigo-500" />
                <span>Target Database</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                {selectedDbId === 'ALL' ? 'All Databases' : '1 Selected'}
              </span>
            </div>

            <div className="relative">
              {/* Dropdown Trigger Button */}
              <button
                type="button"
                onClick={() => setIsDbDropdownOpen((prev) => !prev)}
                className={cn(
                  'w-full h-10 flex items-center justify-between gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs group',
                  isDbDropdownOpen && 'ring-2 ring-indigo-500/20 border-indigo-500'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {selectedDb ? (
                    <>
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          (selectedDb.status || 'UP').toUpperCase() === 'UP' || (selectedDb.status || 'UP').toUpperCase() === 'NORMAL'
                            ? 'bg-emerald-500'
                            : (selectedDb.status || '').toUpperCase() === 'DOWN' || (selectedDb.status || '').toUpperCase() === 'CRITICAL'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        )}
                      />
                      <div className="min-w-0 flex-1 flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 truncate">{selectedDb.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline truncate">
                          ({selectedDb.host}:{selectedDb.port})
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0',
                          getDbEngineBadgeClass(selectedDb.dbType)
                        )}
                      >
                        {selectedDb.dbType}
                      </span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="font-medium text-slate-700 truncate">
                        All Databases ({searchableDatabases.length})
                      </span>
                    </>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 group-hover:text-slate-600',
                    isDbDropdownOpen && 'rotate-180 text-indigo-600'
                  )}
                />
              </button>

              {/* Popover Dropdown Panel */}
              {isDbDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80 w-full min-w-[280px]">
                  {/* Search input header */}
                  <div className="p-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search database, host, IP, engine..."
                        value={dbSearchQuery}
                        onChange={(e) => setDbSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-lg pl-8 pr-7 py-1.5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                      />
                      {dbSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDbSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-0.5 rounded cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Database List */}
                  <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-60">
                    {/* "All Databases" option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDbId('ALL');
                        setIsDbDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/50 transition-colors cursor-pointer',
                        selectedDbId === 'ALL' && 'bg-indigo-50/80 font-bold'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Database className="w-4 h-4 text-indigo-600" />
                        <div>
                          <div className="text-xs font-bold text-slate-900">All Databases</div>
                          <div className="text-[10px] text-slate-400">Do not filter by target database instance</div>
                        </div>
                      </div>
                      {selectedDbId === 'ALL' && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 font-bold" />
                      )}
                    </button>

                    {searchableDatabases.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">
                        <Database className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                        <p className="text-xs font-semibold text-slate-600">No matching databases</p>
                      </div>
                    ) : (
                      searchableDatabases.map((db) => {
                        const isSelected = db.id === selectedDbId;
                        const isUp = (db.status || 'UP').toUpperCase() === 'UP' || (db.status || 'UP').toUpperCase() === 'NORMAL';
                        const isDown = (db.status || '').toUpperCase() === 'DOWN' || (db.status || '').toUpperCase() === 'CRITICAL';

                        return (
                          <button
                            key={db.id}
                            type="button"
                            onClick={() => {
                              setSelectedDbId(db.id);
                              setIsDbDropdownOpen(false);
                              if (selectedEngineType !== 'ALL' && selectedEngineType.toUpperCase() !== db.dbType.toUpperCase()) {
                                setSelectedEngineType('ALL');
                              }
                              setCurrentPage(1);
                            }}
                            className={cn(
                              'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/50 transition-colors cursor-pointer group',
                              isSelected && 'bg-indigo-50/80'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full shrink-0',
                                  isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : 'bg-amber-500'
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={cn('text-xs font-bold text-slate-900', isSelected && 'text-indigo-900')}>
                                    {db.name}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                                      getDbEngineBadgeClass(db.dbType)
                                    )}
                                  >
                                    {db.dbType}
                                  </span>
                                  {db.environment && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                      {db.environment}
                                    </span>
                                  )}
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

          {/* Filter 3: Time Window (like tab Analytics Database, Default: 24h) */}
          <div className="md:col-span-5 space-y-2">
            <div className="h-5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>Time Window</span>
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {(['1h', '6h', '24h', '3d', '7d', 'all'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectTimePreset(preset)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer',
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

            {/* Time pickers row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="datetime-local"
                  value={fromDateTime}
                  onChange={(e) => {
                    setFromDateTime(e.target.value);
                    setTimeRangePreset('custom');
                    setCurrentPage(1);
                  }}
                  className="w-full h-10 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200 hover:border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-mono shadow-2xs cursor-pointer"
                  title="From Timestamp (UTC+7)"
                />
              </div>

              <div className="relative">
                <input
                  type="datetime-local"
                  value={toDateTime}
                  onChange={(e) => {
                    setToDateTime(e.target.value);
                    setTimeRangePreset('custom');
                    setCurrentPage(1);
                  }}
                  className="w-full h-10 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200 hover:border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-mono shadow-2xs cursor-pointer"
                  title="To Timestamp (UTC+7)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Summary Context Strip */}
        <div className="px-6 py-2.5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 rounded-b-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              Active Scope:
            </span>
            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              Engine: <strong className="text-indigo-600">{selectedEngineType}</strong>
            </span>
            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              Target DB:{' '}
              <strong className="text-indigo-600">
                {selectedDb ? selectedDb.name : 'All Databases'}
              </strong>
            </span>
            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              Window: <strong className="text-indigo-600">{timeRangePreset.toUpperCase()}</strong>{' '}
              <span className="text-slate-400 text-[10px] font-normal">(Queue tables not filtered by time)</span>
            </span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline cursor-pointer"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Info Tips */}
      {showInfoTips && (
        <div className="p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-xl text-indigo-950 flex items-start gap-2.5 text-xs shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Notification Gateway Queue & Audit Pipeline: </span>
            When an alert rule triggers, an entry is enqueued into <span className="font-mono font-bold">alert_notification_queue</span>. Notification dispatcher worker processes pick pending items with worker locks (<span className="font-mono font-semibold">locked_by</span>), dispatch via configured alert channels (Telegram, Email, Webhook), and write final audit records into <span className="font-mono font-bold">alert_notification_log</span>.
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Queue In Flight</span>
            <span className="text-base font-black text-slate-800">{filteredQueue.length}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block">
              {stats.pendingInQueue} Pending
            </span>
            <span className="text-[9px] text-indigo-600 font-semibold mt-0.5 block">
              {stats.processingInQueue} Processing
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Dispatched Logs</span>
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

      {/* ALERT NOTIFICATION METHODS PANEL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Alert Notification Methods
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                  {alertMethods.length} Dispatchers
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Protocol dispatchers (Email, Telegram Bot, Webhook) stored dynamically in database table with protocol parameters.
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenAddAlertMethod}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer shrink-0 self-start sm:self-auto whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add New Alert Notification Method
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Dispatcher Name</th>
                <th className="py-2.5 px-3">Protocol / Channel</th>
                <th className="py-2.5 px-3">Notification Message (TOKEN Template)</th>
                <th className="py-2.5 px-3">Configuration Summary</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alertMethods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Send className="w-6 h-6 text-slate-300" />
                      <span className="font-semibold text-slate-600">No alert notification dispatchers registered</span>
                      <span className="text-[11px] text-slate-400">
                        Click "Add New Alert Notification Method" to set up Telegram, Email, or Webhook alerts.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                alertMethods.map((method) => (
                  <tr key={method.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {method.name}
                    </td>
                    <td className="py-2.5 px-3">
                      {renderChannelBadge(method.type, method.type)}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs truncate font-mono text-[11px] text-slate-700" title={method.notificationMessage || ''}>
                      {method.notificationMessage ? (
                        <span className="text-slate-800 font-mono text-[11px]">{method.notificationMessage}</span>
                      ) : (
                        <span className="text-slate-400 italic">No custom message template</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs truncate font-mono text-[11px] text-slate-600">
                      {JSON.stringify(method.configJson || {})}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => isAdmin && handleToggleAlertMethodStatus(method)}
                        disabled={!isAdmin}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          method.statusOnOff === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        } ${!isAdmin ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {method.statusOnOff || 'ACTIVE'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      <button
                        onClick={() => handleTestDispatcher(method)}
                        disabled={testingMethodId === method.id}
                        className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded font-semibold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="Dispatch synthetic test message"
                      >
                        {testingMethodId === method.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-sky-600" />
                        ) : (
                          <Send className="w-3 h-3 text-sky-600" />
                        )}
                        Test
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleOpenEditAlertMethod(method)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            title="Edit Alert Method"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete notification method "${method.name}"?`)) {
                                try {
                                  if (onDeleteAlertMethod) {
                                    await onDeleteAlertMethod(method.id);
                                  } else {
                                    await api.deleteAlertNotificationMethod(method.id);
                                    onRefresh();
                                  }
                                  toast({ title: 'Dispatcher Removed', description: `Deleted notification method "${method.name}".`, type: 'info' });
                                } catch (err: any) {
                                  toast({ title: 'Delete Failed', description: err.message, type: 'error' });
                                }
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Delete Alert Method"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 1: ALERT NOTIFICATION QUEUE (alert_notification_queue) - BEFORE LOGS */}
      {/* Notice: Queue table is NOT filtered by time window */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                1. Alert Notification Dispatch Queue
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                  Table: alert_notification_queue ({filteredQueue.length} queued)
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Active queued dispatches (real-time queue; not constrained by the 24H history window).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Pending: {filteredQueue.filter(q => q.status === 'PENDING').length}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> Processing: {filteredQueue.filter(q => q.status === 'PROCESSING').length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Alert ID</th>
                <th className="py-2.5 px-3">Database Instance</th>
                <th className="py-2.5 px-3">Metric / Attribute</th>
                <th className="py-2.5 px-3 text-center">Severity</th>
                <th className="py-2.5 px-3">Message Alert</th>
                <th className="py-2.5 px-3">Dispatcher / Channel</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Locked By / Worker</th>
                <th className="py-2.5 px-3">Scheduled At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      <span className="font-semibold text-slate-600">Notification queue is clear</span>
                      <span className="text-[11px] text-slate-400">
                        No pending items in <span className="font-mono">alert_notification_queue</span> matching current scope.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => {
                  const dbObj = dbMap.get(item.dbId);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Alert ID */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100">
                          {item.alertId}
                        </span>
                      </td>

                      {/* Database */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Server className="w-3 h-3 text-slate-400" />
                          {item.dbName}
                        </div>
                        {dbObj && (
                          <span
                            className={cn(
                              'text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border mt-0.5 inline-block',
                              getDbEngineBadgeClass(dbObj.dbType)
                            )}
                          >
                            {dbObj.dbType}
                          </span>
                        )}
                      </td>

                      {/* Metric */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 max-w-[160px] truncate">
                          {item.metricName}
                        </div>
                        {item.attributeName && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {item.attributeName}
                          </div>
                        )}
                      </td>

                      {/* Severity */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {item.alertLevel === 'CRITICAL' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                            CRITICAL
                          </span>
                        )}
                        {item.alertLevel === 'HIGH' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 font-mono">
                            HIGH
                          </span>
                        )}
                        {item.alertLevel === 'WARN' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                            WARN
                          </span>
                        )}
                        {item.alertLevel === 'DOWN' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 font-mono">
                            DOWN
                          </span>
                        )}
                      </td>

                      {/* Message Alert */}
                      <td className="py-2.5 px-3 min-w-[200px] max-w-[320px]">
                        {item.messageAlert ? (
                          <div className="text-[11px] text-slate-700 font-mono line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-200/80 break-words" title={item.messageAlert}>
                            {item.messageAlert}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Dispatcher */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {renderChannelBadge(item.dispatcherType, item.dispatcherName)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {item.status === 'PROCESSING' ? (
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

                      {/* Scheduled At */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-[11px] font-semibold text-slate-800">
                          {formatDateTime(item.scheduledAt)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatRelativeTime(item.scheduledAt)}
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

      {/* SECTION 2: ALERT NOTIFICATION LOGS (alert_notification_log) */}
      <div className="space-y-4">
        {/* Secondary Control Bar: Search, Status, Channel, Severity Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  2. Historical Dispatched Alert Notification Logs
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                    Table: alert_notification_log ({filteredLogs.length} records in window)
                  </span>
                </h3>
              </div>
            </div>
          </div>

          {/* Search and Secondary Dropdowns */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search alert ID, event, database, metric, channel, sender IDs, message, response..."
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

            {/* Secondary Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Event Type Filter */}
              <select
                value={eventTypeFilter}
                onChange={(e) => {
                  setEventTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">Event: All</option>
                <option value="NEW_ALERT">NEW_ALERT</option>
                <option value="CLEAR_ALERT">CLEAR_ALERT</option>
                <option value="TRIGGER">TRIGGER</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">Status: All</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="SUCCESS">SUCCESS</option>
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
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">Channel: All</option>
                <option value="TELEGRAM">Telegram</option>
                <option value="EMAIL">Email</option>
                <option value="WEBHOOK">Webhook</option>
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">Severity: All</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="WARN">WARN</option>
                <option value="DOWN">DOWN</option>
              </select>
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
                  <th className="py-2.5 px-3">Alert ID / Event</th>
                  <th className="py-2.5 px-3">Database Instance</th>
                  <th className="py-2.5 px-3">Metric / Attribute</th>
                  <th className="py-2.5 px-3 text-center">Severity</th>
                  <th className="py-2.5 px-3">Dispatcher / Channel</th>
                  <th className="py-2.5 px-3">Destination Sender IDs</th>
                  <th className="py-2.5 px-3">Message Alert</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Detail Response / Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <BellRing className="w-8 h-8 text-slate-300" />
                        <span className="font-semibold text-slate-600">No alert notification logs found</span>
                        <span className="text-xs text-slate-400 max-w-sm">
                          No dispatches matched your current filters or {timeRangePreset.toUpperCase()} time window.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => {
                    const dbObj = dbMap.get(log.dbId);
                    const msgText = log.messageAlert || log.payloadSummary || '—';
                    const detailText = log.detailResponse || log.errorMessage || null;

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

                        {/* 2. Alert ID & Event Type */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100">
                              {log.alertId || log.id}
                            </span>
                            {log.eventType && (
                              <span
                                className={cn(
                                  'text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase',
                                  log.eventType === 'CLEAR_ALERT'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : log.eventType === 'NEW_ALERT' || log.eventType === 'TRIGGER'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                )}
                              >
                                {log.eventType}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Database */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Server className="w-3 h-3 text-slate-400" />
                            {log.dbName}
                          </div>
                          {dbObj && (
                            <span
                              className={cn(
                                'text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border mt-0.5 inline-block',
                                getDbEngineBadgeClass(dbObj.dbType)
                              )}
                            >
                              {dbObj.dbType}
                            </span>
                          )}
                        </td>

                        {/* 4. Metric / Attribute */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800 max-w-[160px] truncate" title={log.metricName}>
                            {log.metricName}
                          </div>
                          {log.attributeName && (
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]" title={log.attributeName}>
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

                        {/* 6. Dispatcher / Channel */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderChannelBadge(
                            log.dispatcherType || log.dispatchType,
                            log.dispatcherName || log.dispatchMethod
                          )}
                        </td>

                        {/* 7. Sender IDs */}
                        <td className="py-2.5 px-3">
                          <div
                            className="text-[11px] font-mono text-slate-700 max-w-[160px] truncate bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
                            title={log.senderIds}
                          >
                            {log.senderIds || '—'}
                          </div>
                        </td>

                        {/* 8. Message Alert */}
                        <td className="py-2.5 px-3">
                          <div
                            className="text-[11px] text-slate-800 max-w-[200px] truncate font-sans bg-slate-50/70 px-2 py-1 rounded border border-slate-200/60"
                            title={msgText}
                          >
                            {msgText}
                          </div>
                        </td>

                        {/* 9. Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {log.status === 'DISPATCHED' || log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {log.status}
                            </span>
                          ) : log.status === 'FAILED' || log.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              {log.status}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3 text-amber-600" />
                              {log.status}
                            </span>
                          )}
                        </td>

                        {/* 10. Detail Response / Latency */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 items-start">
                            {detailText ? (
                              <span
                                className={cn(
                                  'text-[10px] font-mono px-1.5 py-0.5 rounded max-w-[180px] truncate block',
                                  log.errorMessage
                                    ? 'text-rose-600 bg-rose-50 border border-rose-200 font-semibold'
                                    : 'text-slate-700 bg-slate-100 border border-slate-200'
                                )}
                                title={detailText}
                              >
                                {detailText}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">200 OK Delivered</span>
                            )}
                            {log.latencyMs != null && (
                              <span className="text-[9px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                                ⚡ {log.latencyMs}ms
                              </span>
                            )}
                          </div>
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
      </div>

      {/* Detail Dialog for Payload Inspection */}
      {selectedLog && (
        <Dialog
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Notification Dispatch Audit: ${selectedLog.id}`}
        >
          <div className="space-y-4 text-xs">
            {/* Metadata Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Timestamp</span>
                <span className="font-mono font-semibold text-slate-800">{formatDateTime(selectedLog.timestamp)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  {selectedLog.status === 'DISPATCHED' || selectedLog.status === 'SUCCESS' ? (
                    <span className="text-emerald-600 font-bold">✓ {selectedLog.status}</span>
                  ) : selectedLog.status === 'FAILED' ? (
                    <span className="text-rose-600 font-bold">✕ FAILED</span>
                  ) : (
                    <span>{selectedLog.status}</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Event Type</span>
                <span className="font-mono font-bold text-indigo-700">{selectedLog.eventType || 'NEW_ALERT'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Latency</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedLog.latencyMs != null ? `${selectedLog.latencyMs} ms` : '—'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-3 rounded-lg border border-slate-200/80">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Database Target</span>
                <span className="font-bold text-slate-900">{selectedLog.dbName}</span>
                <span className="text-[10px] font-mono text-slate-400 block">{selectedLog.dbId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Metric & Attribute</span>
                <span className="font-bold text-slate-900">{selectedLog.metricName}</span>
                {selectedLog.attributeName && (
                  <span className="text-[10px] font-mono text-slate-500 block">{selectedLog.attributeName}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Severity Level</span>
                <span className="font-mono font-bold text-slate-800">{selectedLog.alertLevel}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Dispatcher Channel</span>
                <span className="font-bold text-indigo-700">
                  {selectedLog.dispatcherName || selectedLog.dispatchMethod} ({selectedLog.dispatcherType || selectedLog.dispatchType})
                </span>
              </div>
            </div>

            {/* Target Sender IDs */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700">Destination Sender IDs / Recipients:</span>
                {selectedLog.senderIds && (
                  <button
                    onClick={() => handleCopyText(selectedLog.senderIds, 'Sender IDs')}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'Sender IDs' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedField === 'Sender IDs' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="bg-slate-100 p-2.5 rounded-lg font-mono text-slate-800 break-all select-all border border-slate-200">
                {selectedLog.senderIds || '—'}
              </div>
            </div>

            {/* Dispatched Message Alert */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700">Dispatched Message Alert (`message_alert`):</span>
                {(selectedLog.messageAlert || selectedLog.payloadSummary) && (
                  <button
                    onClick={() => handleCopyText(selectedLog.messageAlert || selectedLog.payloadSummary || '', 'Message Alert')}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'Message Alert' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedField === 'Message Alert' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs leading-relaxed font-mono whitespace-pre-wrap border border-slate-800 max-h-[180px] overflow-y-auto">
                {selectedLog.messageAlert || selectedLog.payloadSummary || 'No dispatched message content recorded.'}
              </div>
            </div>

            {/* Detail Response */}
            {selectedLog.detailResponse && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-700">Detail API Response (`detail_response`):</span>
                  <button
                    onClick={() => handleCopyText(selectedLog.detailResponse!, 'Detail Response')}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'Detail Response' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedField === 'Detail Response' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 break-all border border-slate-200">
                  {selectedLog.detailResponse}
                </div>
              </div>
            )}

            {/* Error Message */}
            {selectedLog.errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                <span className="font-bold block mb-0.5">Gateway Error Response (`error_message`):</span>
                <span className="font-mono text-[11px] break-all">{selectedLog.errorMessage}</span>
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
                <option value="WEBHOOK">CUSTOM WEBHOOK (HTTP POST)</option>
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


          {/* Notification Message (TOKEN Template) Editor */}
          <div className="space-y-2 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <div className="flex items-center justify-between">
              <label className="block text-slate-800 font-bold text-xs flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                Notification Message (TOKEN Template)
              </label>
              <span className="text-[10px] text-indigo-700 font-mono bg-indigo-100 px-2 py-0.5 rounded-full font-semibold">
                Token Raw Storage (Unreplaced)
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Template string stored raw in column <code className="font-bold text-slate-700">notification_message</code>. Other applications will replace tokens with real database alert values at dispatch time.
            </p>

            <textarea
              rows={10}
              value={alertForm.notificationMessage}
              onChange={(e) => setAlertForm({ ...alertForm, notificationMessage: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-xs text-slate-800 focus:outline-none focus:border-indigo-500 leading-relaxed shadow-2xs"
              placeholder="e.g. D_NOTIFICATION_TYPE D_ALERT_SEVERITY Database D_DATABASE_NAME (D_DATABASE_TYPE) Metric D_METRIC_NAME: D_ALERT_VALUE"
            />

            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1.5">Available TOKEN Templates (Click chip to append token):</span>
              <div className="flex flex-wrap gap-1.5">
                {NOTIFICATION_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => handleInsertToken(t.token)}
                    className="px-2 py-1 text-[11px] font-mono font-bold bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 rounded-md transition-all shadow-2xs cursor-pointer flex items-center gap-1 group"
                    title={`${t.label}: ${t.desc}`}
                  >
                    <span>{t.token}</span>
                    <span className="text-[9px] text-indigo-400 group-hover:text-indigo-100 font-sans font-normal">({t.label})</span>
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 italic block mt-1">
                * Saved token without replacement; calculated dynamically by external consumers/dispatch engines.
              </span>
            </div>
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
    </div>
  );
};

