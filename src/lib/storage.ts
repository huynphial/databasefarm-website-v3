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
  DATABASE_ENGINES: 'dbmon_database_engines',
  ALERT_METHODS: 'dbmon_alert_methods',
  RAW_MEASUREMENTS: 'dbmon_raw_measurements',
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
    alertHourMode: 'ALL_DAY',
    alertHourStart: '07:30',
    alertHourEnd: '17:00',
    description: 'Standard health checks for Oracle Database instances (Tablespace, Active Sessions, Buffer Cache Hit Ratio).',
    metricIds: ['met-01', 'met-02'],
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'tpl-pg-01',
    name: 'PostgreSQL Core Health',
    targetDbType: 'POSTGRES',
    alertHourMode: 'HOUR_RANGE',
    alertHourStart: '07:30',
    alertHourEnd: '17:00',
    description: 'Connection saturation, cache hit ratio, and replication lag metrics for PostgreSQL.',
    metricIds: ['met-03', 'met-04'],
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'tpl-my-01',
    name: 'MySQL Server Metrics',
    targetDbType: 'MYSQL',
    alertHourMode: 'ALL_DAY',
    alertHourStart: '07:30',
    alertHourEnd: '17:00',
    description: 'Thread concurrency, InnoDB buffer pool, and slow queries.',
    metricIds: ['met-05', 'met-06'],
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'tpl-ms-01',
    name: 'SQL Server Enterprise Baseline',
    targetDbType: 'MSSQL',
    alertHourMode: 'ALL_DAY',
    alertHourStart: '07:30',
    alertHourEnd: '17:00',
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
    notificationMappings: [
      { notificationMethodId: 'meth-email-01', senderIds: 'core-dba@dbfarm.internal, oncall-alerts@dbfarm.internal' },
      { notificationMethodId: 'meth-tg-02', senderIds: '-1001928374650, -1009876543210' },
    ],
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'grp-02',
    name: 'Payment & Billing Services',
    description: 'PCI-compliant database instances dedicated to payment gateways and financial transactions.',
    databaseIds: ['db-02', 'db-05'], // Belongs to both grp-01 and grp-02 (Many-to-Many)
    templateIds: ['tpl-pg-01'],
    notificationMappings: [
      { notificationMethodId: 'meth-email-01', senderIds: 'pci-audit@dbfarm.internal, billing-ops@dbfarm.internal' },
      { notificationMethodId: 'meth-tg-02', senderIds: '-1002233445566' },
    ],
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

/**
 * Client-Side Storage Sanitization & Encryption Utilities
 * Remediates CWE-312, CWE-315, CWE-359 (Cleartext storage of sensitive credentials in client storage)
 */

/**
 * Strips raw passwords, keys, and unencrypted secrets before storing DatabaseEntity in client-side storage.
 * Explicit safe projection ensures no sensitive data or credentials are persisted in web storage (CWE-312 / CWE-315).
 */
export function sanitizeDatabaseEntity(db: Partial<DatabaseEntity> | any): DatabaseEntity {
  if (!db || typeof db !== 'object') {
    return {} as DatabaseEntity;
  }

  // Whitelist-based projection of non-sensitive attributes for client storage
  const safeEntity: DatabaseEntity = {
    id: String(db.id || ''),
    name: String(db.name || ''),
    databaseSystem: db.databaseSystem ? String(db.databaseSystem) : undefined,
    database_system: db.database_system ? String(db.database_system) : undefined,
    dbType: db.dbType || 'POSTGRES',
    databaseEngineId: db.databaseEngineId ? String(db.databaseEngineId) : undefined,
    host: String(db.host || ''),
    port: typeof db.port === 'number' ? db.port : Number(db.port) || 0,
    pollId: typeof db.pollId === 'number' ? db.pollId : 0,
    tags: Array.isArray(db.tags) ? [...db.tags] : [],
    pollIntervalMinutes: typeof db.pollIntervalMinutes === 'number' ? db.pollIntervalMinutes : 5,
    note: db.note ? String(db.note) : '',
    authMethod: db.authMethod || 'PASSWORD',
    username: db.username ? String(db.username) : '',
    databaseName: db.databaseName ? String(db.databaseName) : undefined,
    environment: db.environment || 'PRODUCTION',
    connectionConfig:
      db.connectionConfig && typeof db.connectionConfig === 'object'
        ? (() => {
            const safeConn = { ...db.connectionConfig };
            delete safeConn.password;
            delete safeConn.passwordEncrypted;
            delete safeConn.secret;
            delete safeConn.apiKey;
            delete safeConn.authToken;
            delete safeConn.authKey;
            return safeConn;
          })()
        : {},
    groupIds: Array.isArray(db.groupIds) ? [...db.groupIds] : [],
    metricIds: Array.isArray(db.metricIds) ? [...db.metricIds] : [],
    createdAt: db.createdAt ? String(db.createdAt) : new Date().toISOString(),
    updatedAt: db.updatedAt ? String(db.updatedAt) : new Date().toISOString(),
    status: db.status || 'UP',
    lastCheckAt: db.lastCheckAt ? String(db.lastCheckAt) : new Date().toISOString(),
    isEnabled: db.isEnabled !== undefined ? Boolean(db.isEnabled) : true,
  };

  return safeEntity;
}

export function sanitizeDatabaseList(list: (Partial<DatabaseEntity> | any)[]): DatabaseEntity[] {
  if (!Array.isArray(list)) return [];
  return list.map(sanitizeDatabaseEntity);
}

/**
 * Authenticated Encryption/Decryption Strategy for client-side storage (AES-GCM via Web Crypto API)
 * Provides defense-in-depth when sensitive payload persistence in client storage is necessary.
 */
export class ClientCryptoVault {
  private static readonly ALGO = 'AES-GCM';
  private static readonly KEY_LEN = 256;
  private static cachedKey: CryptoKey | null = null;

  private static async getDerivedKey(): Promise<CryptoKey> {
    if (this.cachedKey) return this.cachedKey;
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API is not available in current environment');
    }

    const salt = new TextEncoder().encode('dbmon-client-storage-salt-v1');
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(window.location.origin + '_dbmon_vault'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    this.cachedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: this.ALGO, length: this.KEY_LEN },
      false,
      ['encrypt', 'decrypt']
    );

    return this.cachedKey;
  }

  static async encrypt(plaintext: string): Promise<string> {
    const key = await this.getDerivedKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: this.ALGO, iv },
      key,
      encoded
    );

    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    let binary = '';
    const bytes = new Uint8Array(combined);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'enc:gcm:' + btoa(binary);
  }

  static async decrypt(encryptedPayload: string): Promise<string> {
    if (!encryptedPayload.startsWith('enc:gcm:')) {
      throw new Error('Invalid encrypted payload format');
    }
    const base64 = encryptedPayload.slice(8);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const key = await this.getDerivedKey();

    const decrypted = await window.crypto.subtle.decrypt(
      { name: this.ALGO, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }
}

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
  collectorApiKey: '',
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
    id: '1',
    alertId: 'alt-01',
    alertLevel: 'CRITICAL',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricId: 'met-01',
    metricName: 'Tablespace Usage %',
    objectName: 'TS_DATA_PRD',
    attributeName: 'used_space_pct',
    value: '97.4%',
    messageAlert: 'CRITICAL: ERP_PROD_ORA [TS_DATA_PRD] Tablespace Usage % reached 97.4%',
    senderIdList: '-1001234567890, -1009876543210',
    dispatcherId: 'meth-tg-02',
    dispatcherName: 'Telegram Incident Operations Bot',
    dispatcherType: 'TELEGRAM',
    dispatcherConfig: JSON.stringify({ botToken: 'REDACTED_BOT_TOKEN', defaultChatId: '-1001234567890' }),
    responseSuccess: true,
    responseStatus: '200 OK',
    responseDetail: 'HTTP 200 OK: Telegram message delivered to chat -1001234567890',
    lockedAt: new Date(Date.now() - 18 * 60000 - 5000).toISOString(),
    lockedBy: 'worker-node-01',
    finishedAt: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: '2',
    alertId: 'alt-01',
    alertLevel: 'CRITICAL',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricId: 'met-01',
    metricName: 'Tablespace Usage %',
    objectName: 'TS_DATA_PRD',
    attributeName: 'used_space_pct',
    value: '97.4%',
    messageAlert: '[INCIDENT-974] ERP_PROD_ORA Tablespace Alert',
    senderIdList: 'dba-team@company.internal, oncall-dba@company.internal',
    dispatcherId: 'meth-email-01',
    dispatcherName: 'Corporate SMTP Dispatcher',
    dispatcherType: 'EMAIL',
    dispatcherConfig: JSON.stringify({ host: 'mail.company.internal', port: 587 }),
    responseSuccess: true,
    responseStatus: '250 OK',
    responseDetail: '250 2.0.0 OK message queued for delivery',
    lockedAt: new Date(Date.now() - 18 * 60000).toISOString(),
    lockedBy: 'worker-node-02',
    finishedAt: new Date(Date.now() - 18 * 60000 + 1200).toISOString(),
  },
  {
    id: '3',
    alertId: 'alt-02',
    alertLevel: 'CRITICAL',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    metricId: 'met-03',
    metricName: 'Connection Saturation %',
    objectName: 'payment_ledger',
    attributeName: 'active_connections',
    value: '96.8%',
    messageAlert: 'CRITICAL: PAYMENT_API_PG connection pool 96.8% full',
    senderIdList: '-1001234567890',
    dispatcherId: 'meth-tg-02',
    dispatcherName: 'Telegram Incident Operations Bot',
    dispatcherType: 'TELEGRAM',
    dispatcherConfig: JSON.stringify({ botToken: 'REDACTED_BOT_TOKEN' }),
    responseSuccess: true,
    responseStatus: '200 OK',
    responseDetail: 'HTTP 200 OK: Telegram message sent successfully',
    lockedAt: new Date(Date.now() - 35 * 60000 - 3000).toISOString(),
    lockedBy: 'worker-node-01',
    finishedAt: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: '4',
    alertId: 'alt-03',
    alertLevel: 'HIGH',
    dbId: 'db-03',
    dbName: 'CRM_PORTAL_MY',
    metricId: 'met-05',
    metricName: 'Threads Connected',
    objectName: 'Threads_connected',
    attributeName: 'threads',
    value: '430',
    messageAlert: 'HIGH: CRM_PORTAL_MY Threads_connected spike (430)',
    senderIdList: 'dba-team@company.internal',
    dispatcherId: 'meth-email-01',
    dispatcherName: 'Corporate SMTP Dispatcher',
    dispatcherType: 'EMAIL',
    dispatcherConfig: JSON.stringify({ host: 'mail.company.internal', port: 587 }),
    responseSuccess: true,
    responseStatus: '200 OK',
    responseDetail: 'HTTP 200 ok (Corporate SMTP)',
    lockedAt: new Date(Date.now() - 75 * 60000 - 2000).toISOString(),
    lockedBy: 'worker-node-03',
    finishedAt: new Date(Date.now() - 75 * 60000).toISOString(),
  },
  {
    id: '5',
    alertId: 'alt-04',
    alertLevel: 'WARN',
    dbId: 'db-04',
    dbName: 'DW_REPORTS_MS',
    metricId: 'met-07',
    metricName: 'Page Life Expectancy (PLE)',
    objectName: 'GLOBAL',
    attributeName: 'ple_seconds',
    value: '240s',
    messageAlert: 'WARN: DW_REPORTS_MS Buffer Manager PLE dropped to 240s',
    senderIdList: 'dba-team@company.internal',
    dispatcherId: 'meth-email-01',
    dispatcherName: 'Corporate SMTP Dispatcher',
    dispatcherType: 'EMAIL',
    dispatcherConfig: JSON.stringify({ host: 'mail.company.internal', port: 587 }),
    responseSuccess: true,
    responseStatus: '250 OK',
    responseDetail: '250 2.0.0 OK mail delivered',
    lockedAt: new Date(Date.now() - 120 * 60000 - 1000).toISOString(),
    lockedBy: 'worker-node-02',
    finishedAt: new Date(Date.now() - 120 * 60000).toISOString(),
  },
  {
    id: '6',
    alertId: 'althist-01',
    alertLevel: 'HIGH',
    dbId: 'db-02',
    dbName: 'PAYMENT_API_PG',
    metricId: 'met-04',
    metricName: 'Replication Lag (Seconds)',
    objectName: 'replica_standby_01',
    attributeName: 'lag_seconds',
    value: '35s',
    messageAlert: 'HIGH: PAYMENT_API_PG replica lag > 35s',
    senderIdList: '-1001234567890',
    dispatcherId: 'meth-tg-02',
    dispatcherName: 'Telegram Incident Operations Bot',
    dispatcherType: 'TELEGRAM',
    dispatcherConfig: JSON.stringify({ botToken: 'REDACTED_BOT_TOKEN' }),
    responseSuccess: false,
    responseStatus: '429 Rate Limit Exceeded',
    responseDetail: 'HTTP 429 Too Many Requests: Rate limit exceeded on Telegram provider',
    lockedAt: new Date(Date.now() - 5 * 3600000 - 5000).toISOString(),
    lockedBy: 'worker-node-01',
    finishedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
];

export const INITIAL_ALERT_NOTIFICATION_QUEUE: AlertNotificationQueueEntity[] = [
  {
    id: '1',
    alertId: '1',
    alertLevel: 'WARN',
    dbId: 'db-03',
    dbName: 'CRM_PORTAL_MY',
    metricId: 'met-05',
    metricName: 'Threads Connected',
    objectName: 'Threads_connected',
    attributeName: 'threads',
    value: '212',
    messageAlert: 'WARN: CRM_PORTAL_MY Threads_connected reached 212',
    senderIdList: '-1001234567890',
    dispatcherId: 'meth-tg-02',
    dispatcherName: 'Telegram Incident Operations Bot',
    dispatcherType: 'TELEGRAM',
    dispatcherConfig: JSON.stringify({ botToken: 'REDACTED_BOT_TOKEN' }),
    lockedAt: null,
    lockedBy: null,
  },
  {
    id: '2',
    alertId: '3',
    alertLevel: 'CRITICAL',
    dbId: 'db-01',
    dbName: 'ERP_PROD_ORA',
    metricId: 'met-01',
    metricName: 'Tablespace Usage %',
    objectName: 'TS_DATA_PRD',
    attributeName: 'used_space_pct',
    value: '91.40',
    messageAlert: 'CRITICAL: ERP_PROD_ORA TS_DATA_PRD usage (91.40%) breached High threshold',
    senderIdList: '-1001234567890',
    dispatcherId: 'meth-tg-02',
    dispatcherName: 'Telegram Incident Operations Bot',
    dispatcherType: 'TELEGRAM',
    dispatcherConfig: JSON.stringify({ botToken: 'REDACTED_BOT_TOKEN' }),
    lockedAt: new Date(Date.now() - 10000).toISOString(),
    lockedBy: 'dispatcher-worker-01',
  },
];

export const INITIAL_DATABASE_POLL_QUEUE: DatabasePollQueueEntity[] = [];

export const INITIAL_DATABASE_POLL_LOGS: DatabasePollLogEntity[] = [];

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
    resolutionStatus: 'RESOLVED_BY_LEVEL_CHANGE',
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
    resolutionStatus: 'AUTO_RESOLVED',
    createdAt: new Date(Date.now() - 14 * 3600000).toISOString(),
    clearedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    clearedById: null,
    clearedByName: 'System Auto-Clear',
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
    resolutionStatus: 'RESOLVED_BY_LEVEL_CHANGE',
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
    resolutionStatus: 'AUTO_RESOLVED',
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    clearedAt: new Date(Date.now() - 46 * 3600000).toISOString(),
    clearedById: null,
    clearedByName: 'System Auto-Clear',
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
    resolutionStatus: 'RESOLVED_BY_LEVEL_CHANGE',
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
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DATABASES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((db: any) => ({
            ...sanitizeDatabaseEntity(db),
            lastCheckAt: db.lastCheckAt || db.updatedAt || new Date().toISOString(),
          }));
        }
      }
      const initialSanitized = INITIAL_DATABASES.map(sanitizeDatabaseEntity);
      localStorage.setItem(STORAGE_KEYS.DATABASES, JSON.stringify(initialSanitized));
      return initialSanitized;
    } catch (e) {}
    return INITIAL_DATABASES.map(sanitizeDatabaseEntity);
  },
  setDatabases(data: DatabaseEntity[]) {
    try {
      const sanitized = Array.isArray(data) ? data.map(sanitizeDatabaseEntity) : [];
      localStorage.setItem(STORAGE_KEYS.DATABASES, JSON.stringify(sanitized));
    } catch (e) {}
  },
  getDatabaseEngines(): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DATABASE_ENGINES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  },
  setDatabaseEngines(data: any[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.DATABASE_ENGINES, JSON.stringify(data));
    } catch (e) {}
  },
  getAlertNotificationMethods(): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ALERT_METHODS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  },
  setAlertNotificationMethods(data: any[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERT_METHODS, JSON.stringify(data));
    } catch (e) {}
  },
  getRawMeasurements(): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RAW_MEASUREMENTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  },
  setRawMeasurements(data: any[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.RAW_MEASUREMENTS, JSON.stringify(data));
    } catch (e) {}
  },
  getSystemSettings(): SystemSettingsEntity {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SYSTEM_SETTINGS);
      if (raw) {
        return { ...INITIAL_SYSTEM_SETTINGS, ...JSON.parse(raw) };
      }
      localStorage.setItem(STORAGE_KEYS.SYSTEM_SETTINGS, JSON.stringify(INITIAL_SYSTEM_SETTINGS));
    } catch (e) {}
    return INITIAL_SYSTEM_SETTINGS;
  },
  setSystemSettings(data: SystemSettingsEntity) {
    try {
      localStorage.setItem(STORAGE_KEYS.SYSTEM_SETTINGS, JSON.stringify(data));
    } catch (e) {}
  },
  getMetrics(): MetricEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.METRICS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((m: any) => ({
            ...m,
            isEnabled: m.isEnabled !== undefined ? m.isEnabled : true,
          }));
        }
      }
      localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(INITIAL_METRICS));
    } catch (e) {}
    return INITIAL_METRICS;
  },
  setMetrics(data: MetricEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(data));
    } catch (e) {}
  },
  getTemplates(): TemplateEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(INITIAL_TEMPLATES));
    } catch (e) {}
    return INITIAL_TEMPLATES;
  },
  setTemplates(data: TemplateEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(data));
    } catch (e) {}
  },
  getGroups(): GroupEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GROUPS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(INITIAL_GROUPS));
    } catch (e) {}
    return INITIAL_GROUPS;
  },
  setGroups(data: GroupEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(data));
    } catch (e) {}
  },
  getActiveAlerts(): ActiveAlertEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_ALERTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ALERTS, JSON.stringify(INITIAL_ACTIVE_ALERTS));
    } catch (e) {}
    return INITIAL_ACTIVE_ALERTS;
  },
  setActiveAlerts(data: ActiveAlertEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ALERTS, JSON.stringify(data));
    } catch (e) {}
  },
  getAlertHistory(): AlertHistoryEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ALERT_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEYS.ALERT_HISTORY, JSON.stringify(INITIAL_ALERT_HISTORY));
    } catch (e) {}
    return INITIAL_ALERT_HISTORY;
  },
  setAlertHistory(data: AlertHistoryEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERT_HISTORY, JSON.stringify(data));
    } catch (e) {}
  },
  getAlertNotificationLogs(): AlertNotificationLogEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ALERT_NOTIFICATION_LOGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEYS.ALERT_NOTIFICATION_LOGS, JSON.stringify(INITIAL_ALERT_NOTIFICATION_LOGS));
    } catch (e) {}
    return INITIAL_ALERT_NOTIFICATION_LOGS;
  },
  setAlertNotificationLogs(data: AlertNotificationLogEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERT_NOTIFICATION_LOGS, JSON.stringify(data));
    } catch (e) {}
  },
  addAlertNotificationLog(log: AlertNotificationLogEntity) {
    try {
      const current = this.getAlertNotificationLogs();
      const updated = [log, ...current].slice(0, 1000); // keep last 1000 logs
      this.setAlertNotificationLogs(updated);
    } catch (e) {}
  },
  getAlertNotificationQueue(): AlertNotificationQueueEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ALERT_NOTIFICATION_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEYS.ALERT_NOTIFICATION_QUEUE, JSON.stringify(INITIAL_ALERT_NOTIFICATION_QUEUE));
    } catch (e) {}
    return INITIAL_ALERT_NOTIFICATION_QUEUE;
  },
  setAlertNotificationQueue(data: AlertNotificationQueueEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERT_NOTIFICATION_QUEUE, JSON.stringify(data));
    } catch (e) {}
  },
  getDatabasePollQueue(): DatabasePollQueueEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DATABASE_POLL_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEYS.DATABASE_POLL_QUEUE, JSON.stringify(INITIAL_DATABASE_POLL_QUEUE));
    } catch (e) {}
    return INITIAL_DATABASE_POLL_QUEUE;
  },
  setDatabasePollQueue(data: DatabasePollQueueEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.DATABASE_POLL_QUEUE, JSON.stringify(data));
    } catch (e) {}
  },
  getDatabasePollLogs(): DatabasePollLogEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DATABASE_POLL_LOGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      localStorage.setItem(STORAGE_KEYS.DATABASE_POLL_LOGS, JSON.stringify(INITIAL_DATABASE_POLL_LOGS));
    } catch (e) {}
    return INITIAL_DATABASE_POLL_LOGS;
  },
  setDatabasePollLogs(data: DatabasePollLogEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.DATABASE_POLL_LOGS, JSON.stringify(data));
    } catch (e) {}
  },
  getMetricHistory(): MetricHistoryEntity[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.METRIC_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            objectName: item.objectName || 'INSTANCE',
          }));
        }
      }
      const initial = generateInitialMetricHistory();
      localStorage.setItem(STORAGE_KEYS.METRIC_HISTORY, JSON.stringify(initial));
      return initial;
    } catch (e) {}
    return generateInitialMetricHistory();
  },
  setMetricHistory(data: MetricHistoryEntity[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.METRIC_HISTORY, JSON.stringify(data));
    } catch (e) {}
  },
  resetData() {
    try {
      localStorage.removeItem(STORAGE_KEYS.DATABASES);
      localStorage.removeItem(STORAGE_KEYS.DATABASE_ENGINES);
      localStorage.removeItem(STORAGE_KEYS.ALERT_METHODS);
      localStorage.removeItem(STORAGE_KEYS.RAW_MEASUREMENTS);
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
    } catch (e) {}
  },
  resetToDefaults() {
    try {
      localStorage.removeItem(STORAGE_KEYS.DATABASES);
      localStorage.removeItem(STORAGE_KEYS.DATABASE_ENGINES);
      localStorage.removeItem(STORAGE_KEYS.ALERT_METHODS);
      localStorage.removeItem(STORAGE_KEYS.RAW_MEASUREMENTS);
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
    } catch (e) {}
  }
};
