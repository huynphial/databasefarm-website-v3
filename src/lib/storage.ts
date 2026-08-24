import {
  User,
  DatabaseEntity,
  MetricEntity,
  TemplateEntity,
  GroupEntity,
  ActiveAlertEntity,
  AlertHistoryEntity,
  AlertNotificationLogEntity,
  MetricHistoryEntity,
  SystemSettingsEntity,
  AlertNotificationQueueEntity,
  DatabasePollQueueEntity,
  DatabasePollLogEntity,
} from '../types';

const STORAGE_KEYS = {
  USER: 'dbmon_current_user',
  SESSION_ACTIVITY: 'dbmon_session_last_activity',
  DATABASES: 'dbmon_databases',
  METRICS: 'dbmon_metrics',
  TEMPLATES: 'dbmon_templates',
  GROUPS: 'dbmon_groups',
  ACTIVE_ALERTS: 'dbmon_active_alerts',
  ALERT_HISTORY: 'dbmon_alert_history',
  ALERT_NOTIFICATION_LOGS: 'dbmon_alert_notification_logs',
  ALERT_NOTIFICATION_QUEUE: 'dbmon_alert_notification_queue',
  DATABASE_POLL_QUEUE: 'dbmon_database_poll_queue',
  DATABASE_POLL_LOGS: 'dbmon_database_poll_logs',
  METRIC_HISTORY: 'dbmon_metric_history',
  SYSTEM_SETTINGS: 'dbmon_system_settings',
};

// Initial Seed Users
export const INITIAL_USER: User = {
  id: 'usr-admin-01',
  username: 'admin',
  role: 'ADMIN',
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
};

export const INITIAL_VIEWER_USER: User = {
  id: 'usr-viewer-02',
  username: 'viewer',
  role: 'VIEWER',
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
};

export const INITIAL_TEMPLATES: TemplateEntity[] = [
  {
    id: 'tpl-ora-01',
    name: 'Oracle Enterprise Standard',
    targetDbType: 'ORACLE',
    description: 'Standard health checks for Oracle Database instances (Tablespace, Active Sessions, Buffer Cache Hit Ratio).',
    metricIds: ['met-01', 'met-02'],
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'tpl-pg-01',
    name: 'PostgreSQL Core Health',
    targetDbType: 'POSTGRES',
    description: 'Connection saturation, cache hit ratio, and replication lag metrics for PostgreSQL.',
    metricIds: ['met-03', 'met-04'],
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'tpl-my-01',
    name: 'MySQL Server Metrics',
    targetDbType: 'MYSQL',
    description: 'Thread concurrency, InnoDB buffer pool, and slow queries.',
    metricIds: ['met-05', 'met-06'],
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'tpl-ms-01',
    name: 'SQL Server Enterprise Baseline',
    targetDbType: 'MSSQL',
    description: 'Page Life Expectancy, buffer cache ratio, and batch requests per second.',
    metricIds: ['met-07'],
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

export const INITIAL_METRICS: MetricEntity[] = [
  {
    id: 'met-01',
    name: 'Tablespace Usage %',
    sqlQuery: 'SELECT tablespace_name AS name, ROUND((used_space/total_space)*100, 2) AS value FROM dba_tablespace_usage_metrics',
    valueType: 'NUMBER',
    thresholdWarn: '80',
    thresholdHigh: '90',
    thresholdCritical: '95',
    cycle: 1,
    templateId: 'tpl-ora-01',
    templateName: 'Oracle Enterprise Standard',
    isEnabled: true,
    createdAt: new Date(Date.now() - 19 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'met-02',
    name: 'Active Sessions Count',
    sqlQuery: "SELECT username AS name, COUNT(*) AS value FROM v$session WHERE status = 'ACTIVE' AND type != 'BACKGROUND' GROUP BY username",
    valueType: 'NUMBER',
    thresholdWarn: '150',
    thresholdHigh: '300',
    thresholdCritical: '500',
    cycle: 1,
    templateId: 'tpl-ora-01',
    templateName: 'Oracle Enterprise Standard',
    isEnabled: true,
    createdAt: new Date(Date.now() - 19 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'met-03',
    name: 'Connection Saturation %',
    sqlQuery: "SELECT datname AS name, ROUND((count(*)::numeric / current_setting('max_connections')::numeric) * 100, 2) AS value FROM pg_stat_activity GROUP BY datname",
    valueType: 'NUMBER',
    thresholdWarn: '75',
    thresholdHigh: '85',
    thresholdCritical: '95',
    cycle: 1,
    templateId: 'tpl-pg-01',
    templateName: 'PostgreSQL Core Health',
    isEnabled: true,
    createdAt: new Date(Date.now() - 17 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'met-04',
    name: 'Replication Lag (Seconds)',
    sqlQuery: "SELECT application_name AS name, EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INT AS value FROM pg_stat_replication",
    valueType: 'NUMBER',
    thresholdWarn: '30',
    thresholdHigh: '60',
    thresholdCritical: '120',
    cycle: 1,
    templateId: 'tpl-pg-01',
    templateName: 'PostgreSQL Core Health',
    isEnabled: true,
    createdAt: new Date(Date.now() - 17 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'met-05',
    name: 'Threads Connected',
    sqlQuery: "SELECT variable_name AS name, variable_value AS value FROM performance_schema.global_status WHERE variable_name = 'Threads_connected'",
    valueType: 'NUMBER',
    thresholdWarn: '200',
    thresholdHigh: '400',
    thresholdCritical: '800',
    cycle: 1,
    templateId: 'tpl-my-01',
    templateName: 'MySQL Server Metrics',
    isEnabled: true,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'met-06',
    name: 'Read-Only Mode Flag',
    sqlQuery: "SELECT variable_name AS name, variable_value AS value FROM performance_schema.global_variables WHERE variable_name = 'read_only'",
    valueType: 'BOOLEAN',
    thresholdWarn: 'ON',
    thresholdHigh: null,
    thresholdCritical: null,
    cycle: 1,
    templateId: 'tpl-my-01',
    templateName: 'MySQL Server Metrics',
    isEnabled: false,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'met-07',
    name: 'Page Life Expectancy (PLE)',
    sqlQuery: "SELECT counter_name AS name, cntr_value AS value FROM sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy'",
    valueType: 'NUMBER',
    thresholdWarn: '300',
    thresholdHigh: '150',
    thresholdCritical: '60',
    cycle: 1,
    templateId: 'tpl-ms-01',
    templateName: 'SQL Server Enterprise Baseline',
    isEnabled: true,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

export const INITIAL_GROUPS: GroupEntity[] = [
  {
    id: 'grp-01',
    name: 'Production Core Tier',
    description: 'High-availability primary clusters handling core transactional workload.',
    databaseIds: ['db-01', 'db-02', 'db-03', 'db-05'], // Many-to-Many
    templateIds: ['tpl-ora-01', 'tpl-pg-01', 'tpl-my-01'],
    alertMethodIds: ['meth-email-01', 'meth-tg-02'],
    senderIds: '-1001928374650, -1009876543210, core-dba@dbfarm.internal, oncall-alerts@dbfarm.internal',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'grp-02',
    name: 'Payment & Billing Services',
    description: 'PCI-compliant database instances dedicated to payment gateways and financial transactions.',
    databaseIds: ['db-02', 'db-05'], // Belongs to both grp-01 and grp-02 (Many-to-Many)
    templateIds: ['tpl-pg-01'],
    alertMethodIds: ['meth-email-01', 'meth-tg-02'],
    senderIds: '-1002233445566, pci-audit@dbfarm.internal, billing-ops@dbfarm.internal',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'grp-03',
    name: 'Staging & QA Environment',
    description: 'Pre-production test instances for QA load tests and acceptance checks.',
    databaseIds: ['db-04'],
    templateIds: ['tpl-ms-01'],
    alertMethodIds: ['meth-email-01'],
    senderIds: 'qa-leads@dbfarm.internal',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

export const INITIAL_DATABASES: DatabaseEntity[] = [
  {
    id: 'db-01',
    name: 'ERP_PROD_ORA',
    dbType: 'ORACLE',
    host: '10.0.12.44',
    port: 1521,
    tags: ['PRODUCTION', 'CRITICAL', 'PRIMARY'],
    pollIntervalMinutes: 5,
    note: 'Primary ERP transactional Oracle cluster. High availability database node.',
    username: 'dbmon_ro',
    password: 'EncryptedPassword998#',
    connectionConfig: {
      serviceName: 'ORCLPDB1.internal',
      ssl: true,
      maxPoolSize: 10,
    },
    groupIds: ['grp-01'],
    metricIds: ['met-01', 'met-02'],
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: 'UP',
    lastCheckAt: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: 'db-02',
    name: 'PAYMENT_API_PG',
    dbType: 'POSTGRES',
    host: '10.0.14.88',
    port: 5432,
    tags: ['PRODUCTION', 'FINANCE', 'CRITICAL'],
    pollIntervalMinutes: 2,
    note: 'PCI-DSS compliant payment gateway core ledger database.',
    username: 'pg_readonly_mon',
    password: 'SecurePostgresPass#44',
    connectionConfig: {
      databaseName: 'payment_ledger',
      sslMode: 'require',
      connectTimeoutMs: 5000,
    },
    groupIds: ['grp-01', 'grp-02'],
    metricIds: ['met-03', 'met-04'],
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'UP',
    lastCheckAt: new Date(Date.now() - 1 * 60000).toISOString(),
  },
  {
    id: 'db-03',
    name: 'AUTH_NODE_MYSQL',
    dbType: 'MYSQL',
    host: '10.0.18.22',
    port: 3306,
    tags: ['STAGING', 'ANALYTICS'],
    pollIntervalMinutes: 5,
    note: 'Customer relationship portal staging replica.',
    username: 'app_monitor',
    password: 'MySQLMonitorPass_77',
    connectionConfig: {
      databaseName: 'auth_users_db',
      charset: 'utf8mb4',
    },
    groupIds: ['grp-01'],
    metricIds: ['met-05', 'met-06'],
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'WARNING',
    lastCheckAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'db-04',
    name: 'HR_PORTAL_MSSQL',
    dbType: 'MSSQL',
    host: '10.0.22.105',
    port: 1433,
    tags: ['LAB', 'ANALYTICS'],
    pollIntervalMinutes: 10,
    note: 'Data warehouse batch reporting engine for executive dashboards.',
    username: 'mssql_reader',
    password: 'MSSQLVaultKey#2026',
    connectionConfig: {
      databaseName: 'HR_Enterprise',
      encrypt: true,
      trustServerCertificate: false,
    },
    groupIds: ['grp-03'],
    metricIds: ['met-07'],
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'UP',
    lastCheckAt: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: 'db-05',
    name: 'ANALYTICS_WAREHOUSE_PG',
    dbType: 'POSTGRES',
    host: '10.0.30.50',
    port: 5432,
    tags: ['DEV', 'LAB'],
    pollIntervalMinutes: 5,
    note: 'Inventory management development integration server.',
    username: 'dw_mon',
    password: 'DataWarehousePass#88',
    connectionConfig: {
      databaseName: 'analytics_dw',
      sslMode: 'prefer',
    },
    groupIds: ['grp-01', 'grp-02'],
    metricIds: ['met-03', 'met-04'],
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: 'DOWN',
    lastCheckAt: new Date(Date.now() - 2 * 60000).toISOString(),
  },
];

export const INITIAL_SYSTEM_SETTINGS: SystemSettingsEntity = {
  apiCollectorEnabled: true,
  collectorEndpoint: 'http://localhost:3000/api/collector/mock-health',
  collectorApiKey: 'dbf_live_col_9f88a2e1b4c3d4e5f6a7b8c9d0e1f2a3',
  collectorPollIntervalSeconds: 60,
  collectorBatchSize: 250,
  collectorTimeoutMs: 5000,
  collectorRetryPolicy: 'Exponential Backoff (Max 5 retries)',

  globalAlertThresholdMode: 'STANDARD',
  maxRetryAttempts: 3,
  notificationDispatchIntervalSeconds: 30,
  defaultTimezone: 'Asia/Ho_Chi_Minh (UTC+7)',
  timestampFormat: 'HH24:MI:SS DD/MM/YYYY',
  dataRetentionDays: 90,
  autoClearResolvedAlerts: true,
  sessionTimeoutMinutes: 30,
  SESSION_TIMEOUT_MINUTES: '30',

  updatedAt: new Date(Date.now() - 3600000).toISOString(),
  updatedBy: 'admin',
};

export const INITIAL_ACTIVE_ALERTS: ActiveAlertEntity[] = [
  {
    id: 'alt-01',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricId: 'met-01',
    metricName: 'Tablespace Usage %',
    objectName: 'TS_DATA',
    alertLevel: 'CRITICAL',
    status: 'OPEN',
    dispatchStatus: 'DISPATCHED',
    message: 'Object [TS_DATA] tablespace usage reached 97.4%, breaching critical threshold of 95%',
    createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: 'alt-02',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    metricId: 'met-03',
    metricName: 'Connection Saturation %',
    objectName: 'payment_ledger',
    alertLevel: 'CRITICAL',
    status: 'OPEN',
    dispatchStatus: 'DISPATCHED',
    message: 'Object [payment_ledger] connection pool reached 96.8% (484/500 connections in use)',
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: 'alt-03',
    dbId: 'db-03',
    dbName: 'AUTH_NODE_MYSQL',
    metricId: 'met-05',
    metricName: 'Threads Connected',
    objectName: 'Threads_connected',
    alertLevel: 'HIGH',
    status: 'ACKNOWLEDGED',
    dispatchStatus: 'DISPATCHED',
    acknowledgedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    acknowledgedById: 'usr-admin-01',
    acknowledgedByName: 'admin',
    message: 'Object [Threads_connected] spiked to 430 threads (High threshold: 400)',
    createdAt: new Date(Date.now() - 75 * 60000).toISOString(),
  },
  {
    id: 'alt-04',
    dbId: 'db-04',
    dbName: 'HR_PORTAL_MSSQL',
    metricId: 'met-07',
    metricName: 'Page Life Expectancy (PLE)',
    objectName: 'Buffer Manager',
    alertLevel: 'WARN',
    status: 'OPEN',
    dispatchStatus: 'DISPATCHED',
    message: 'Object [Buffer Manager] Page Life Expectancy dropped to 240s (Warn threshold: 300s)',
    createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
  },
];

export const INITIAL_ALERT_NOTIFICATION_LOGS: AlertNotificationLogEntity[] = [
  {
    id: 'notif-log-01',
    timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    alertId: 'alt-01',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricName: 'Tablespace Usage %',
    attributeName: 'used_space_pct',
    alertLevel: 'CRITICAL',
    dispatchMethod: 'Telegram Alert Bot',
    dispatchType: 'TELEGRAM',
    senderIds: '-1001234567890, -1009876543210',
    status: 'DISPATCHED',
    payloadSummary: 'CRITICAL: ERP_PROD_ORA [TS_DATA] Tablespace Usage % reached 97.4%',
    latencyMs: 142,
  },
  {
    id: 'notif-log-02',
    timestamp: new Date(Date.now() - 18 * 60000 + 1200).toISOString(),
    alertId: 'alt-01',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricName: 'Tablespace Usage %',
    attributeName: 'used_space_pct',
    alertLevel: 'CRITICAL',
    dispatchMethod: 'Corporate SMTP Relay',
    dispatchType: 'EMAIL',
    senderIds: 'dba-team@company.internal, oncall-dba@company.internal',
    status: 'DISPATCHED',
    payloadSummary: '[INCIDENT-974] ERP_PROD_ORA Tablespace Alert',
    latencyMs: 380,
  },
  {
    id: 'notif-log-03',
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    alertId: 'alt-02',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    metricName: 'Connection Saturation %',
    attributeName: 'active_connections',
    alertLevel: 'CRITICAL',
    dispatchMethod: 'Telegram Alert Bot',
    dispatchType: 'TELEGRAM',
    senderIds: '-1001234567890',
    status: 'DISPATCHED',
    payloadSummary: 'CRITICAL: PAYMENT_API_PG connection pool 96.8% full',
    latencyMs: 118,
  },
  {
    id: 'notif-log-04',
    timestamp: new Date(Date.now() - 75 * 60000).toISOString(),
    alertId: 'alt-03',
    dbId: 'db-03',
    dbName: 'AUTH_NODE_MYSQL',
    metricName: 'Threads Connected',
    attributeName: 'Threads_connected',
    alertLevel: 'HIGH',
    dispatchMethod: 'Slack Webhook Gateway',
    dispatchType: 'SLACK',
    senderIds: '#dba-alerts-channel',
    status: 'DISPATCHED',
    payloadSummary: 'HIGH: AUTH_NODE_MYSQL Threads_connected spike (430)',
    latencyMs: 210,
  },
  {
    id: 'notif-log-05',
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    alertId: 'alt-04',
    dbId: 'db-04',
    dbName: 'HR_PORTAL_MSSQL',
    metricName: 'Page Life Expectancy (PLE)',
    attributeName: 'ple_seconds',
    alertLevel: 'WARN',
    dispatchMethod: 'Corporate SMTP Relay',
    dispatchType: 'EMAIL',
    senderIds: 'dba-team@company.internal',
    status: 'DISPATCHED',
    payloadSummary: 'WARN: HR_PORTAL_MSSQL Buffer Manager PLE dropped to 240s',
    latencyMs: 290,
  },
  {
    id: 'notif-log-06',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    alertId: 'althist-01',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    metricName: 'Replication Lag (Seconds)',
    attributeName: 'lag_seconds',
    alertLevel: 'WARN',
    dispatchMethod: 'SMS Gateway (Twilio)',
    dispatchType: 'SMS',
    senderIds: '+84901234567, +84907654321',
    status: 'FAILED',
    errorMessage: 'HTTP 429: SMS Rate limit exceeded on backup gateway provider',
    payloadSummary: 'WARN: PAYMENT_API_PG replica lag > 35s',
    latencyMs: 850,
  },
];

export const INITIAL_ALERT_NOTIFICATION_QUEUE: AlertNotificationQueueEntity[] = [
  {
    id: 'notif-q-01',
    alertId: '1',
    dbId: 'db-03',
    dbName: 'AUTH_NODE_MYSQL',
    metricName: 'Threads Connected',
    attributeName: 'Threads_connected',
    alertLevel: 'WARN',
    eventType: 'TRIGGER',
    dispatcherId: 'meth-slack-03',
    dispatcherName: 'Slack NOC Incident Channel',
    dispatcherType: 'SLACK',
    status: 'PENDING',
    lockedBy: null,
    lockedAt: null,
    scheduledAt: new Date(Date.now() + 60000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif-q-02',
    alertId: '2',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricName: 'Tablespace Usage %',
    attributeName: 'used_space_pct',
    alertLevel: 'CRITICAL',
    eventType: 'TRIGGER',
    dispatcherId: 'meth-tg-02',
    dispatcherName: 'Telegram Incident Operations Bot',
    dispatcherType: 'TELEGRAM',
    status: 'PROCESSING',
    lockedBy: 'dispatcher-worker-01',
    lockedAt: new Date(Date.now() - 10000).toISOString(),
    scheduledAt: new Date(Date.now() - 10000).toISOString(),
    createdAt: new Date(Date.now() - 30000).toISOString(),
  },
];

export const INITIAL_DATABASE_POLL_QUEUE: DatabasePollQueueEntity[] = [
  {
    id: '1',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    status: 'pending',
    lockedBy: null,
    lockedAt: null,
    scheduledAt: new Date(Date.now() + 5 * 60000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    status: 'processing',
    lockedBy: 'collector-node-01',
    lockedAt: new Date(Date.now() - 30 * 1000).toISOString(),
    scheduledAt: new Date(Date.now() - 60000).toISOString(),
    createdAt: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: '3',
    dbId: 'db-03',
    dbName: 'AUTH_NODE_MYSQL',
    status: 'pending',
    lockedBy: null,
    lockedAt: null,
    scheduledAt: new Date(Date.now() + 2 * 60000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_DATABASE_POLL_LOGS: DatabasePollLogEntity[] = [
  {
    id: '1',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    status: 'success',
    errorMessage: null,
    startedAt: new Date(Date.now() - 3 * 60000 - 4500).toISOString(),
    finishedAt: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: '2',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    status: 'success',
    errorMessage: null,
    startedAt: new Date(Date.now() - 4 * 60000 - 1200).toISOString(),
    finishedAt: new Date(Date.now() - 4 * 60000).toISOString(),
  },
  {
    id: '3',
    dbId: 'db-04',
    dbName: 'HR_PORTAL_MSSQL',
    status: 'failed',
    errorMessage: 'Connection timeout (3000ms exceeded): host 10.0.40.72 unreachable',
    startedAt: new Date(Date.now() - 5 * 60000 - 15000).toISOString(),
    finishedAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: '4',
    dbId: 'db-03',
    dbName: 'AUTH_NODE_MYSQL',
    status: 'success',
    errorMessage: null,
    startedAt: new Date(Date.now() - 8 * 60000 - 850).toISOString(),
    finishedAt: new Date(Date.now() - 8 * 60000).toISOString(),
  },
];

export const INITIAL_ALERT_HISTORY: AlertHistoryEntity[] = [
  {
    id: 'althist-01',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    metricId: 'met-04',
    metricName: 'Replication Lag (Seconds)',
    objectName: 'replica_standby_02',
    alertLevel: 'WARN',
    message: 'Replica [replica_standby_02] lag exceeded 35s during batch settlement sync.',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    clearedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    clearedById: 'usr-admin-01',
    clearedByName: 'admin',
  },
  {
    id: 'althist-02',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricId: 'met-02',
    metricName: 'Active Sessions Count',
    objectName: 'REPORT_JOB',
    alertLevel: 'HIGH',
    message: 'Object [REPORT_JOB] active sessions spiked to 320 during month-end payroll execution.',
    createdAt: new Date(Date.now() - 14 * 3600000).toISOString(),
    clearedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    clearedById: 'usr-admin-01',
    clearedByName: 'admin',
  },
  {
    id: 'althist-03',
    dbId: 'db-03',
    dbName: 'AUTH_NODE_MYSQL',
    metricId: 'met-05',
    metricName: 'Threads Connected',
    objectName: 'Threads_connected',
    alertLevel: 'WARN',
    message: 'Elevated thread count [Threads_connected] at 240 during authentication surge.',
    createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
    clearedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
    clearedById: 'usr-admin-01',
    clearedByName: 'admin',
  },
  {
    id: 'althist-04',
    dbId: 'db-05',
    dbName: 'ANALYTICS_WAREHOUSE_PG',
    metricId: 'met-03',
    metricName: 'Connection Saturation %',
    objectName: 'analytics_dw',
    alertLevel: 'CRITICAL',
    message: 'Object [analytics_dw] max connections reached 98% during nightly ETL pipeline execution.',
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    clearedAt: new Date(Date.now() - 46 * 3600000).toISOString(),
    clearedById: 'usr-admin-01',
    clearedByName: 'admin',
  },
  {
    id: 'althist-05',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricId: 'met-01',
    metricName: 'Tablespace Usage %',
    objectName: 'SYSTEM',
    alertLevel: 'WARN',
    message: 'Object [SYSTEM] tablespace usage reached warning boundary 82.5%.',
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    clearedAt: new Date(Date.now() - 8 * 86400000 + 3600000).toISOString(),
    clearedById: 'usr-admin-01',
    clearedByName: 'admin',
  },
  {
    id: 'althist-06',
    dbId: 'db-04',
    dbName: 'HR_PORTAL_MSSQL',
    metricId: 'met-07',
    metricName: 'Page Life Expectancy (PLE)',
    objectName: 'Buffer Manager',
    alertLevel: 'HIGH',
    message: 'Object [Buffer Manager] PLE plunged below 120s due to large ad-hoc reporting query.',
    createdAt: new Date(Date.now() - 19 * 86400000).toISOString(),
    clearedAt: new Date(Date.now() - 19 * 86400000 + 7200000).toISOString(),
    clearedById: 'usr-admin-01',
    clearedByName: 'admin',
  },
  {
    id: 'althist-07',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    metricId: 'met-03',
    metricName: 'Connection Saturation %',
    objectName: 'billing_db',
    alertLevel: 'HIGH',
    message: 'Object [billing_db] connection pool spike reaching 88% during flash sale campaign.',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    clearedAt: new Date(Date.now() - 25 * 86400000 + 1800000).toISOString(),
    clearedById: 'usr-admin-01',
    clearedByName: 'admin',
  },
  {
    id: 'althist-08',
    dbId: 'db-03',
    dbName: 'AUTH_NODE_MYSQL',
    metricId: 'met-05',
    metricName: 'Threads Connected',
    objectName: 'Threads_connected',
    alertLevel: 'CRITICAL',
    message: 'Object [Threads_connected] connection storm exceeded 820 threads.',
    createdAt: new Date(Date.now() - 42 * 86400000).toISOString(),
    clearedAt: new Date(Date.now() - 42 * 86400000 + 5400000).toISOString(),
    clearedById: 'usr-admin-01',
    clearedByName: 'admin',
  },
];

// Generate 48 hours of time-series metric data with composite keys [dbId]_[metricId]_[objectName]_[timestamp]
// Demonstrates multi-object measurements (e.g. multiple tablespaces) and dynamic/transient objects gracefully
export function generateInitialMetricHistory(): MetricHistoryEntity[] {
  const history: MetricHistoryEntity[] = [];
  const now = Date.now();
  const points = 48;

  // DB-01 (Oracle) Multi-Object Tablespaces (met-01)
  const oraTablespaces = [
    { name: 'TS_DATA', baseVal: 88, maxVal: 97.4, trend: 9.4 },
    { name: 'SYSTEM', baseVal: 82, maxVal: 84.5, trend: 2.5 },
    { name: 'SYSAUX', baseVal: 76, maxVal: 79.2, trend: 3.2 },
    { name: 'USERS', baseVal: 65, maxVal: 72.0, trend: 7.0 },
    { name: 'UNDOTBS1', baseVal: 45, maxVal: 58.0, trend: 13.0 },
  ];

  for (let i = points; i >= 0; i--) {
    const timestamp = new Date(now - i * 30 * 60000).toISOString();
    
    // Multi-object tablespace measurement
    oraTablespaces.forEach((ts) => {
      const val = (ts.baseVal + (1 - i / points) * ts.trend + Math.sin(i / 3) * 0.4).toFixed(2);
      history.push({
        id: `db-01_met-01_${ts.name}_${timestamp}`,
        dbId: 'db-01',
        dbName: 'ERP_PROD_ORA',
        metricId: 'met-01',
        metricName: 'Tablespace Usage %',
        objectName: ts.name,
        value: val,
        createdAt: timestamp,
      });
    });

    // Dynamic / Transient Metric Object: TS_TEMP_STAGING existed only between cycles 15 and 35, then was dropped
    if (i >= 15 && i <= 35) {
      const tempVal = (50 + Math.sin(i) * 20).toFixed(2);
      history.push({
        id: `db-01_met-01_TS_TEMP_STAGING_${timestamp}`,
        dbId: 'db-01',
        dbName: 'ERP_PROD_ORA',
        metricId: 'met-01',
        metricName: 'Tablespace Usage %',
        objectName: 'TS_TEMP_STAGING',
        value: tempVal,
        createdAt: timestamp,
      });
    }

    // Active Sessions (met-02) across multiple app users / modules
    const sessionUsers = ['APP_USER', 'REPORT_JOB', 'BATCH_SYNC', 'INTERNAL'];
    sessionUsers.forEach((usr, uIdx) => {
      const baseSess = [90, 60, 30, 10][uIdx];
      const sessVal = Math.max(2, Math.round(baseSess + Math.sin((i + uIdx) / 2) * 40 + Math.random() * 15)).toString();
      history.push({
        id: `db-01_met-02_${usr}_${timestamp}`,
        dbId: 'db-01',
        dbName: 'ERP_PROD_ORA',
        metricId: 'met-02',
        metricName: 'Active Sessions Count',
        objectName: usr,
        value: sessVal,
        createdAt: timestamp,
      });
    });
  }

  // DB-02 (PostgreSQL) Multi-Object Databases (met-03) & Replicas (met-04)
  const pgDbs = [
    { name: 'payment_ledger', base: 70, delta: 26.8 },
    { name: 'billing_db', base: 50, delta: 18.2 },
    { name: 'customer_portal', base: 35, delta: 10.0 },
  ];

  for (let i = points; i >= 0; i--) {
    const timestamp = new Date(now - i * 30 * 60000).toISOString();

    pgDbs.forEach((db) => {
      const connSat = (db.base + (1 - i / points) * db.delta + Math.cos(i / 2) * 1.2).toFixed(2);
      history.push({
        id: `db-02_met-03_${db.name}_${timestamp}`,
        dbId: 'db-02',
        dbName: 'PAYMENT_API_PG',
        metricId: 'met-03',
        metricName: 'Connection Saturation %',
        objectName: db.name,
        value: connSat,
        createdAt: timestamp,
      });
    });

    // Replication Lag for replica standby objects
    const replicas = ['replica_standby_01', 'replica_standby_02'];
    replicas.forEach((rep, rIdx) => {
      const baseLag = rIdx === 0 ? 4 : 20;
      const lag = Math.max(0, Math.round(baseLag + Math.sin(i + rIdx) * 12)).toString();
      history.push({
        id: `db-02_met-04_${rep}_${timestamp}`,
        dbId: 'db-02',
        dbName: 'PAYMENT_API_PG',
        metricId: 'met-04',
        metricName: 'Replication Lag (Seconds)',
        objectName: rep,
        value: lag,
        createdAt: timestamp,
      });
    });
  }

  // DB-03 (MySQL) Threads Connected (met-05)
  for (let i = points; i >= 0; i--) {
    const timestamp = new Date(now - i * 30 * 60000).toISOString();
    const threads = Math.round(250 + (1 - i / points) * 180 + Math.sin(i) * 30).toString();
    history.push({
      id: `db-03_met-05_Threads_connected_${timestamp}`,
      dbId: 'db-03',
      dbName: 'AUTH_NODE_MYSQL',
      metricId: 'met-05',
      metricName: 'Threads Connected',
      objectName: 'Threads_connected',
      value: threads,
      createdAt: timestamp,
    });
  }

  // DB-04 (SQL Server) Page Life Expectancy (met-07)
  for (let i = points; i >= 0; i--) {
    const timestamp = new Date(now - i * 30 * 60000).toISOString();
    const pleVal = Math.max(50, Math.round(320 - (1 - i / points) * 90 + Math.sin(i / 2) * 20)).toString();
    history.push({
      id: `db-04_met-07_Buffer_Manager_${timestamp}`,
      dbId: 'db-04',
      dbName: 'HR_PORTAL_MSSQL',
      metricId: 'met-07',
      metricName: 'Page Life Expectancy (PLE)',
      objectName: 'Buffer Manager',
      value: pleVal,
      createdAt: timestamp,
    });
  }

  return history;
}

export const storage = {
  getUser(): User | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return null;
  },
  setUser(user: User | null) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
  },

  getLastActivity(): number {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION_ACTIVITY);
    return raw ? parseInt(raw, 10) : Date.now();
  },
  setLastActivity(time: number = Date.now()) {
    localStorage.setItem(STORAGE_KEYS.SESSION_ACTIVITY, time.toString());
  },
  clearLastActivity() {
    localStorage.removeItem(STORAGE_KEYS.SESSION_ACTIVITY);
  },

  getDatabases(): DatabaseEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DATABASES);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((db: any) => ({
            ...db,
            lastCheckAt: db.lastCheckAt || db.updatedAt || new Date().toISOString(),
          }));
        }
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.DATABASES, JSON.stringify(INITIAL_DATABASES));
    return INITIAL_DATABASES;
  },
  setDatabases(data: DatabaseEntity[]) {
    localStorage.setItem(STORAGE_KEYS.DATABASES, JSON.stringify(data));
  },
  getSystemSettings(): SystemSettingsEntity {
    const raw = localStorage.getItem(STORAGE_KEYS.SYSTEM_SETTINGS);
    if (raw) {
      try {
        return { ...INITIAL_SYSTEM_SETTINGS, ...JSON.parse(raw) };
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.SYSTEM_SETTINGS, JSON.stringify(INITIAL_SYSTEM_SETTINGS));
    return INITIAL_SYSTEM_SETTINGS;
  },
  setSystemSettings(data: SystemSettingsEntity) {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_SETTINGS, JSON.stringify(data));
  },
  getMetrics(): MetricEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.METRICS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Ensure isEnabled defaults to true if missing
        return parsed.map((m: any) => ({
          ...m,
          isEnabled: m.isEnabled !== undefined ? m.isEnabled : true,
        }));
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(INITIAL_METRICS));
    return INITIAL_METRICS;
  },
  setMetrics(data: MetricEntity[]) {
    localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(data));
  },
  getTemplates(): TemplateEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(INITIAL_TEMPLATES));
    return INITIAL_TEMPLATES;
  },
  setTemplates(data: TemplateEntity[]) {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(data));
  },
  getGroups(): GroupEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.GROUPS);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(INITIAL_GROUPS));
    return INITIAL_GROUPS;
  },
  setGroups(data: GroupEntity[]) {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(data));
  },
  getActiveAlerts(): ActiveAlertEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_ALERTS);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ALERTS, JSON.stringify(INITIAL_ACTIVE_ALERTS));
    return INITIAL_ACTIVE_ALERTS;
  },
  setActiveAlerts(data: ActiveAlertEntity[]) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ALERTS, JSON.stringify(data));
  },
  getAlertHistory(): AlertHistoryEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ALERT_HISTORY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.ALERT_HISTORY, JSON.stringify(INITIAL_ALERT_HISTORY));
    return INITIAL_ALERT_HISTORY;
  },
  setAlertHistory(data: AlertHistoryEntity[]) {
    localStorage.setItem(STORAGE_KEYS.ALERT_HISTORY, JSON.stringify(data));
  },
  getAlertNotificationLogs(): AlertNotificationLogEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ALERT_NOTIFICATION_LOGS);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.ALERT_NOTIFICATION_LOGS, JSON.stringify(INITIAL_ALERT_NOTIFICATION_LOGS));
    return INITIAL_ALERT_NOTIFICATION_LOGS;
  },
  setAlertNotificationLogs(data: AlertNotificationLogEntity[]) {
    localStorage.setItem(STORAGE_KEYS.ALERT_NOTIFICATION_LOGS, JSON.stringify(data));
  },
  addAlertNotificationLog(log: AlertNotificationLogEntity) {
    const current = this.getAlertNotificationLogs();
    const updated = [log, ...current].slice(0, 1000); // keep last 1000 logs
    this.setAlertNotificationLogs(updated);
  },
  getAlertNotificationQueue(): AlertNotificationQueueEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ALERT_NOTIFICATION_QUEUE);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.ALERT_NOTIFICATION_QUEUE, JSON.stringify(INITIAL_ALERT_NOTIFICATION_QUEUE));
    return INITIAL_ALERT_NOTIFICATION_QUEUE;
  },
  setAlertNotificationQueue(data: AlertNotificationQueueEntity[]) {
    localStorage.setItem(STORAGE_KEYS.ALERT_NOTIFICATION_QUEUE, JSON.stringify(data));
  },
  getDatabasePollQueue(): DatabasePollQueueEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DATABASE_POLL_QUEUE);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.DATABASE_POLL_QUEUE, JSON.stringify(INITIAL_DATABASE_POLL_QUEUE));
    return INITIAL_DATABASE_POLL_QUEUE;
  },
  setDatabasePollQueue(data: DatabasePollQueueEntity[]) {
    localStorage.setItem(STORAGE_KEYS.DATABASE_POLL_QUEUE, JSON.stringify(data));
  },
  getDatabasePollLogs(): DatabasePollLogEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DATABASE_POLL_LOGS);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.DATABASE_POLL_LOGS, JSON.stringify(INITIAL_DATABASE_POLL_LOGS));
    return INITIAL_DATABASE_POLL_LOGS;
  },
  setDatabasePollLogs(data: DatabasePollLogEntity[]) {
    localStorage.setItem(STORAGE_KEYS.DATABASE_POLL_LOGS, JSON.stringify(data));
  },
  getMetricHistory(): MetricHistoryEntity[] {
    const raw = localStorage.getItem(STORAGE_KEYS.METRIC_HISTORY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            objectName: item.objectName || 'INSTANCE',
          }));
        }
      } catch (e) {}
    }
    const initial = generateInitialMetricHistory();
    localStorage.setItem(STORAGE_KEYS.METRIC_HISTORY, JSON.stringify(initial));
    return initial;
  },
  setMetricHistory(data: MetricHistoryEntity[]) {
    localStorage.setItem(STORAGE_KEYS.METRIC_HISTORY, JSON.stringify(data));
  },
  resetData() {
    localStorage.removeItem(STORAGE_KEYS.DATABASES);
    localStorage.removeItem(STORAGE_KEYS.METRICS);
    localStorage.removeItem(STORAGE_KEYS.TEMPLATES);
    localStorage.removeItem(STORAGE_KEYS.GROUPS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ALERTS);
    localStorage.removeItem(STORAGE_KEYS.ALERT_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.ALERT_NOTIFICATION_LOGS);
    localStorage.removeItem(STORAGE_KEYS.ALERT_NOTIFICATION_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.DATABASE_POLL_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.DATABASE_POLL_LOGS);
    localStorage.removeItem(STORAGE_KEYS.METRIC_HISTORY);
  },
  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEYS.DATABASES);
    localStorage.removeItem(STORAGE_KEYS.METRICS);
    localStorage.removeItem(STORAGE_KEYS.TEMPLATES);
    localStorage.removeItem(STORAGE_KEYS.GROUPS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ALERTS);
    localStorage.removeItem(STORAGE_KEYS.ALERT_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.ALERT_NOTIFICATION_LOGS);
    localStorage.removeItem(STORAGE_KEYS.ALERT_NOTIFICATION_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.DATABASE_POLL_QUEUE);
    localStorage.removeItem(STORAGE_KEYS.DATABASE_POLL_LOGS);
    localStorage.removeItem(STORAGE_KEYS.METRIC_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.SYSTEM_SETTINGS);
  }
};
