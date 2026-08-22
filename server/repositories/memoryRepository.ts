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
  SystemSettingsEntity,
  AuditLogEntity,
  AlertNotificationLogEntity,
} from '../../src/types';
import { IStorageRepository } from './types';

export class MemoryRepository implements IStorageRepository {
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

  private users: User[] = [
    {
      id: 'usr-admin-01',
      username: 'admin',
      role: 'ADMIN',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'usr-viewer-02',
      username: 'viewer',
      role: 'VIEWER',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
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
    centralDbSyncEnabled: true,
    centralDbConnectionString: 'mysql://dbmon_central:******@10.0.10.50:3306/db_monitoring_system',

    showInfoTips: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin',
  };

  private templates: TemplateEntity[] = [
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
    {
      id: 'tpl-multi-01',
      name: 'Database Storage & Capacity Overview (Type 3)',
      targetDbType: 'POSTGRES',
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
      frequencyMinutes: 5,
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
      frequencyMinutes: 1,
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
      frequencyMinutes: 2,
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
      frequencyMinutes: 1,
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
      frequencyMinutes: 1,
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
      frequencyMinutes: 10,
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
      frequencyMinutes: 5,
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
      frequencyMinutes: 5,
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
      authMethod: 'PASSWORD',
      username: 'dbmon_user',
      password: 'enc_password_sec_01',
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
      authMethod: 'PASSWORD',
      username: 'pg_monitor',
      password: 'enc_password_sec_02',
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
      authMethod: 'PASSWORD',
      username: 'mysql_collector',
      password: 'enc_password_sec_03',
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
      authMethod: 'PASSWORD',
      username: 'sql_mon',
      password: 'enc_password_sec_04',
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

  private activeAlerts: ActiveAlertEntity[] = [
    {
      id: 'alt-01',
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
      id: 'alt-02',
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
      id: 'alt-03',
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
      id: 'h-01',
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      metricId: 'met-03',
      metricName: 'Connection Saturation %',
      objectName: 'payment_ledger',
      alertLevel: 'HIGH',
      message: 'Connection Saturation % (87.50%) breached High threshold (85.00%).',
      createdAt: new Date(Date.now() - 180 * 60000).toISOString(),
      clearedAt: new Date(Date.now() - 120 * 60000).toISOString(),
      clearedById: 'usr-admin-01',
      clearedByName: 'admin',
    },
    {
      id: 'h-02',
      dbId: 'db-01',
      dbName: 'ERP_PROD_ORA',
      metricId: 'met-02',
      metricName: 'Active Sessions Count',
      objectName: 'SYSDBA',
      alertLevel: 'CRITICAL',
      message: 'Active Sessions Count (512) breached Critical threshold (500).',
      createdAt: new Date(Date.now() - 360 * 60000).toISOString(),
      clearedAt: new Date(Date.now() - 240 * 60000).toISOString(),
      clearedById: 'usr-admin-01',
      clearedByName: 'admin',
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
      dbName: 'DW_REPORTS_MS',
      metricName: 'Page Life Expectancy (PLE)',
      attributeName: 'ple_seconds',
      alertLevel: 'WARN',
      dispatchMethod: 'Corporate SMTP Relay',
      dispatchType: 'EMAIL',
      senderIds: 'dba-team@company.internal',
      status: 'DISPATCHED',
      payloadSummary: 'WARN: DW_REPORTS_MS Buffer Manager PLE dropped to 240s',
      latencyMs: 290,
    },
    {
      id: 'notif-log-06',
      timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
      alertId: 'h-01',
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      metricName: 'Replication Lag (Seconds)',
      attributeName: 'active_connections',
      alertLevel: 'HIGH',
      dispatchMethod: 'SMS Gateway (Twilio)',
      dispatchType: 'SMS',
      senderIds: '+84901234567, +84907654321',
      status: 'FAILED',
      errorMessage: 'HTTP 429: SMS Rate limit exceeded on backup gateway provider',
      payloadSummary: 'HIGH: PAYMENT_API_PG connection saturation > 85%',
      latencyMs: 850,
    }
  ];

  private rawMeasurements: RawMeasurementEntity[] = [
    {
      id: 'raw-01',
      dbId: 'db-01',
      dbName: 'ERP_PROD_ORA',
      dbType: 'ORACLE',
      metricId: 'met-01',
      metricName: 'Tablespace Usage %',
      objectName: 'TS_DATA_PRD',
      attributeName: 'used_space_pct',
      value: '91.4%',
      valueType: 'NUMBER',
      thresholdOperator: '>=',
      triggeredThreshold: 'Warn: 80 / High: 90 / Crit: 95 (>=)',
      frequencyMinutes: 5,
      status: 'HIGH' as any,
      measuredAt: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
      id: 'raw-02',
      dbId: 'db-01',
      dbName: 'ERP_PROD_ORA',
      dbType: 'ORACLE',
      metricId: 'met-02',
      metricName: 'Active Sessions Count',
      objectName: 'SYSDBA',
      attributeName: 'active_sessions',
      value: '184',
      valueType: 'NUMBER',
      thresholdOperator: '>=',
      triggeredThreshold: 'Warn: 150 / High: 300 / Crit: 500 (>=)',
      frequencyMinutes: 1,
      status: 'WARNING',
      measuredAt: new Date(Date.now() - 3 * 60000).toISOString(),
    },
    {
      id: 'raw-03',
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      dbType: 'POSTGRES',
      metricId: 'met-03',
      metricName: 'Connection Saturation %',
      objectName: 'payment_gateway',
      attributeName: 'active_connections_pct',
      value: '62.4%',
      valueType: 'NUMBER',
      thresholdOperator: '>=',
      triggeredThreshold: null,
      frequencyMinutes: 2,
      status: 'NORMAL',
      measuredAt: new Date(Date.now() - 4 * 60000).toISOString(),
    },
    {
      id: 'raw-04',
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      dbType: 'POSTGRES',
      metricId: 'met-04',
      metricName: 'Replication Lag (Seconds)',
      objectName: 'replica_standby_01',
      attributeName: 'lag_seconds',
      value: '0s',
      valueType: 'NUMBER',
      thresholdOperator: '>=',
      triggeredThreshold: null,
      frequencyMinutes: 1,
      status: 'NORMAL',
      measuredAt: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      id: 'raw-05',
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      dbType: 'POSTGRES',
      metricId: 'met-08',
      metricName: 'Tablespace & File Storage Analytics',
      objectName: 'pg_default',
      attributeName: 'usage_pct',
      value: '74.2%',
      valueType: 'NUMBER',
      thresholdOperator: '>=',
      triggeredThreshold: null,
      frequencyMinutes: 5,
      status: 'NORMAL',
      measuredAt: new Date(Date.now() - 6 * 60000).toISOString(),
    },
    {
      id: 'raw-06',
      dbId: 'db-02',
      dbName: 'PAYMENT_API_PG',
      dbType: 'POSTGRES',
      metricId: 'met-08',
      metricName: 'Tablespace & File Storage Analytics',
      objectName: 'pg_default',
      attributeName: 'node_role',
      value: 'PRIMARY',
      valueType: 'STRING',
      thresholdOperator: '!=',
      triggeredThreshold: null,
      frequencyMinutes: 5,
      status: 'NORMAL',
      measuredAt: new Date(Date.now() - 6 * 60000).toISOString(),
    },
    {
      id: 'raw-07',
      dbId: 'db-03',
      dbName: 'CRM_PORTAL_MY',
      dbType: 'MYSQL',
      metricId: 'met-05',
      metricName: 'Threads Connected',
      objectName: 'crm_production',
      attributeName: 'threads_connected',
      value: '212',
      valueType: 'NUMBER',
      thresholdOperator: '>=',
      triggeredThreshold: 'Warn: 200 / High: 400 / Crit: 800 (>=)',
      frequencyMinutes: 1,
      status: 'WARNING',
      measuredAt: new Date(Date.now() - 8 * 60000).toISOString(),
    },
    {
      id: 'raw-08',
      dbId: 'db-04',
      dbName: 'DW_REPORTS_MS',
      dbType: 'MSSQL',
      metricId: 'met-07',
      metricName: 'Page Life Expectancy (PLE)',
      objectName: 'Buffer Manager',
      attributeName: 'cntr_value',
      value: '640s',
      valueType: 'NUMBER',
      thresholdOperator: '<=',
      triggeredThreshold: null,
      frequencyMinutes: 5,
      status: 'NORMAL',
      measuredAt: new Date(Date.now() - 10 * 60000).toISOString(),
    },
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
      frequencyMinutes: 1,
      status: 'DOWN',
      measuredAt: new Date(Date.now() - 12 * 60000).toISOString(),
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
  async getDatabases(): Promise<DatabaseEntity[]> {
    return this.databases;
  }

  async getDatabaseById(id: string): Promise<DatabaseEntity | null> {
    return this.databases.find((d) => d.id === id) || null;
  }

  async saveDatabase(dbData: Partial<DatabaseEntity>): Promise<DatabaseEntity> {
    if (dbData.id) {
      const idx = this.databases.findIndex((d) => d.id === dbData.id);
      if (idx !== -1) {
        this.databases[idx] = {
          ...this.databases[idx],
          ...dbData,
          updatedAt: new Date().toISOString(),
        } as DatabaseEntity;
        return this.databases[idx];
      }
    }
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
    return newDb;
  }

  async deleteDatabase(id: string): Promise<boolean> {
    this.databases = this.databases.filter((d) => d.id !== id);
    return true;
  }

  // --- Metrics ---
  async getMetrics(): Promise<MetricEntity[]> {
    return this.metrics;
  }

  async getMetricById(id: string): Promise<MetricEntity | null> {
    return this.metrics.find((m) => m.id === id) || null;
  }

  async saveMetric(metricData: Partial<MetricEntity>): Promise<MetricEntity> {
    if (metricData.id) {
      const idx = this.metrics.findIndex((m) => m.id === metricData.id);
      if (idx !== -1) {
        this.metrics[idx] = {
          ...this.metrics[idx],
          ...metricData,
          updatedAt: new Date().toISOString(),
        } as MetricEntity;
        return this.metrics[idx];
      }
    }
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
      frequencyMinutes: metricData.frequencyMinutes || 5,
      templateId: metricData.templateId || null,
      templateName: metricData.templateName || null,
      isEnabled: metricData.isEnabled !== false,
      metricQueryType: metricData.metricQueryType || 1,
      thresholdsConfig: metricData.thresholdsConfig || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.metrics = [newMetric, ...this.metrics];
    return newMetric;
  }

  async deleteMetric(id: string): Promise<boolean> {
    this.metrics = this.metrics.filter((m) => m.id !== id);
    return true;
  }

  // --- Templates ---
  async getTemplates(): Promise<TemplateEntity[]> {
    return this.templates;
  }

  async getTemplateById(id: string): Promise<TemplateEntity | null> {
    return this.templates.find((t) => t.id === id) || null;
  }

  async saveTemplate(tplData: Partial<TemplateEntity>): Promise<TemplateEntity> {
    if (tplData.id) {
      const idx = this.templates.findIndex((t) => t.id === tplData.id);
      if (idx !== -1) {
        this.templates[idx] = {
          ...this.templates[idx],
          ...tplData,
          updatedAt: new Date().toISOString(),
        } as TemplateEntity;
        return this.templates[idx];
      }
    }
    const newTemplate: TemplateEntity = {
      id: tplData.id || `tpl-${Date.now().toString().slice(-4)}`,
      name: tplData.name || 'New Template',
      description: tplData.description || null,
      targetDbType: tplData.targetDbType || 'ALL',
      metricIds: tplData.metricIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.templates = [newTemplate, ...this.templates];
    return newTemplate;
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
      id: alertData.id || `alt-${Date.now().toString().slice(-4)}`,
      dbId: alertData.dbId || '',
      dbName: alertData.dbName || '',
      metricId: alertData.metricId || '',
      metricName: alertData.metricName || '',
      objectName: alertData.objectName || 'INSTANCE',
      alertLevel: alertData.alertLevel || 'WARN',
      message: alertData.message || 'System threshold alert',
      createdAt: alertData.createdAt || new Date().toISOString(),
    };
    this.activeAlerts = [newAlert, ...this.activeAlerts];
    return newAlert;
  }

  async clearActiveAlert(alertId: string, clearedById?: string | null, clearedByName?: string): Promise<boolean> {
    const target = this.activeAlerts.find((a) => a.id === alertId);
    if (!target) return false;

    this.activeAlerts = this.activeAlerts.filter((a) => a.id !== alertId);

    const historyEntry: AlertHistoryEntity = {
      id: `hist-${Date.now()}`,
      dbId: target.dbId,
      dbName: target.dbName,
      metricId: target.metricId,
      metricName: target.metricName,
      objectName: target.objectName || 'INSTANCE',
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
      id: historyData.id || `hist-${Date.now()}`,
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
  async getMetricHistory(dbId?: string, metricId?: string): Promise<MetricHistoryEntity[]> {
    let result = this.metricHistory;
    if (dbId) result = result.filter((m) => m.dbId === dbId);
    if (metricId) result = result.filter((m) => m.metricId === metricId);
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
  async getRawMeasurements(limit = 100): Promise<RawMeasurementEntity[]> {
    return this.rawMeasurements.slice(0, limit);
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
      frequencyMinutes: data.frequencyMinutes || 5,
      status: data.status || 'NORMAL',
      measuredAt: data.measuredAt || new Date().toISOString(),
    };
    this.rawMeasurements = [entry, ...this.rawMeasurements];
    return entry;
  }

  async getAlertNotificationLogs(): Promise<AlertNotificationLogEntity[]> {
    return this.alertNotificationLogs;
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
    return this.systemSettings;
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
}
