import bcrypt from 'bcryptjs';
import {
  User,
  DatabaseEntity,
  DatabaseEngineEntity,
  AlertNotificationMethodEntity,
  MetricEntity,
  TemplateEntity,
  GroupEntity,
  ActiveAlertEntity,
  AlertHistoryEntity,
  MetricHistoryEntity,
  RawMeasurementEntity,
  RawMeasurementFilter,
  SystemSettingsEntity,
  SystemSettingItem,
  AuditLogEntity,
  AlertNotificationLogEntity,
  DatabasePollQueueEntity,
  DatabasePollLogEntity,
  AlertNotificationQueueEntity,
} from '../../src/types';
import { IStorageRepository } from './types';

export class MemoryRepository implements IStorageRepository {
  private userPasswords: Record<string, string> = {};
  private users: User[] = [];
  private databasePollQueue: DatabasePollQueueEntity[] = [];
  private databasePollLogs: DatabasePollLogEntity[] = [];
  private alertNotificationQueue: AlertNotificationQueueEntity[] = [
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
      senderIdList: '#dba-alerts-channel',
      dispatcherId: 'meth-slack-03',
      dispatcherName: 'Slack NOC Incident Channel',
      dispatcherType: 'SLACK',
      dispatcherConfig: JSON.stringify({ webhookUrl: 'https://hooks.slack.com/services/T00/B00/X00' }),
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
      dispatcherConfig: JSON.stringify({ botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ' }),
      lockedAt: new Date(Date.now() - 10000).toISOString(),
      lockedBy: 'dispatcher-worker-01',
    },
  ];

  constructor() {
    this.initUsersFromEnv();
  }

  private initUsersFromEnv() {
    const adminUser = (process.env.ADMIN_USERNAME || process.env.SEED_ADMIN_USERNAME || 'admin').trim();
    const adminPass = (process.env.ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'AdminPassword#2026').trim();

    const viewerUser = (process.env.VIEWER_USERNAME || process.env.SEED_VIEWER_USERNAME || 'viewer').trim();
    const viewerPass = (process.env.VIEWER_PASSWORD || process.env.SEED_VIEWER_PASSWORD || 'ViewerPassword#2026').trim();

    this.users = [
      {
        id: 'usr-admin-01',
        username: adminUser,
        role: 'ADMIN',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        lastLogin: new Date(Date.now() - 15 * 60000).toISOString(),
      },
      {
        id: 'usr-viewer-02',
        username: viewerUser,
        role: 'VIEWER',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        lastLogin: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
    ];

    this.userPasswords = {
      'usr-admin-01': bcrypt.hashSync(adminPass, 10),
      'usr-viewer-02': bcrypt.hashSync(viewerPass, 10),
    };

    // Support additional users configured in AUTH_USERS environment variable
    if (process.env.AUTH_USERS) {
      try {
        const parsed = JSON.parse(process.env.AUTH_USERS);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any, idx: number) => {
            if (u.username && u.password) {
              const uId = `usr-env-${idx + 1}`;
              this.users.push({
                id: uId,
                username: u.username.trim(),
                role: u.role === 'ADMIN' ? 'ADMIN' : 'VIEWER',
                createdAt: new Date().toISOString(),
              });
              this.userPasswords[uId] = bcrypt.hashSync(u.password.trim(), 10);
            }
          });
        }
      } catch (e) {
        const items = process.env.AUTH_USERS.split(',');
        items.forEach((item: string, idx: number) => {
          const parts = item.split(':');
          if (parts.length >= 2) {
            const uId = `usr-env-${idx + 1}`;
            this.users.push({
              id: uId,
              username: parts[0].trim(),
              role: parts[2]?.trim().toUpperCase() === 'ADMIN' ? 'ADMIN' : 'VIEWER',
              createdAt: new Date().toISOString(),
            });
            this.userPasswords[uId] = bcrypt.hashSync(parts[1].trim(), 10);
          }
        });
      }
    }
  }

  private auditLogs: AuditLogEntity[] = [
    {
      id: 'aud-01',
      userId: 'admin',
      clientIp: '127.0.0.1',
      actionType: 'LOGIN',
      targetEntity: 'AUTH',
      targetId: 'usr-admin-01',
      details: 'Administrator session initiated successfully',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  // Dynamic Database Engines Registry
  private databaseEngines: DatabaseEngineEntity[] = [
    {
      id: 'eng-01',
      dbCode: 'ORACLE',
      dbName: 'Oracle',
      dbColor: '#EA580C', // Orange
      defaultPort: 1521,
      statusOnOff: 'ACTIVE',
      description: 'Enterprise relational database management system developed by Oracle.',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'eng-02',
      dbCode: 'MYSQL',
      dbName: 'MySQL',
      dbColor: '#16A34A', // Green
      defaultPort: 3306,
      statusOnOff: 'ACTIVE',
      description: 'Open-source relational database management system powered by Oracle.',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'eng-03',
      dbCode: 'POSTGRES',
      dbName: 'PostgreSQL',
      dbColor: '#2563EB', // Blue
      defaultPort: 5432,
      statusOnOff: 'ACTIVE',
      description: 'Powerful, open-source object-relational database system with high SQL compliance.',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'eng-04',
      dbCode: 'MSSQL',
      dbName: 'Microsoft SQL Server',
      dbColor: '#0F172A', // Black / Dark Slate
      defaultPort: 1433,
      statusOnOff: 'ACTIVE',
      description: 'Enterprise relational database management system developed by Microsoft.',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'eng-05',
      dbCode: 'SINGLESTORE',
      dbName: 'SingleStore',
      dbColor: '#9333EA', // Purple
      defaultPort: 3306,
      statusOnOff: 'ACTIVE',
      description: 'Cloud-native, real-time distributed SQL database for transactions and analytics.',
      createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'eng-06',
      dbCode: 'MONGODB',
      dbName: 'MongoDB',
      dbColor: '#059669', // Green (Emerald)
      defaultPort: 27017,
      statusOnOff: 'ACTIVE',
      description: 'Document-oriented NoSQL database for flexible data modeling and clustering.',
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'eng-07',
      dbCode: 'REDIS',
      dbName: 'Redis',
      dbColor: '#D97706', // Orange / Amber
      defaultPort: 6379,
      statusOnOff: 'ACTIVE',
      description: 'In-memory data structure store used as a database, cache, and message broker.',
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];

  // Dynamic Alert Notification Methods
  private alertNotificationMethods: AlertNotificationMethodEntity[] = [
    {
      id: 'meth-email-01',
      name: 'Corporate SMTP Dispatcher',
      type: 'EMAIL',
      configJson: {
        smtpHost: 'smtp.mailgun.org',
        smtpPort: 587,
        smtpUser: 'alerts@dbfarm.internal',
        useTls: true,
        fromAddress: 'Database Sentinel <noreply-alerts@dbfarm.internal>',
      },
      statusOnOff: 'ACTIVE',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'meth-tg-02',
      name: 'Telegram Incident Operations Bot',
      type: 'TELEGRAM',
      configJson: {
        botToken: '6829103847:AAH9f_KzL2e-wZ5qM7Nx982Qp',
        apiBaseUrl: 'https://api.telegram.org',
        defaultChatTopic: 'DATABASE_OPERATIONS',
        parseMode: 'HTML',
      },
      statusOnOff: 'ACTIVE',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'meth-slack-03',
      name: 'Slack NOC Incident Channel',
      type: 'SLACK',
      configJson: {
        webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
        channelName: '#db-sentinel-alerts',
        username: 'DB Farm Sentinel',
      },
      statusOnOff: 'ACTIVE',
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];

  private systemSettings: SystemSettingsEntity = {
    apiCollectorEnabled: true,
    collectorEndpoint: 'http://localhost:3000/api/collector/mock-health',
    collectorApiKey: 'dbm_live_9f83a21b4e87901c23ef',
    collectorPollIntervalSeconds: 60,
    collectorBatchSize: 100,
    collectorTimeoutMs: 5000,
    collectorRetryPolicy: 'EXPONENTIAL_BACKOFF',

    globalAlertThresholdMode: 'STANDARD',
    maxRetryAttempts: 3,
    notificationDispatchIntervalSeconds: 30,
    defaultTimezone: 'Asia/Ho_Chi_Minh',
    dataRetentionDays: 90,
    autoClearResolvedAlerts: true,

    showInfoTips: true,
    sessionTimeoutMinutes: 30,
    SESSION_TIMEOUT_MINUTES: '30',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin',
  };

  private templates: TemplateEntity[] = [
    {
      id: 'tpl-ora-01',
      name: 'Oracle Enterprise Standard',
      targetDbType: 'ORACLE',
      databaseEngineId: 'eng-01',
      description: 'Standard health checks for Oracle Database instances (Tablespace, Active Sessions, Buffer Cache Hit Ratio).',
      metricIds: ['met-01', 'met-02'],
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'tpl-pg-01',
      name: 'PostgreSQL Core Health',
      targetDbType: 'POSTGRES',
      databaseEngineId: 'eng-03',
      description: 'Connection saturation, cache hit ratio, and replication lag metrics for PostgreSQL.',
      metricIds: ['met-03', 'met-04'],
      createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: 'tpl-my-01',
      name: 'MySQL Server Metrics',
      targetDbType: 'MYSQL',
      databaseEngineId: 'eng-02',
      description: 'Thread concurrency, InnoDB buffer pool, and slow queries.',
      metricIds: ['met-05', 'met-06'],
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'tpl-ms-01',
      name: 'SQL Server Enterprise Baseline',
      targetDbType: 'MSSQL',
      databaseEngineId: 'eng-04',
      description: 'Page Life Expectancy, buffer cache ratio, and batch requests per second.',
      metricIds: ['met-07'],
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'tpl-multi-01',
      name: 'Database Storage & Capacity Overview (Type 3)',
      targetDbType: 'POSTGRES',
      databaseEngineId: 'eng-03',
      description: 'Multi-attribute storage and tablespace analytics with per-attribute return value types and custom thresholds.',
      metricIds: ['met-08'],
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ];

  private metrics: MetricEntity[] = [
    {
      id: 'met-01',
      name: 'Tablespace Usage %',
      sqlQuery: 'SELECT tablespace_name AS object_name, ROUND((used_space/total_space)*100, 2) AS value FROM dba_tablespace_usage_metrics',
      valueType: 'NUMBER',
      relationalOperator: '>=',
      thresholdOperator: '>=',
      thresholdWarn: '80',
      thresholdHigh: '90',
      thresholdCritical: '95',
      cycle: 1,
      metricQueryType: 2,
      templateId: 'tpl-ora-01',
      templateName: 'Oracle Enterprise Standard',
      isEnabled: true,
      createdAt: new Date(Date.now() - 19 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'met-02',
      name: 'Active Sessions Count',
      sqlQuery: "SELECT username AS object_name, COUNT(*) AS value FROM v$session WHERE status = 'ACTIVE' AND type != 'BACKGROUND' GROUP BY username",
      valueType: 'NUMBER',
      relationalOperator: '>=',
      thresholdOperator: '>=',
      thresholdWarn: '150',
      thresholdHigh: '300',
      thresholdCritical: '500',
      cycle: 1,
      metricQueryType: 2,
      templateId: 'tpl-ora-01',
      templateName: 'Oracle Enterprise Standard',
      isEnabled: true,
      createdAt: new Date(Date.now() - 19 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'met-03',
      name: 'Connection Saturation %',
      sqlQuery: "SELECT datname AS object_name, ROUND((count(*)::numeric / current_setting('max_connections')::numeric) * 100, 2) AS value FROM pg_stat_activity GROUP BY datname",
      valueType: 'NUMBER',
      relationalOperator: '>=',
      thresholdOperator: '>=',
      thresholdWarn: '75',
      thresholdHigh: '85',
      thresholdCritical: '95',
      cycle: 1,
      metricQueryType: 2,
      templateId: 'tpl-pg-01',
      templateName: 'PostgreSQL Core Health',
      isEnabled: true,
      createdAt: new Date(Date.now() - 17 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: 'met-04',
      name: 'Replication Lag (Seconds)',
      sqlQuery: "SELECT application_name AS object_name, EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INT AS value FROM pg_stat_replication",
      valueType: 'NUMBER',
      relationalOperator: '>=',
      thresholdOperator: '>=',
      thresholdWarn: '30',
      thresholdHigh: '60',
      thresholdCritical: '120',
      cycle: 1,
      metricQueryType: 2,
      templateId: 'tpl-pg-01',
      templateName: 'PostgreSQL Core Health',
      isEnabled: true,
      createdAt: new Date(Date.now() - 17 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: 'met-05',
      name: 'Threads Connected',
      sqlQuery: "SELECT variable_name AS object_name, variable_value AS value FROM performance_schema.global_status WHERE variable_name = 'Threads_connected'",
      valueType: 'NUMBER',
      relationalOperator: '>=',
      thresholdOperator: '>=',
      thresholdWarn: '200',
      thresholdHigh: '400',
      thresholdCritical: '800',
      cycle: 1,
      metricQueryType: 1,
      templateId: 'tpl-my-01',
      templateName: 'MySQL Server Metrics',
      isEnabled: true,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'met-06',
      name: 'Read-Only Mode Flag',
      sqlQuery: "SELECT variable_name AS object_name, variable_value AS value FROM performance_schema.global_variables WHERE variable_name = 'read_only'",
      valueType: 'BOOLEAN',
      relationalOperator: '=',
      thresholdOperator: '=',
      thresholdWarn: 'ON',
      thresholdHigh: null,
      thresholdCritical: null,
      cycle: 1,
      metricQueryType: 1,
      templateId: 'tpl-my-01',
      templateName: 'MySQL Server Metrics',
      isEnabled: false,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'met-07',
      name: 'Page Life Expectancy (PLE)',
      sqlQuery: "SELECT counter_name AS object_name, cntr_value AS value FROM sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy'",
      valueType: 'NUMBER',
      relationalOperator: '<=',
      thresholdOperator: '<=',
      thresholdWarn: '300',
      thresholdHigh: '150',
      thresholdCritical: '60',
      cycle: 1,
      metricQueryType: 1,
      templateId: 'tpl-ms-01',
      templateName: 'SQL Server Enterprise Baseline',
      isEnabled: true,
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'met-08',
      name: 'Tablespace & File Storage Analytics',
      sqlQuery: `SELECT 
  spcname AS object_name,
  pg_tablespace_size(oid) / (1024*1024) AS size_mb,
  ROUND(100.0 * (pg_tablespace_size(oid)::numeric / 107374182400.0), 2) AS usage_pct,
  (CASE WHEN pg_is_in_recovery() THEN 'STANDBY' ELSE 'PRIMARY' END) AS node_role,
  (pg_tablespace_location(oid) IS NOT NULL) AS is_custom_location
FROM pg_tablespace`,
      valueType: 'NUMBER',
      relationalOperator: '>=',
      cycle: 1,
      metricQueryType: 3,
      thresholdsConfig: {
        type: 'PER_ATTRIBUTE',
        perAttribute: [
          {
            attributeName: 'usage_pct',
            valueType: 'NUMBER',
            relationalOperator: '>=',
            warn: '80',
            high: '90',
            critical: '95',
          },
          {
            attributeName: 'size_mb',
            valueType: 'NUMBER',
            relationalOperator: '>=',
            warn: '75000',
            high: '90000',
            critical: '98000',
          },
          {
            attributeName: 'node_role',
            valueType: 'STRING',
            relationalOperator: '!=',
            warn: 'STANDBY',
            critical: 'OFFLINE',
          },
          {
            attributeName: 'is_custom_location',
            valueType: 'BOOLEAN',
            relationalOperator: '=',
            warn: 'false',
          },
        ],
      },
      templateId: 'tpl-multi-01',
      templateName: 'Database Storage & Capacity Overview (Type 3)',
      isEnabled: true,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ];

  private groups: GroupEntity[] = [
    {
      id: 'grp-01',
      name: 'Production Core Tier',
      description: 'High-availability primary clusters handling core transactional workload.',
      databaseIds: ['db-01', 'db-02', 'db-03', 'db-05'],
      templateIds: ['tpl-ora-01', 'tpl-pg-01', 'tpl-my-01'],
      alertMethodIds: ['meth-email-01', 'meth-tg-02'],
      senderIds: '-1001928374650, -1009876543210, dba-oncall@company.internal',
      createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'grp-02',
      name: 'Analytics & Reporting Tier',
      description: 'Read replicas, ETL data warehouses, and reporting compute nodes.',
      databaseIds: ['db-04', 'db-05'],
      templateIds: ['tpl-ms-01', 'tpl-my-01', 'tpl-multi-01'],
      alertMethodIds: ['meth-email-01'],
      senderIds: 'bi-infra@company.internal',
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ];

  private databases: DatabaseEntity[] = [
    {
      id: 'db-01',
      name: 'ERP_PROD_ORA',
      dbType: 'ORACLE',
      host: '10.0.10.45',
      port: 1521,
      tags: ['PRODUCTION', 'CRITICAL', 'PRIMARY'],
      pollIntervalMinutes: 5,
      note: 'Primary ERP transactional Oracle cluster. High availability database node.',
      authMethod: 'PASSWORD',
      username: 'dbmon_user',
      password: 'enc_password_sec_01',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      databaseName: 'ORCLPDB1.internal',
      environment: 'PRODUCTION',
      connectionConfig: { serviceName: 'ORCLPDB1.internal', sid: 'ORCL' },
      groupIds: ['grp-01'],
      metricIds: ['met-01', 'met-02'],
      createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      status: 'WARNING',
      lastCheckAt: new Date(Date.now() - 45 * 1000).toISOString(),
      isEnabled: true,
    },
    {
      id: 'db-02',
      name: 'PAYMENT_API_PG',
      dbType: 'POSTGRES',
      host: '10.0.12.88',
      port: 5432,
      tags: ['PRODUCTION', 'FINANCE', 'CRITICAL'],
      pollIntervalMinutes: 2,
      note: 'PCI-DSS compliant payment gateway core ledger database.',
      authMethod: 'PASSWORD',
      username: 'pg_monitor',
      password: 'enc_password_sec_02',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      databaseName: 'payment_gateway',
      environment: 'PRODUCTION',
      connectionConfig: { databaseName: 'payment_gateway', sslMode: 'require' },
      groupIds: ['grp-01'],
      metricIds: ['met-03', 'met-04', 'met-08'],
      createdAt: new Date(Date.now() - 22 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      status: 'UP',
      lastCheckAt: new Date(Date.now() - 30 * 1000).toISOString(),
      isEnabled: true,
    },
    {
      id: 'db-03',
      name: 'CRM_PORTAL_MY',
      dbType: 'MYSQL',
      host: '10.0.20.102',
      port: 3306,
      tags: ['STAGING', 'ANALYTICS'],
      pollIntervalMinutes: 5,
      note: 'Customer relationship portal staging replica.',
      authMethod: 'PASSWORD',
      username: 'mysql_collector',
      password: 'enc_password_sec_03',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      databaseName: 'crm_production',
      environment: 'PRODUCTION',
      connectionConfig: { databaseName: 'crm_production' },
      groupIds: ['grp-01'],
      metricIds: ['met-05', 'met-06'],
      createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      status: 'WARNING',
      lastCheckAt: new Date(Date.now() - 60 * 1000).toISOString(),
      isEnabled: true,
    },
    {
      id: 'db-04',
      name: 'DW_REPORTS_MS',
      dbType: 'MSSQL',
      host: '10.0.30.55',
      port: 1433,
      tags: ['LAB', 'ANALYTICS'],
      pollIntervalMinutes: 10,
      note: 'Data warehouse batch reporting engine for executive dashboards.',
      authMethod: 'PASSWORD',
      username: 'sql_mon',
      password: 'enc_password_sec_04',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      databaseName: 'DW_BI_REPORTS',
      environment: 'PRODUCTION',
      connectionConfig: { databaseName: 'DW_BI_REPORTS', encrypt: true, trustServerCertificate: false },
      groupIds: ['grp-02'],
      metricIds: ['met-07'],
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      status: 'UP',
      lastCheckAt: new Date(Date.now() - 120 * 1000).toISOString(),
      isEnabled: true,
    },
    {
      id: 'db-05',
      name: 'INVENTORY_STG_MY',
      dbType: 'MYSQL',
      host: '10.0.40.72',
      port: 3306,
      tags: ['DEV', 'LAB'],
      pollIntervalMinutes: 5,
      note: 'Inventory management development integration server.',
      authMethod: 'PASSWORD',
      username: 'stg_reader',
      password: 'enc_password_sec_05',
      databaseName: 'inventory_staging',
      environment: 'STAGING',
      connectionConfig: { databaseName: 'inventory_staging' },
      groupIds: ['grp-01', 'grp-02'],
      metricIds: ['met-05', 'met-06'],
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      status: 'DOWN',
      lastCheckAt: new Date(Date.now() - 5 * 60000).toISOString(),
      isEnabled: true,
    },
  ];

  private nextActiveAlertId = 4;
  private nextAlertHistoryId = 3;

  private activeAlerts: ActiveAlertEntity[] = [
    {
      id: '1',
      dbId: 'db-03',
      dbName: 'CRM_PORTAL_MY',
      metricId: 'met-05',
      metricName: 'Threads Connected',
      objectName: 'crm_production',
      alertLevel: 'WARN',
      message: 'Threads Connected (212) breached Warning threshold (200). Host: 10.0.20.102:3306.',
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    },
    {
      id: '2',
      dbId: 'db-05',
      dbName: 'INVENTORY_STG_MY',
      metricId: 'met-06',
      metricName: 'Slow Queries Rate',
      objectName: 'inventory_staging',
      alertLevel: 'DOWN',
      message: 'Database Endpoint unreachable on TCP 10.0.40.72:3306. Connection refused.',
      createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    },
    {
      id: '3',
      dbId: 'db-01',
      dbName: 'ERP_PROD_ORA',
      metricId: 'met-01',
      metricName: 'Tablespace Usage %',
      objectName: 'TS_DATA_PRD',
      alertLevel: 'HIGH',
      message: 'Tablespace TS_DATA_PRD usage (91.40%) breached High threshold (90.00%).',
      createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
    },
  ];

  private alertHistory: AlertHistoryEntity[] = [
    {
      id: '1',
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      metricId: 'met-03',
      metricName: 'Connection Saturation %',
      objectName: 'payment_ledger',
      alertLevel: 'HIGH',
      message: 'Connection Saturation % (87.50%) breached High threshold (85.00%).',
      resolutionStatus: 'RESOLVED_BY_LEVEL_CHANGE',
      createdAt: new Date(Date.now() - 180 * 60000).toISOString(),
      clearedAt: new Date(Date.now() - 120 * 60000).toISOString(),
      clearedById: 'usr-admin-01',
      clearedByName: 'admin',
    },
    {
      id: '2',
      dbId: 'db-01',
      dbName: 'ERP_PROD_ORA',
      metricId: 'met-02',
      metricName: 'Active Sessions Count',
      objectName: 'SYSDBA',
      alertLevel: 'CRITICAL',
      message: 'Active Sessions Count (512) breached Critical threshold (500).',
      resolutionStatus: 'AUTO_RESOLVED',
      createdAt: new Date(Date.now() - 360 * 60000).toISOString(),
      clearedAt: new Date(Date.now() - 240 * 60000).toISOString(),
      clearedById: null,
      clearedByName: 'System Auto-Clear',
    },
  ];

  private metricHistory: MetricHistoryEntity[] = [
    {
      id: 'mh-01',
      dbId: 'db-01',
      dbName: 'ERP_PROD_ORA',
      metricId: 'met-01',
      metricName: 'Tablespace Usage %',
      objectName: 'TS_DATA_PRD',
      attributeName: 'used_space_pct',
      value: '91.4',
      createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    },
    {
      id: 'mh-02',
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      metricId: 'met-03',
      metricName: 'Connection Saturation %',
      objectName: 'payment_ledger',
      attributeName: 'conn_saturation_pct',
      value: '68.2',
      createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    },
  ];

  // Raw Query & Data Measurement History Records
  private alertNotificationLogs: AlertNotificationLogEntity[] = [
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
      dispatcherConfig: JSON.stringify({ botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ', defaultChatId: '-1001234567890' }),
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
      dispatcherConfig: JSON.stringify({ botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ' }),
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
      senderIdList: '#dba-alerts-channel',
      dispatcherId: 'meth-slack-03',
      dispatcherName: 'Slack NOC Incident Channel',
      dispatcherType: 'SLACK',
      dispatcherConfig: JSON.stringify({ webhookUrl: 'https://hooks.slack.com/services/T00/B00/X00' }),
      responseSuccess: true,
      responseStatus: '200 OK',
      responseDetail: 'HTTP 200 ok (Slack Webhook API)',
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
      senderIdList: '+84901234567, +84907654321',
      dispatcherId: 'meth-sms-04',
      dispatcherName: 'SMS Gateway (Twilio)',
      dispatcherType: 'SMS',
      dispatcherConfig: JSON.stringify({ accountSid: 'AC1234567890' }),
      responseSuccess: false,
      responseStatus: '429 Rate Limit Exceeded',
      responseDetail: 'HTTP 429 Too Many Requests: Rate limit exceeded on SMS provider',
      lockedAt: new Date(Date.now() - 5 * 3600000 - 5000).toISOString(),
      lockedBy: 'worker-node-01',
      finishedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
  ];

  private rawMeasurements: RawMeasurementEntity[] = [
    // --- DB-01 (ERP_PROD_ORA - Oracle) ---
    // met-01: Tablespace Usage % (TS_DATA_PRD, SYSTEM, SYSAUX, USERS)
    ...[
      { obj: 'TS_DATA_PRD', val: '91.4%', stat: 'HIGH' as const, trig: 'Warn: 80 / High: 90 / Crit: 95 (>=)', minAgo: 2 },
      { obj: 'TS_DATA_PRD', val: '89.8%', stat: 'WARN' as const, trig: 'Warn: 80 / High: 90 / Crit: 95 (>=)', minAgo: 10 },
      { obj: 'TS_DATA_PRD', val: '88.5%', stat: 'WARN' as const, trig: 'Warn: 80 / High: 90 / Crit: 95 (>=)', minAgo: 30 },
      { obj: 'TS_DATA_PRD', val: '86.2%', stat: 'WARN' as const, trig: 'Warn: 80 / High: 90 / Crit: 95 (>=)', minAgo: 60 },
      { obj: 'TS_DATA_PRD', val: '84.0%', stat: 'WARN' as const, trig: 'Warn: 80 / High: 90 / Crit: 95 (>=)', minAgo: 180 },
      { obj: 'TS_DATA_PRD', val: '78.5%', stat: 'NORMAL' as const, trig: null, minAgo: 360 },
      { obj: 'TS_DATA_PRD', val: '76.1%', stat: 'NORMAL' as const, trig: null, minAgo: 720 },
      { obj: 'TS_DATA_PRD', val: '74.8%', stat: 'NORMAL' as const, trig: null, minAgo: 1440 },
      { obj: 'SYSTEM', val: '99.8%', stat: 'FATAL' as const, trig: 'Fatal: 99.0 (>=)', minAgo: 1 },
      { obj: 'SYSTEM', val: '98.5%', stat: 'CRITICAL' as const, trig: 'Crit: 95 (>=)', minAgo: 15 },
      { obj: 'SYSTEM', val: '96.2%', stat: 'CRITICAL' as const, trig: 'Crit: 95 (>=)', minAgo: 45 },
      { obj: 'SYSTEM', val: '94.0%', stat: 'HIGH' as const, trig: 'High: 90 (>=)', minAgo: 120 },
      { obj: 'SYSTEM', val: '92.1%', stat: 'HIGH' as const, trig: 'High: 90 (>=)', minAgo: 300 },
      { obj: 'SYSAUX', val: '72.4%', stat: 'NORMAL' as const, trig: null, minAgo: 5 },
      { obj: 'SYSAUX', val: '71.8%', stat: 'NORMAL' as const, trig: null, minAgo: 60 },
      { obj: 'SYSAUX', val: '70.2%', stat: 'NORMAL' as const, trig: null, minAgo: 360 },
      { obj: 'USERS', val: '54.2%', stat: 'NORMAL' as const, trig: null, minAgo: 5 },
      { obj: 'USERS', val: '53.8%', stat: 'NORMAL' as const, trig: null, minAgo: 120 },
      { obj: 'USERS', val: '51.0%', stat: 'NORMAL' as const, trig: null, minAgo: 720 },
    ].map((item, idx) => ({
      id: `raw-ora-ts-${idx + 1}`,
      dbId: 'db-01',
      dbName: 'ERP_PROD_ORA',
      dbType: 'ORACLE' as const,
      metricId: 'met-01',
      metricName: 'Tablespace Usage %',
      objectName: item.obj,
      attributeName: 'used_space_pct',
      value: item.val,
      valueType: 'NUMBER' as const,
      thresholdOperator: '>=',
      triggeredThreshold: item.trig,
      cycle: 1,
      status: item.stat,
      measuredAt: new Date(Date.now() - item.minAgo * 60000).toISOString(),
    })),

    // met-02: Active Sessions Count (SYSDBA, APPS_USER, BATCH_JOB)
    ...[
      { obj: 'SYSDBA', val: '184', stat: 'WARN' as const, trig: 'Warn: 150 / High: 300 / Crit: 500 (>=)', minAgo: 3 },
      { obj: 'SYSDBA', val: '520', stat: 'CRITICAL' as const, trig: 'Crit: 500 (>=)', minAgo: 4 },
      { obj: 'SYSDBA', val: '310', stat: 'HIGH' as const, trig: 'High: 300 (>=)', minAgo: 15 },
      { obj: 'SYSDBA', val: '142', stat: 'NORMAL' as const, trig: null, minAgo: 45 },
      { obj: 'SYSDBA', val: '98', stat: 'NORMAL' as const, trig: null, minAgo: 120 },
      { obj: 'SYSDBA', val: '65', stat: 'NORMAL' as const, trig: null, minAgo: 360 },
      { obj: 'SYSDBA', val: '45', stat: 'NORMAL' as const, trig: null, minAgo: 720 },
      { obj: 'APPS_USER', val: '142', stat: 'NORMAL' as const, trig: null, minAgo: 3 },
      { obj: 'APPS_USER', val: '168', stat: 'WARN' as const, trig: 'Warn: 150 (>=)', minAgo: 20 },
      { obj: 'APPS_USER', val: '120', stat: 'NORMAL' as const, trig: null, minAgo: 90 },
      { obj: 'APPS_USER', val: '80', stat: 'NORMAL' as const, trig: null, minAgo: 300 },
      { obj: 'BATCH_JOB', val: '28', stat: 'NORMAL' as const, trig: null, minAgo: 3 },
      { obj: 'BATCH_JOB', val: '315', stat: 'HIGH' as const, trig: 'High: 300 (>=)', minAgo: 60 },
      { obj: 'BATCH_JOB', val: '15', stat: 'NORMAL' as const, trig: null, minAgo: 240 },
    ].map((item, idx) => ({
      id: `raw-ora-sess-${idx + 1}`,
      dbId: 'db-01',
      dbName: 'ERP_PROD_ORA',
      dbType: 'ORACLE' as const,
      metricId: 'met-02',
      metricName: 'Active Sessions Count',
      objectName: item.obj,
      attributeName: 'active_sessions',
      value: item.val,
      valueType: 'NUMBER' as const,
      thresholdOperator: '>=',
      triggeredThreshold: item.trig,
      cycle: 1,
      status: item.stat,
      measuredAt: new Date(Date.now() - item.minAgo * 60000).toISOString(),
    })),

    // --- DB-02 (PAYMENT_API_PG - PostgreSQL) ---
    // met-03: Connection Saturation %
    ...[
      { obj: 'payment_gateway', val: '62.4%', stat: 'NORMAL' as const, minAgo: 4 },
      { obj: 'payment_gateway', val: '78.2%', stat: 'WARN' as const, minAgo: 15 },
      { obj: 'payment_gateway', val: '86.5%', stat: 'HIGH' as const, minAgo: 35 },
      { obj: 'payment_gateway', val: '58.0%', stat: 'NORMAL' as const, minAgo: 90 },
      { obj: 'payment_gateway', val: '45.2%', stat: 'NORMAL' as const, minAgo: 240 },
      { obj: 'payment_gateway', val: '38.0%', stat: 'NORMAL' as const, minAgo: 720 },
      { obj: 'api_pool', val: '42.1%', stat: 'NORMAL' as const, minAgo: 4 },
      { obj: 'api_pool', val: '55.0%', stat: 'NORMAL' as const, minAgo: 60 },
      { obj: 'api_pool', val: '31.4%', stat: 'NORMAL' as const, minAgo: 360 },
    ].map((item, idx) => ({
      id: `raw-pg-conn-${idx + 1}`,
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      dbType: 'POSTGRES' as const,
      metricId: 'met-03',
      metricName: 'Connection Saturation %',
      objectName: item.obj,
      attributeName: 'active_connections_pct',
      value: item.val,
      valueType: 'NUMBER' as const,
      thresholdOperator: '>=',
      triggeredThreshold: item.stat !== 'NORMAL' ? 'Warn: 75 / High: 85 (>=)' : null,
      cycle: 1,
      status: item.stat,
      measuredAt: new Date(Date.now() - item.minAgo * 60000).toISOString(),
    })),

    // met-04: Replication Lag (Seconds)
    ...[
      { obj: 'replica_standby_01', val: '0s', stat: 'NORMAL' as const, minAgo: 5 },
      { obj: 'replica_standby_01', val: '42s', stat: 'WARN' as const, minAgo: 30 },
      { obj: 'replica_standby_01', val: '12s', stat: 'NORMAL' as const, minAgo: 120 },
      { obj: 'replica_standby_01', val: '0s', stat: 'NORMAL' as const, minAgo: 360 },
      { obj: 'replica_standby_02', val: '2s', stat: 'NORMAL' as const, minAgo: 5 },
      { obj: 'replica_standby_02', val: '15s', stat: 'NORMAL' as const, minAgo: 60 },
    ].map((item, idx) => ({
      id: `raw-pg-repl-${idx + 1}`,
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      dbType: 'POSTGRES' as const,
      metricId: 'met-04',
      metricName: 'Replication Lag (Seconds)',
      objectName: item.obj,
      attributeName: 'lag_seconds',
      value: item.val,
      valueType: 'NUMBER' as const,
      thresholdOperator: '>=',
      triggeredThreshold: item.stat !== 'NORMAL' ? 'Warn: 30 (>=)' : null,
      cycle: 1,
      status: item.stat,
      measuredAt: new Date(Date.now() - item.minAgo * 60000).toISOString(),
    })),

    // met-08: Tablespace & File Storage Analytics (Type 3)
    ...[
      { obj: 'pg_default', attr: 'usage_pct', val: '74.2%', stat: 'NORMAL' as const, minAgo: 6 },
      { obj: 'pg_default', attr: 'usage_pct', val: '73.8%', stat: 'NORMAL' as const, minAgo: 60 },
      { obj: 'pg_default', attr: 'usage_pct', val: '72.0%', stat: 'NORMAL' as const, minAgo: 360 },
      { obj: 'pg_default', attr: 'size_mb', val: '81920', stat: 'NORMAL' as const, minAgo: 6 },
      { obj: 'pg_default', attr: 'size_mb', val: '81500', stat: 'NORMAL' as const, minAgo: 60 },
      { obj: 'pg_default', attr: 'node_role', val: 'PRIMARY', stat: 'NORMAL' as const, minAgo: 6 },
      { obj: 'pg_global', attr: 'usage_pct', val: '18.4%', stat: 'NORMAL' as const, minAgo: 6 },
      { obj: 'pg_global', attr: 'size_mb', val: '2048', stat: 'NORMAL' as const, minAgo: 6 },
      { obj: 'pg_global', attr: 'node_role', val: 'PRIMARY', stat: 'NORMAL' as const, minAgo: 6 },
    ].map((item, idx) => ({
      id: `raw-pg-t3-${idx + 1}`,
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      dbType: 'POSTGRES' as const,
      metricId: 'met-08',
      metricName: 'Tablespace & File Storage Analytics',
      objectName: item.obj,
      attributeName: item.attr,
      value: item.val,
      valueType: item.attr === 'node_role' ? ('STRING' as const) : ('NUMBER' as const),
      thresholdOperator: '>=',
      triggeredThreshold: null,
      cycle: 1,
      status: item.stat,
      measuredAt: new Date(Date.now() - item.minAgo * 60000).toISOString(),
    })),

    // --- DB-03 (CRM_PORTAL_MY - MySQL) ---
    // met-05: Threads Connected
    ...[
      { obj: 'crm_production', val: '212', stat: 'WARNING' as const, trig: 'Warn: 200 / High: 400 / Crit: 800 (>=)', minAgo: 8 },
      { obj: 'crm_production', val: '185', stat: 'NORMAL' as const, trig: null, minAgo: 25 },
      { obj: 'crm_production', val: '320', stat: 'WARN' as const, trig: 'Warn: 200 (>=)', minAgo: 75 },
      { obj: 'crm_production', val: '140', stat: 'NORMAL' as const, trig: null, minAgo: 180 },
      { obj: 'crm_production', val: '95', stat: 'NORMAL' as const, trig: null, minAgo: 720 },
      { obj: 'crm_analytics', val: '45', stat: 'NORMAL' as const, trig: null, minAgo: 8 },
      { obj: 'crm_analytics', val: '80', stat: 'NORMAL' as const, trig: null, minAgo: 60 },
    ].map((item, idx) => ({
      id: `raw-my-th-${idx + 1}`,
      dbId: 'db-03',
      dbName: 'CRM_PORTAL_MY',
      dbType: 'MYSQL' as const,
      metricId: 'met-05',
      metricName: 'Threads Connected',
      objectName: item.obj,
      attributeName: 'threads_connected',
      value: item.val,
      valueType: 'NUMBER' as const,
      thresholdOperator: '>=',
      triggeredThreshold: item.trig,
      cycle: 1,
      status: item.stat,
      measuredAt: new Date(Date.now() - item.minAgo * 60000).toISOString(),
    })),

    // --- DB-04 (DW_REPORTS_MS - SQL Server) ---
    // met-07: Page Life Expectancy (PLE)
    ...[
      { obj: 'Buffer Manager', val: '640s', stat: 'NORMAL' as const, trig: null, minAgo: 10 },
      { obj: 'Buffer Manager', val: '240s', stat: 'WARN' as const, trig: 'Warn: 300 (<=)', minAgo: 120 },
      { obj: 'Buffer Manager', val: '480s', stat: 'NORMAL' as const, trig: null, minAgo: 240 },
      { obj: 'Buffer Manager', val: '720s', stat: 'NORMAL' as const, trig: null, minAgo: 720 },
      { obj: 'Buffer Manager', val: '850s', stat: 'NORMAL' as const, trig: null, minAgo: 1440 },
    ].map((item, idx) => ({
      id: `raw-ms-ple-${idx + 1}`,
      dbId: 'db-04',
      dbName: 'DW_REPORTS_MS',
      dbType: 'MSSQL' as const,
      metricId: 'met-07',
      metricName: 'Page Life Expectancy (PLE)',
      objectName: item.obj,
      attributeName: 'cntr_value',
      value: item.val,
      valueType: 'NUMBER' as const,
      thresholdOperator: '<=',
      triggeredThreshold: item.trig,
      cycle: 1,
      status: item.stat,
      measuredAt: new Date(Date.now() - item.minAgo * 60000).toISOString(),
    })),

    // --- DB-05 (INVENTORY_STG_MY - MySQL) ---
    {
      id: 'raw-09',
      dbId: 'db-05',
      dbName: 'INVENTORY_STG_MY',
      dbType: 'MYSQL',
      metricId: 'met-05',
      metricName: 'Threads Connected',
      objectName: 'inventory_staging',
      attributeName: 'connection_status',
      value: 'CONN_TIMEOUT',
      valueType: 'STRING',
      thresholdOperator: '!=',
      triggeredThreshold: 'Connection refused on TCP port 3306',
      cycle: 1,
      status: 'DOWN',
      measuredAt: new Date(Date.now() - 12 * 60000).toISOString(),
    },
    {
      id: 'raw-09b',
      dbId: 'db-05',
      dbName: 'INVENTORY_STG_MY',
      dbType: 'MYSQL',
      metricId: 'met-05',
      metricName: 'Threads Connected',
      objectName: 'inventory_staging',
      attributeName: 'threads_connected',
      value: '45',
      valueType: 'NUMBER',
      thresholdOperator: '>=',
      triggeredThreshold: null,
      cycle: 1,
      status: 'NORMAL',
      measuredAt: new Date(Date.now() - 60 * 60000).toISOString(),
    },
  ];

  getStorageType(): 'memory' {
    return 'memory';
  }

  // --- Users ---
  async getUsers(): Promise<User[]> {
    return this.users;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async saveUser(userData: Partial<User> & { password?: string }): Promise<User> {
    const isEdit = !!userData.id;
    let userRecord: User;

    if (isEdit) {
      const idx = this.users.findIndex((u) => u.id === userData.id);
      if (idx === -1) throw new Error(`User with ID ${userData.id} not found.`);
      this.users[idx] = {
        ...this.users[idx],
        username: userData.username ?? this.users[idx].username,
        role: userData.role ?? this.users[idx].role,
        isLocked: userData.isLocked !== undefined ? userData.isLocked : this.users[idx].isLocked,
        lastLogin: userData.lastLogin ?? this.users[idx].lastLogin,
      };
      userRecord = this.users[idx];

      if (userData.password) {
        const hash = await bcrypt.hash(userData.password, 10);
        this.userPasswords[userRecord.id] = hash;
      }
    } else {
      if (!userData.username) throw new Error('Username is required.');
      const existing = this.users.find((u) => u.username.toLowerCase() === userData.username!.toLowerCase());
      if (existing) throw new Error(`Username "${userData.username}" is already taken.`);

      const newId = userData.id || `usr-${Date.now().toString().slice(-4)}`;
      userRecord = {
        id: newId,
        username: userData.username,
        role: userData.role || 'VIEWER',
        isLocked: userData.isLocked || false,
        createdAt: new Date().toISOString(),
      };
      this.users.push(userRecord);

      const password = userData.password || 'TemporaryPassword#2026';
      const hash = await bcrypt.hash(password, 10);
      this.userPasswords[newId] = hash;
    }

    return userRecord;
  }

  async deleteUser(id: string): Promise<boolean> {
    const userToDelete = this.users.find((u) => u.id === id);
    if (userToDelete && userToDelete.role === 'ADMIN') {
      const remainingAdmins = this.users.filter((u) => u.role === 'ADMIN' && u.id !== id);
      if (remainingAdmins.length === 0) {
        throw new Error('Action denied: Cannot remove the last administrative user account.');
      }
    }

    this.users = this.users.filter((u) => u.id !== id);
    delete this.userPasswords[id];
    return true;
  }

  async verifyUserPassword(username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> {
    const trimmedUsername = (username || '').trim();
    const trimmedPassword = (password || '').trim();
    const user = this.users.find((u) => u.username.toLowerCase() === trimmedUsername.toLowerCase());
    if (!user) {
      return { success: false, message: 'Invalid username. No matching account found.' };
    }
    if (user.isLocked) {
      return { success: false, message: 'This account is locked. Please contact your system administrator.' };
    }

    const normUser = user.username.toLowerCase();
    
    // Check against current environment variables
    const adminUser = (process.env.ADMIN_USERNAME || process.env.SEED_ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const adminPass = (process.env.ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'AdminPassword#2026').trim();

    const viewerUser = (process.env.VIEWER_USERNAME || process.env.SEED_VIEWER_USERNAME || 'viewer').trim().toLowerCase();
    const viewerPass = (process.env.VIEWER_PASSWORD || process.env.SEED_VIEWER_PASSWORD || 'ViewerPassword#2026').trim();

    let isMatch = false;

    if (normUser === adminUser && trimmedPassword === adminPass) {
      isMatch = true;
    } else if (normUser === viewerUser && trimmedPassword === viewerPass) {
      isMatch = true;
    } else {
      const hash = this.userPasswords[user.id];
      if (hash) {
        try {
          if (hash.startsWith('$2') || hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
            isMatch = await bcrypt.compare(trimmedPassword, hash);
          } else {
            isMatch = hash === trimmedPassword;
          }
        } catch {
          isMatch = hash === trimmedPassword;
        }
      }
    }

    if (!isMatch) {
      return { success: false, message: 'Invalid password. Credentials verification failed.' };
    }
    return { success: true, user };
  }

  // --- Database Engines (Dynamic Registry) ---
  async getDatabaseEngines(): Promise<DatabaseEngineEntity[]> {
    return this.databaseEngines;
  }

  async saveDatabaseEngine(engineData: Partial<DatabaseEngineEntity>): Promise<DatabaseEngineEntity> {
    if (engineData.id) {
      const idx = this.databaseEngines.findIndex((e) => e.id === engineData.id || e.dbCode.toUpperCase() === engineData.dbCode?.toUpperCase());
      if (idx !== -1) {
        this.databaseEngines[idx] = {
          ...this.databaseEngines[idx],
          ...engineData,
          updatedAt: new Date().toISOString(),
        } as DatabaseEngineEntity;
        return this.databaseEngines[idx];
      }
    }
    const newEngine: DatabaseEngineEntity = {
      id: engineData.id || `eng-${Date.now().toString().slice(-4)}`,
      dbCode: (engineData.dbCode || 'CUSTOM').toUpperCase(),
      dbName: engineData.dbName || engineData.dbCode || 'Custom Engine',
      dbColor: engineData.dbColor || '#2563EB',
      defaultPort: engineData.defaultPort || 5432,
      statusOnOff: engineData.statusOnOff || 'ACTIVE',
      description: engineData.description || null as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.databaseEngines = [...this.databaseEngines, newEngine];
    return newEngine;
  }

  async deleteDatabaseEngine(id: string): Promise<boolean> {
    this.databaseEngines = this.databaseEngines.filter((e) => e.id !== id && e.dbCode !== id);
    return true;
  }

  // --- Alert Notification Methods ---
  async getAlertNotificationMethods(): Promise<AlertNotificationMethodEntity[]> {
    return this.alertNotificationMethods;
  }

  async saveAlertNotificationMethod(methodData: Partial<AlertNotificationMethodEntity>): Promise<AlertNotificationMethodEntity> {
    if (methodData.id) {
      const idx = this.alertNotificationMethods.findIndex((m) => m.id === methodData.id);
      if (idx !== -1) {
        this.alertNotificationMethods[idx] = {
          ...this.alertNotificationMethods[idx],
          ...methodData,
          updatedAt: new Date().toISOString(),
        } as AlertNotificationMethodEntity;
        return this.alertNotificationMethods[idx];
      }
    }
    const newMethod: AlertNotificationMethodEntity = {
      id: methodData.id || `meth-${Date.now().toString().slice(-4)}`,
      name: methodData.name || 'New Alert Dispatcher',
      type: methodData.type || 'EMAIL',
      configJson: methodData.configJson || {},
      statusOnOff: methodData.statusOnOff || 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.alertNotificationMethods = [...this.alertNotificationMethods, newMethod];
    return newMethod;
  }

  async deleteAlertNotificationMethod(id: string): Promise<boolean> {
    this.alertNotificationMethods = this.alertNotificationMethods.filter((m) => m.id !== id);
    return true;
  }

  // --- Databases ---
  private syncDatabaseMetrics(): void {
    const groupMap = new Map(this.groups.map((g) => [g.id, g]));
    const templateMap = new Map(this.templates.map((t) => [t.id, t]));

    this.databases = this.databases.map((db) => {
      const attachedGroupIds = db.groupIds || [];
      const attachedTemplateIds = new Set<string>();

      attachedGroupIds.forEach((gid) => {
        const group = groupMap.get(gid);
        if (group && group.templateIds) {
          group.templateIds.forEach((tid) => attachedTemplateIds.add(tid));
        }
      });

      const compatibleTemplateIds = new Set<string>();
      attachedTemplateIds.forEach((tid) => {
        const tpl = templateMap.get(tid);
        if (tpl) {
          const tType = (tpl.targetDbType || 'ALL').toUpperCase();
          const dbEngineType = (db.dbType || '').toUpperCase();
          if (tType === 'ALL' || !tType || tType === dbEngineType) {
            compatibleTemplateIds.add(tid);
          }
        }
      });

      const inheritedMetricIds = this.metrics
        .filter((m) => {
          if (m.isEnabled === false) return false;
          const mTemplateIds = m.templateIds || (m.templateId ? [m.templateId] : []);
          return mTemplateIds.some((tid) => compatibleTemplateIds.has(tid));
        })
        .map((m) => m.id);

      const existingMetricSet = new Set(db.metricIds || []);
      let hasNewMetric = false;
      inheritedMetricIds.forEach((mid) => {
        if (!existingMetricSet.has(mid)) {
          existingMetricSet.add(mid);
          hasNewMetric = true;
        }
      });

      if (hasNewMetric) {
        return {
          ...db,
          metricIds: Array.from(existingMetricSet),
          updatedAt: new Date().toISOString(),
        };
      }
      return db;
    });
  }

  async getDatabases(): Promise<DatabaseEntity[]> {
    this.syncDatabaseMetrics();
    return this.databases;
  }

  async getDatabaseById(id: string): Promise<DatabaseEntity | null> {
    return this.databases.find((d) => d.id === id) || null;
  }

  async saveDatabase(dbData: Partial<DatabaseEntity>): Promise<DatabaseEntity> {
    let saved: DatabaseEntity;
    if (dbData.id) {
      const idx = this.databases.findIndex((d) => d.id === dbData.id);
      if (idx !== -1) {
        this.databases[idx] = {
          ...this.databases[idx],
          ...dbData,
          updatedAt: new Date().toISOString(),
        } as DatabaseEntity;
        saved = this.databases[idx];
      } else {
        saved = dbData as DatabaseEntity;
      }
    } else {
      const newDb: DatabaseEntity = {
        id: dbData.id || `db-${Date.now().toString().slice(-4)}`,
        name: dbData.name || 'New Database',
        dbType: dbData.dbType || 'POSTGRES',
        host: dbData.host || 'localhost',
        port: dbData.port || 5432,
        authMethod: dbData.authMethod || 'PASSWORD',
        username: dbData.username || '',
        password: dbData.password || '',
        authKey: dbData.authKey || '',
        databaseName: dbData.databaseName || '',
        environment: dbData.environment || 'PRODUCTION',
        connectionConfig: dbData.connectionConfig || {},
        groupIds: dbData.groupIds || [],
        metricIds: dbData.metricIds || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: dbData.status || 'UP',
        isEnabled: dbData.isEnabled !== false,
        lastCheckAt: new Date().toISOString(),
      };
      this.databases = [newDb, ...this.databases];
      saved = newDb;
    }
    this.syncDatabaseMetrics();
    return saved;
  }

  async deleteDatabase(id: string): Promise<boolean> {
    this.databases = this.databases.filter((d) => d.id !== id);
    return true;
  }

  // --- Metrics ---
  async getMetrics(): Promise<MetricEntity[]> {
    return this.metrics.map((m) => {
      const dbEngine = m.databaseEngineId ? (this.databaseEngines.find((e) => e.id === m.databaseEngineId) || null) : null;
      return {
        ...m,
        databaseEngine: dbEngine,
      };
    });
  }

  async getMetricById(id: string): Promise<MetricEntity | null> {
    const m = this.metrics.find((m) => m.id === id);
    if (!m) return null;
    const dbEngine = m.databaseEngineId ? (this.databaseEngines.find((e) => e.id === m.databaseEngineId) || null) : null;
    return {
      ...m,
      databaseEngine: dbEngine,
    };
  }

  async saveMetric(metricData: Partial<MetricEntity>): Promise<MetricEntity> {
    const templateIds = metricData.templateIds || (metricData.templateId ? [metricData.templateId] : []);
    const firstTemplateId = templateIds[0] || null;
    const firstTemplateName = firstTemplateId ? (this.templates.find((t) => t.id === firstTemplateId)?.name || null) : null;

    let savedResult: MetricEntity;
    if (metricData.id) {
      const idx = this.metrics.findIndex((m) => m.id === metricData.id);
      if (idx !== -1) {
        this.metrics[idx] = {
          ...this.metrics[idx],
          ...metricData,
          templateId: firstTemplateId,
          templateName: firstTemplateName,
          templateIds,
          databaseEngineId: metricData.databaseEngineId !== undefined ? metricData.databaseEngineId : this.metrics[idx].databaseEngineId,
          updatedAt: new Date().toISOString(),
        } as MetricEntity;
        savedResult = {
          ...this.metrics[idx],
          databaseEngine: this.metrics[idx].databaseEngineId ? (this.databaseEngines.find((e) => e.id === this.metrics[idx].databaseEngineId) || null) : null,
        };
      } else {
        savedResult = metricData as MetricEntity;
      }
    } else {
      const newMetric: MetricEntity = {
        id: metricData.id || `met-${Date.now().toString().slice(-4)}`,
        name: metricData.name || 'New Metric',
        sqlQuery: metricData.sqlQuery || 'SELECT 1 AS value',
        valueType: metricData.valueType || 'NUMBER',
        relationalOperator: metricData.relationalOperator || '>=',
        thresholdOperator: metricData.thresholdOperator || '>=',
        thresholdWarn: metricData.thresholdWarn || null,
        thresholdHigh: metricData.thresholdHigh || null,
        thresholdCritical: metricData.thresholdCritical || null,
        cycle: metricData.cycle ?? 1,
        templateId: firstTemplateId,
        templateName: firstTemplateName,
        templateIds,
        databaseEngineId: metricData.databaseEngineId || null,
        isEnabled: metricData.isEnabled !== false,
        metricQueryType: metricData.metricQueryType || 1,
        thresholdsConfig: metricData.thresholdsConfig || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.metrics = [newMetric, ...this.metrics];
      savedResult = {
        ...newMetric,
        databaseEngine: newMetric.databaseEngineId ? (this.databaseEngines.find((e) => e.id === newMetric.databaseEngineId) || null) : null,
      };
    }
    this.syncDatabaseMetrics();
    return savedResult;
  }

  async deleteMetric(id: string): Promise<boolean> {
    this.metrics = this.metrics.filter((m) => m.id !== id);
    return true;
  }

  // --- Templates ---
  async getTemplates(): Promise<TemplateEntity[]> {
    return this.templates.map((t) => {
      const dbEngine = t.databaseEngineId
        ? (this.databaseEngines.find((e) => e.id === t.databaseEngineId) || null)
        : (t.targetDbType ? (this.databaseEngines.find((e) => e.dbCode.toUpperCase() === t.targetDbType?.toUpperCase()) || null) : null);
      return {
        ...t,
        databaseEngine: dbEngine,
        targetDbType: dbEngine ? (dbEngine.dbCode as any) : t.targetDbType,
      };
    });
  }

  async getTemplateById(id: string): Promise<TemplateEntity | null> {
    const t = this.templates.find((tpl) => tpl.id === id);
    if (!t) return null;
    const dbEngine = t.databaseEngineId
      ? (this.databaseEngines.find((e) => e.id === t.databaseEngineId) || null)
      : (t.targetDbType ? (this.databaseEngines.find((e) => e.dbCode.toUpperCase() === t.targetDbType?.toUpperCase()) || null) : null);
    return {
      ...t,
      databaseEngine: dbEngine,
      targetDbType: dbEngine ? (dbEngine.dbCode as any) : t.targetDbType,
    };
  }

  async saveTemplate(tplData: Partial<TemplateEntity>): Promise<TemplateEntity> {
    const matchedEngine = tplData.databaseEngineId
      ? this.databaseEngines.find((e) => e.id === tplData.databaseEngineId)
      : (tplData.targetDbType ? this.databaseEngines.find((e) => e.dbCode.toUpperCase() === tplData.targetDbType?.toUpperCase()) : null);

    const targetDbType = matchedEngine ? (matchedEngine.dbCode as any) : (tplData.targetDbType || 'ALL');
    const databaseEngineId = matchedEngine ? matchedEngine.id : (tplData.databaseEngineId || null);

    let savedTemplate: TemplateEntity;
    if (tplData.id) {
      const idx = this.templates.findIndex((t) => t.id === tplData.id);
      if (idx !== -1) {
        this.templates[idx] = {
          ...this.templates[idx],
          ...tplData,
          targetDbType,
          databaseEngineId,
          updatedAt: new Date().toISOString(),
        } as TemplateEntity;
        savedTemplate = {
          ...this.templates[idx],
          databaseEngine: matchedEngine || null,
        };
      } else {
        savedTemplate = tplData as TemplateEntity;
      }
    } else {
      const newTemplate: TemplateEntity = {
        id: tplData.id || `tpl-${Date.now().toString().slice(-4)}`,
        name: tplData.name || 'New Template',
        description: tplData.description || null,
        targetDbType,
        databaseEngineId,
        metricIds: tplData.metricIds || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.templates = [newTemplate, ...this.templates];
      savedTemplate = {
        ...newTemplate,
        databaseEngine: matchedEngine || null,
      };
    }
    this.syncDatabaseMetrics();
    return savedTemplate;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    this.templates = this.templates.filter((t) => t.id !== id);
    return true;
  }

  // --- Groups ---
  async getGroups(): Promise<GroupEntity[]> {
    return this.groups;
  }

  async getGroupById(id: string): Promise<GroupEntity | null> {
    return this.groups.find((g) => g.id === id) || null;
  }

  async saveGroup(groupData: Partial<GroupEntity>, assignedDbIds?: string[]): Promise<GroupEntity> {
    let savedGroup: GroupEntity;
    let targetGroupId = groupData.id;

    if (groupData.id) {
      const idx = this.groups.findIndex((g) => g.id === groupData.id);
      if (idx !== -1) {
        this.groups[idx] = {
          ...this.groups[idx],
          ...groupData,
          databaseIds: assignedDbIds || groupData.databaseIds || this.groups[idx].databaseIds,
          updatedAt: new Date().toISOString(),
        } as GroupEntity;
        savedGroup = this.groups[idx];
      } else {
        savedGroup = groupData as GroupEntity;
      }
    } else {
      targetGroupId = `grp-${Date.now().toString().slice(-4)}`;
      savedGroup = {
        id: targetGroupId,
        name: groupData.name || 'New Group',
        description: groupData.description || null,
        databaseIds: assignedDbIds || groupData.databaseIds || [],
        templateIds: groupData.templateIds || [],
        alertMethodIds: groupData.alertMethodIds || ['meth-email-01'],
        senderIds: groupData.senderIds || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.groups = [savedGroup, ...this.groups];
    }

    if (assignedDbIds && targetGroupId) {
      this.databases = this.databases.map((db) => {
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

    this.syncDatabaseMetrics();
    return savedGroup;
  }

  async deleteGroup(id: string): Promise<boolean> {
    this.groups = this.groups.filter((g) => g.id !== id);
    this.databases = this.databases.map((db) => ({
      ...db,
      groupIds: (db.groupIds || []).filter((gid) => gid !== id),
    }));
    return true;
  }

  // --- Active Alerts ---
  async getActiveAlerts(): Promise<ActiveAlertEntity[]> {
    return this.activeAlerts;
  }

  async saveActiveAlert(alertData: Partial<ActiveAlertEntity>): Promise<ActiveAlertEntity> {
    if (alertData.id) {
      const idx = this.activeAlerts.findIndex((a) => a.id === alertData.id);
      if (idx !== -1) {
        this.activeAlerts[idx] = { ...this.activeAlerts[idx], ...alertData } as ActiveAlertEntity;
        return this.activeAlerts[idx];
      }
    }
    const newAlert: ActiveAlertEntity = {
      id: alertData.id || String(this.nextActiveAlertId++),
      dbId: alertData.dbId || '',
      dbName: alertData.dbName || '',
      metricId: alertData.metricId || '',
      metricName: alertData.metricName || '',
      objectName: alertData.objectName || 'INSTANCE',
      alertLevel: alertData.alertLevel || 'WARN',
      message: alertData.message || 'System threshold alert',
      status: alertData.status || 'OPEN',
      createdAt: alertData.createdAt || new Date().toISOString(),
    };
    this.activeAlerts = [newAlert, ...this.activeAlerts];
    return newAlert;
  }

  async acknowledgeActiveAlert(alertId: string, acknowledgedById?: string | null, acknowledgedByName?: string): Promise<boolean> {
    const target = this.activeAlerts.find((a) => a.id === alertId);
    if (!target) return false;
    target.status = 'ACKNOWLEDGED';
    target.acknowledgedAt = new Date().toISOString();
    target.acknowledgedById = acknowledgedById || null;
    target.acknowledgedByName = acknowledgedByName || 'User';
    return true;
  }

  async clearActiveAlert(alertId: string, clearedById?: string | null, clearedByName?: string): Promise<boolean> {
    const target = this.activeAlerts.find((a) => a.id === alertId);
    if (!target) return false;

    this.activeAlerts = this.activeAlerts.filter((a) => a.id !== alertId);

    const historyEntry: AlertHistoryEntity = {
      id: String(this.nextAlertHistoryId++),
      dbId: target.dbId,
      dbName: target.dbName,
      metricId: target.metricId,
      metricName: target.metricName,
      objectName: target.objectName,
      attributeName: target.attributeName,
      resolutionStatus: 'CLEARED_BY_USER',
      alertLevel: target.alertLevel,
      message: target.message,
      createdAt: target.createdAt,
      clearedAt: new Date().toISOString(),
      clearedById: clearedById || null,
      clearedByName: clearedByName || 'admin',
    };
    this.alertHistory = [historyEntry, ...this.alertHistory];
    return true;
  }

  // --- Alert History ---
  async getAlertHistory(): Promise<AlertHistoryEntity[]> {
    return this.alertHistory;
  }

  async addAlertHistory(historyData: Partial<AlertHistoryEntity>): Promise<AlertHistoryEntity> {
    const entry: AlertHistoryEntity = {
      id: historyData.id || String(this.nextAlertHistoryId++),
      dbId: historyData.dbId || '',
      dbName: historyData.dbName || '',
      metricId: historyData.metricId || '',
      metricName: historyData.metricName || '',
      objectName: historyData.objectName || 'INSTANCE',
      alertLevel: historyData.alertLevel || 'WARN',
      message: historyData.message || '',
      createdAt: historyData.createdAt || new Date().toISOString(),
      clearedAt: historyData.clearedAt || new Date().toISOString(),
      clearedById: historyData.clearedById || null,
      clearedByName: historyData.clearedByName || 'admin',
    };
    this.alertHistory = [entry, ...this.alertHistory];
    return entry;
  }

  // --- Metric History ---
  async getMetricHistory(dbId?: string, metricId?: string, fromDate?: string, toDate?: string): Promise<MetricHistoryEntity[]> {
    let result = [...this.metricHistory];
    if (dbId && dbId !== 'ALL') result = result.filter((m) => m.dbId === dbId);
    if (metricId && metricId !== 'ALL') result = result.filter((m) => m.metricId === metricId);
    if (fromDate) {
      const fromTime = new Date(fromDate).getTime();
      result = result.filter((m) => new Date(m.createdAt).getTime() >= fromTime);
    }
    if (toDate) {
      const toDateObj = toDate.length === 10
        ? new Date(`${toDate}T23:59:59.999Z`).getTime()
        : new Date(toDate).getTime();
      result = result.filter((m) => new Date(m.createdAt).getTime() <= toDateObj);
    }
    return result.map((m) => ({
      ...m,
      attributeName: m.attributeName || 'value',
    }));
  }

  async addMetricHistory(historyData: Partial<MetricHistoryEntity>): Promise<MetricHistoryEntity> {
    const entry: MetricHistoryEntity = {
      id: historyData.id || `mh-${Date.now()}`,
      dbId: historyData.dbId || '',
      dbName: historyData.dbName || '',
      metricId: historyData.metricId || '',
      metricName: historyData.metricName || '',
      objectName: historyData.objectName || 'INSTANCE',
      attributeName: historyData.attributeName || 'value',
      value: historyData.value || '0',
      createdAt: historyData.createdAt || new Date().toISOString(),
    };
    this.metricHistory = [entry, ...this.metricHistory];
    return entry;
  }

  // --- Raw Measurements / Telemetry ---
  async getRawMeasurements(filterOrLimit?: number | RawMeasurementFilter): Promise<RawMeasurementEntity[]> {
    let limit = 0;
    let filter: RawMeasurementFilter = {};

    if (typeof filterOrLimit === 'number') {
      limit = filterOrLimit;
    } else if (filterOrLimit) {
      filter = filterOrLimit;
      if (filter.limit !== undefined) {
        limit = filter.limit;
      }
    }

    let list = [...this.rawMeasurements];

    if (filter.dbId && filter.dbId !== 'ALL') {
      list = list.filter((m) => m.dbId === filter.dbId);
    }
    if (filter.metricId && filter.metricId !== 'ALL') {
      list = list.filter((m) => m.metricId === filter.metricId);
    }
    if (filter.dbType && filter.dbType !== 'ALL') {
      list = list.filter((m) => (m.dbType || '').toUpperCase() === filter.dbType!.toUpperCase());
    }
    if (filter.objectName && filter.objectName !== 'ALL') {
      const targetObj = filter.objectName.toLowerCase().trim();
      list = list.filter((m) => (m.objectName || '').toLowerCase().trim() === targetObj);
    }
    if (filter.attributeName && filter.attributeName !== 'ALL') {
      const targetAttr = filter.attributeName.toLowerCase().trim();
      list = list.filter((m) => (m.attributeName || '').toLowerCase().trim() === targetAttr);
    }
    if (filter.fromDate) {
      const fromTime = new Date(filter.fromDate).getTime();
      list = list.filter((m) => new Date(m.measuredAt).getTime() >= fromTime);
    }
    if (filter.toDate) {
      const toDateObj = filter.toDate.length === 10
        ? new Date(`${filter.toDate}T23:59:59.999Z`).getTime()
        : new Date(filter.toDate).getTime();
      list = list.filter((m) => new Date(m.measuredAt).getTime() <= toDateObj);
    }
    if (filter.searchTerm && filter.searchTerm.trim()) {
      const q = filter.searchTerm.toLowerCase().trim();
      list = list.filter((m) =>
        (m.dbName && m.dbName.toLowerCase().includes(q)) ||
        (m.metricName && m.metricName.toLowerCase().includes(q)) ||
        (m.objectName && m.objectName.toLowerCase().includes(q)) ||
        (m.attributeName && m.attributeName.toLowerCase().includes(q)) ||
        (m.value && m.value.toLowerCase().includes(q)) ||
        (m.dbType && m.dbType.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());

    return limit > 0 ? list.slice(0, limit) : list;
  }

  async addRawMeasurement(data: Partial<RawMeasurementEntity>): Promise<RawMeasurementEntity> {
    const entry: RawMeasurementEntity = {
      id: data.id || `raw-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      dbId: data.dbId || 'db-01',
      dbName: data.dbName || 'Target DB',
      dbType: data.dbType || 'POSTGRES',
      metricId: data.metricId || 'met-01',
      metricName: data.metricName || 'Metric Probe',
      objectName: data.objectName || 'INSTANCE',
      attributeName: data.attributeName || 'value',
      value: data.value || '0',
      valueType: data.valueType || 'NUMBER',
      thresholdOperator: data.thresholdOperator || '>=',
      triggeredThreshold: data.triggeredThreshold || null,
      cycle: data.cycle || 1,
      status: data.status || 'NORMAL',
      measuredAt: data.measuredAt || new Date().toISOString(),
    };
    this.rawMeasurements = [entry, ...this.rawMeasurements];
    return entry;
  }

  async getAlertNotificationLogs(): Promise<AlertNotificationLogEntity[]> {
    return this.alertNotificationLogs;
  }

  async getAlertNotificationQueue(): Promise<AlertNotificationQueueEntity[]> {
    return this.alertNotificationQueue;
  }

  async getDatabasePollQueue(): Promise<DatabasePollQueueEntity[]> {
    return this.databasePollQueue;
  }

  async getDatabasePollLogs(): Promise<DatabasePollLogEntity[]> {
    return this.databasePollLogs;
  }

  // --- System Settings ---
  async getSystemSettings(): Promise<SystemSettingsEntity> {
    return this.systemSettings;
  }

  async saveSystemSettings(settings: Partial<SystemSettingsEntity>): Promise<SystemSettingsEntity> {
    this.systemSettings = {
      ...this.systemSettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    if (settings.sessionTimeoutMinutes !== undefined) {
      this.systemSettings.SESSION_TIMEOUT_MINUTES = String(settings.sessionTimeoutMinutes);
    }
    if (settings.SESSION_TIMEOUT_MINUTES !== undefined) {
      this.systemSettings.sessionTimeoutMinutes = parseInt(String(settings.SESSION_TIMEOUT_MINUTES), 10) || 30;
    }
    return this.systemSettings;
  }

  async getSystemSettingsList(): Promise<SystemSettingItem[]> {
    const s = this.systemSettings;
    return [
      { id: 'ss-01', name: 'apiCollectorEnabled', value: String(s.apiCollectorEnabled), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-02', name: 'collectorEndpoint', value: s.collectorEndpoint, updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-03', name: 'collectorApiKey', value: s.collectorApiKey, updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-04', name: 'collectorPollIntervalSeconds', value: String(s.collectorPollIntervalSeconds), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-05', name: 'collectorBatchSize', value: String(s.collectorBatchSize), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-06', name: 'collectorTimeoutMs', value: String(s.collectorTimeoutMs), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-07', name: 'collectorRetryPolicy', value: s.collectorRetryPolicy, updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-08', name: 'globalAlertThresholdMode', value: s.globalAlertThresholdMode, updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-09', name: 'maxRetryAttempts', value: String(s.maxRetryAttempts), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-10', name: 'notificationDispatchIntervalSeconds', value: String(s.notificationDispatchIntervalSeconds), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-11', name: 'defaultTimezone', value: s.defaultTimezone, updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-12', name: 'dataRetentionDays', value: String(s.dataRetentionDays), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-13', name: 'autoClearResolvedAlerts', value: String(s.autoClearResolvedAlerts), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-14', name: 'showInfoTips', value: String(s.showInfoTips ?? true), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
      { id: 'ss-15', name: 'SESSION_TIMEOUT_MINUTES', value: String(s.SESSION_TIMEOUT_MINUTES || s.sessionTimeoutMinutes || '30'), updatedAt: s.updatedAt, updatedBy: s.updatedBy },
    ];
  }

  async saveSystemSettingItem(item: Partial<SystemSettingItem>): Promise<SystemSettingItem> {
    const name = item.name || 'customSetting';
    const value = item.value ?? '';
    const updatedBy = item.updatedBy || 'admin';
    const updatedAt = new Date().toISOString();

    if (name === 'SESSION_TIMEOUT_MINUTES') {
      const minutes = parseInt(value, 10) || 30;
      this.systemSettings.sessionTimeoutMinutes = minutes;
      this.systemSettings.SESSION_TIMEOUT_MINUTES = String(minutes);
    } else if (name === 'collectorEndpoint') {
      this.systemSettings.collectorEndpoint = value;
    } else if (name === 'showInfoTips') {
      this.systemSettings.showInfoTips = value !== 'false';
    }

    this.systemSettings.updatedAt = updatedAt;
    this.systemSettings.updatedBy = updatedBy;

    return {
      id: item.id || `ss-${Date.now()}`,
      name,
      value,
      updatedAt,
      updatedBy,
    };
  }

  async deleteSystemSettingItem(id: string): Promise<boolean> {
    return true;
  }

  // --- Audit Logs ---
  async getAuditLogs(limit = 100): Promise<AuditLogEntity[]> {
    return this.auditLogs.slice(0, limit);
  }

  async addAuditLog(logData: Partial<AuditLogEntity>): Promise<AuditLogEntity> {
    const entry: AuditLogEntity = {
      id: logData.id || `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: logData.userId || 'admin',
      clientIp: logData.clientIp || '127.0.0.1',
      actionType: logData.actionType || 'UPDATE',
      targetEntity: logData.targetEntity || 'SYSTEM',
      targetId: logData.targetId || null,
      details: logData.details || null,
      createdAt: logData.createdAt || new Date().toISOString(),
    };
    this.auditLogs = [entry, ...this.auditLogs];
    return entry;
  }

  async cleanAllMonitorData(daysToKeep = 0, dbId = 'ALL') {
    const cutoffTime = daysToKeep <= 0 ? Date.now() + 60000 : Date.now() - daysToKeep * 86400000;
    const matchesDb = (targetDbId: string) => dbId === 'ALL' || targetDbId === dbId;

    const initActive = this.activeAlerts.length;
    this.activeAlerts = this.activeAlerts.filter((a) => {
      if (!matchesDb(a.dbId)) return true;
      return new Date(a.createdAt).getTime() > cutoffTime;
    });

    const initHistory = this.alertHistory.length;
    this.alertHistory = this.alertHistory.filter((a) => {
      if (!matchesDb(a.dbId)) return true;
      return new Date(a.createdAt).getTime() > cutoffTime;
    });

    const initMetrics = this.metricHistory.length;
    this.metricHistory = this.metricHistory.filter((m) => {
      if (!matchesDb(m.dbId)) return true;
      const t = new Date(m.createdAt || 0).getTime();
      return t > cutoffTime;
    });

    const initRaws = this.rawMeasurements.length;
    this.rawMeasurements = this.rawMeasurements.filter((m) => {
      if (!matchesDb(m.dbId)) return true;
      const t = new Date((m as any).measuredAt || 0).getTime();
      return t > cutoffTime;
    });

    const initLogs = this.alertNotificationLogs.length;
    this.alertNotificationLogs = this.alertNotificationLogs.filter((l) => {
      if (!matchesDb(l.dbId)) return true;
      return new Date(l.timestamp).getTime() > cutoffTime;
    });

    return {
      activeAlertsDeleted: initActive - this.activeAlerts.length,
      alertHistoryDeleted: initHistory - this.alertHistory.length,
      metricDataPointsDeleted: (initMetrics - this.metricHistory.length) + (initRaws - this.rawMeasurements.length),
      notificationLogsDeleted: initLogs - this.alertNotificationLogs.length,
    };
  }

  async cleanRawQueryHistory(daysToKeep = 0, dbId = 'ALL') {
    const cutoffTime = daysToKeep <= 0 ? Date.now() + 60000 : Date.now() - daysToKeep * 86400000;
    const matchesDb = (targetDbId: string) => dbId === 'ALL' || targetDbId === dbId;

    const initMetrics = this.metricHistory.length;
    this.metricHistory = this.metricHistory.filter((m) => {
      if (!matchesDb(m.dbId)) return true;
      const t = new Date(m.createdAt || 0).getTime();
      return t > cutoffTime;
    });

    const initRaws = this.rawMeasurements.length;
    this.rawMeasurements = this.rawMeasurements.filter((m) => {
      if (!matchesDb(m.dbId)) return true;
      const t = new Date((m as any).measuredAt || 0).getTime();
      return t > cutoffTime;
    });

    return {
      metricDataPointsDeleted: (initMetrics - this.metricHistory.length) + (initRaws - this.rawMeasurements.length),
    };
  }

  async resetData(): Promise<void> {
    this.databases = [];
    this.groups = [];
    this.activeAlerts = [];
    this.alertHistory = [];
    this.alertNotificationLogs = [];
    this.metrics = [];
    this.templates = [];
    this.metricHistory = [];
    this.rawMeasurements = [];
    this.databasePollQueue = [];
    this.databasePollLogs = [];
    this.alertNotificationQueue = [];
  }
}
