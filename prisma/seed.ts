import { PrismaClient, Role, DbType, ValueType, AlertLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const p = prisma as any;

async function main() {
  console.log('🌱 Starting optimized database seeding with Prisma v6 (Random UUID Format)...');
  const startTime = Date.now();

  // 1. Clean Upside-Down Truncations / Deletions (handling dependent tables first)
  console.log('🧹 Cleaning existing data in reverse dependency order...');
  await p.$transaction([
    p.alertNotificationQueue.deleteMany(),
    p.databasePollQueue.deleteMany(),
    p.databasePollLog.deleteMany(),
    p.alertNotificationLog.deleteMany(),
    p.metricDataPoint.deleteMany(),
    p.alertHistory.deleteMany(),
    p.activeAlert.deleteMany(),
    p.databaseMetricMapping.deleteMany(),
    p.metricTemplateMapping.deleteMany(),
    p.groupTemplateMapping.deleteMany(),
    p.databaseGroupMapping.deleteMany(),
    p.database.deleteMany(),
    p.databaseGroup.deleteMany(),
    p.metric.deleteMany(),
    p.template.deleteMany(),
    p.systemSettings.deleteMany(),
    p.user.deleteMany(),
    p.databaseEngine.deleteMany(),
    p.alertNotificationMethod.deleteMany(),
  ]);
  console.log('✨ Data cleanup completed successfully.');

  // 1.5 Seeding Database Engines (Dynamic Registry matching storage.ts/memoryRepository.ts)
  const databaseEnginesData = [
    {
      id: 'eng-01',
      dbCode: 'ORACLE',
      dbName: 'Oracle',
      dbColor: '#EA580C',
      defaultPort: 1521,
      statusOnOff: 'ACTIVE',
      description: 'Enterprise relational database management system developed by Oracle.',
    },
    {
      id: 'eng-02',
      dbCode: 'MYSQL',
      dbName: 'MySQL',
      dbColor: '#16A34A',
      defaultPort: 3306,
      statusOnOff: 'ACTIVE',
      description: 'Open-source relational database management system powered by Oracle.',
    },
    {
      id: 'eng-03',
      dbCode: 'POSTGRES',
      dbName: 'PostgreSQL',
      dbColor: '#2563EB',
      defaultPort: 5432,
      statusOnOff: 'ACTIVE',
      description: 'Powerful, open-source object-relational database system with high SQL compliance.',
    },
    {
      id: 'eng-04',
      dbCode: 'MSSQL',
      dbName: 'Microsoft SQL Server',
      dbColor: '#0F172A',
      defaultPort: 1433,
      statusOnOff: 'ACTIVE',
      description: 'Enterprise relational database management system developed by Microsoft.',
    },
    {
      id: 'eng-05',
      dbCode: 'SINGLESTORE',
      dbName: 'SingleStore',
      dbColor: '#9333EA',
      defaultPort: 3306,
      statusOnOff: 'ACTIVE',
      description: 'Cloud-native, real-time distributed SQL database for transactions and analytics.',
    },
    {
      id: 'eng-06',
      dbCode: 'MONGODB',
      dbName: 'MongoDB',
      dbColor: '#059669',
      defaultPort: 27017,
      statusOnOff: 'ACTIVE',
      description: 'Document-oriented NoSQL database for flexible data modeling and clustering.',
    },
    {
      id: 'eng-07',
      dbCode: 'REDIS',
      dbName: 'Redis',
      dbColor: '#D97706',
      defaultPort: 6379,
      statusOnOff: 'ACTIVE',
      description: 'In-memory data structure store used as a database, cache, and message broker.',
    },
  ];

  // 1.6 Seeding Alert Notification Methods (Dynamic Protocol Dispatchers matching memoryRepository.ts)
  const alertNotificationMethodsData = [
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
    },
  ];

  // 2. Prepare Hashed Credentials for Default Users
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'replace_with_a_secure_admin_password_123!';
  const viewerUsername = process.env.SEED_VIEWER_USERNAME || 'viewer';
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD || 'replace_with_a_secure_viewer_password_123!';

  const saltRounds = 10;
  const adminHash = await bcrypt.hash(adminPassword, saltRounds);
  const viewerHash = await bcrypt.hash(viewerPassword, saltRounds);

  // Random UUID formatted IDs
  const adminUserId = 'f19a0a03-9e8a-4db5-bc65-276c11d67064';
  const viewerUserId = 'd7f1c1f1-3be2-4422-9ff7-5bb8e469b6f1';

  const usersData = [
    { id: adminUserId, username: adminUsername, passwordHash: adminHash, role: Role.ADMIN },
    { id: viewerUserId, username: viewerUsername, passwordHash: viewerHash, role: Role.VIEWER },
  ];

  // 3. Prepare System Settings Key-Value Records
  const systemSettingsData = [
    { id: 'ss-01', name: 'apiCollectorEnabled', value: 'true', updatedBy: 'admin' },
    { id: 'ss-02', name: 'collectorEndpoint', value: process.env.COLLECTOR_HEALTH_CHECK_URL || 'http://localhost:3000/api/collector/mock-health', updatedBy: 'admin' },
    { id: 'ss-03', name: 'collectorApiKey', value: 'dbf_live_col_9f88a2e1b4c3d4e5f6a7b8c9d0e1f2a3', updatedBy: 'admin' },
    { id: 'ss-04', name: 'collectorPollIntervalSeconds', value: '60', updatedBy: 'admin' },
    { id: 'ss-05', name: 'collectorBatchSize', value: '250', updatedBy: 'admin' },
    { id: 'ss-06', name: 'collectorTimeoutMs', value: '5000', updatedBy: 'admin' },
    { id: 'ss-07', name: 'collectorRetryPolicy', value: 'Exponential Backoff (Max 5 retries)', updatedBy: 'admin' },
    { id: 'ss-08', name: 'globalAlertThresholdMode', value: 'STANDARD', updatedBy: 'admin' },
    { id: 'ss-09', name: 'maxRetryAttempts', value: '3', updatedBy: 'admin' },
    { id: 'ss-10', name: 'notificationDispatchIntervalSeconds', value: '30', updatedBy: 'admin' },
    { id: 'ss-11', name: 'defaultTimezone', value: process.env.DEFAULT_TIMEZONE || 'Asia/Ho_Chi_Minh (UTC+7)', updatedBy: 'admin' },
    { id: 'ss-12', name: 'dataRetentionDays', value: '90', updatedBy: 'admin' },
    { id: 'ss-13', name: 'autoClearResolvedAlerts', value: 'true', updatedBy: 'admin' },
    { id: 'ss-14', name: 'showInfoTips', value: 'true', updatedBy: 'admin' },
    { id: 'ss-15', name: 'SESSION_TIMEOUT_MINUTES', value: '30', updatedBy: 'admin' },
  ];

  // 4. Random UUID templates
  const tplOracleId = 'bc8e612f-682b-4e1b-b78c-023a7bbd326f';
  const tplPostgresId = '8b1968e0-40db-4fdf-9730-8a1a3848b11a';
  const tplMysqlId = '3182b820-2092-49af-bf20-56291a8ea8d3';
  const tplMssqlId = 'e528b809-f308-412f-b4fb-f4955b9e07fb';

  const templatesData = [
    {
      id: tplOracleId,
      name: 'Oracle Enterprise Standard',
      targetDbType: DbType.ORACLE,
      description: 'Standard health checks for Oracle Database instances (Tablespace, Active Sessions, Buffer Cache Hit Ratio).',
    },
    {
      id: tplPostgresId,
      name: 'PostgreSQL Core Health',
      targetDbType: DbType.POSTGRES,
      description: 'Connection saturation, cache hit ratio, and replication lag metrics for PostgreSQL.',
    },
    {
      id: tplMysqlId,
      name: 'MySQL Server Metrics',
      targetDbType: DbType.MYSQL,
      description: 'Thread concurrency, InnoDB buffer pool, and slow queries.',
    },
    {
      id: tplMssqlId,
      name: 'SQL Server Enterprise Baseline',
      targetDbType: DbType.MSSQL,
      description: 'Page Life Expectancy, buffer cache ratio, and batch requests per second.',
    },
  ];

  // 5. Random UUID metrics
  const metTablespaceId = 'f376f9d2-311b-4f81-80a2-25bd57e33527';
  const metActiveSessionsId = '14e7a79a-2415-46f4-a62d-94c6e9389e83';
  const metSaturationId = 'c906a2ff-9844-4f8a-9ea0-bf2f6027aef5';
  const metCacheHitId = '5e143b81-a982-411a-ab93-b8f9ee063251';
  const metThreadsId = 'a78912e8-54c3-4d22-83b1-ef12bebc5672';
  const metSlowQueriesId = 'd1c92a34-2e90-4bf6-9b87-1ab7ecb2e987';
  const metPageLifeId = '82e3ef15-189f-4315-9c94-14234b6b66fa';

  const metricsData = [
    {
      id: metTablespaceId,
      name: 'Tablespace Usage %',
      sqlQuery: 'SELECT tablespace_name AS name, ROUND((used_space/total_space)*100, 2) AS value FROM dba_tablespace_usage_metrics',
      valueType: ValueType.NUMBER,
      relationalOperator: '>=',
      cycle: 1,
      noAlertRequired: false,
      isEnabled: true,
      metricQueryType: 1,
      thresholdsConfig: {
        type: 'GLOBAL',
        global: { warn: '80', high: '90', critical: '95' }
      },
    },
    {
      id: metActiveSessionsId,
      name: 'Active Sessions Count',
      sqlQuery: "SELECT username AS name, COUNT(*) AS value FROM v$session WHERE status = 'ACTIVE' AND type != 'BACKGROUND' GROUP BY username",
      valueType: ValueType.NUMBER,
      relationalOperator: '>=',
      cycle: 1,
      noAlertRequired: false,
      isEnabled: true,
      metricQueryType: 1,
      thresholdsConfig: {
        type: 'GLOBAL',
        global: { warn: '150', high: '300', critical: '500' }
      },
    },
    {
      id: metSaturationId,
      name: 'Connection Saturation %',
      sqlQuery: "SELECT ROUND((count(*)::numeric / current_setting('max_connections')::numeric) * 100, 2) AS value FROM pg_stat_activity",
      valueType: ValueType.NUMBER,
      relationalOperator: '>=',
      cycle: 1,
      noAlertRequired: false,
      isEnabled: true,
      metricQueryType: 1,
      thresholdsConfig: {
        type: 'GLOBAL',
        global: { warn: '75', high: '85', critical: '95' }
      },
    },
    {
      id: metCacheHitId,
      name: 'Cache Hit Ratio %',
      sqlQuery: 'SELECT ROUND(sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2) AS value FROM pg_statio_user_tables',
      valueType: ValueType.NUMBER,
      relationalOperator: '<=',
      cycle: 1,
      noAlertRequired: false,
      isEnabled: true,
      metricQueryType: 1,
      thresholdsConfig: {
        type: 'GLOBAL',
        global: { warn: '95', high: '90', critical: '80' }
      },
    },
    {
      id: metThreadsId,
      name: 'Threads Connected',
      sqlQuery: "SHOW GLOBAL STATUS LIKE 'Threads_connected'",
      valueType: ValueType.NUMBER,
      relationalOperator: '>=',
      cycle: 1,
      noAlertRequired: false,
      isEnabled: true,
      metricQueryType: 1,
      thresholdsConfig: {
        type: 'GLOBAL',
        global: { warn: '200', high: '400', critical: '800' }
      },
    },
    {
      id: metSlowQueriesId,
      name: 'Slow Queries Rate',
      sqlQuery: "SHOW GLOBAL STATUS LIKE 'Slow_queries'",
      valueType: ValueType.NUMBER,
      relationalOperator: '>=',
      cycle: 1,
      noAlertRequired: false,
      isEnabled: true,
      metricQueryType: 1,
      thresholdsConfig: {
        type: 'GLOBAL',
        global: { warn: '10', high: '50', critical: '100' }
      },
    },
    {
      id: metPageLifeId,
      name: 'Page Life Expectancy (s)',
      sqlQuery: "SELECT [cntr_value] FROM sys.dm_os_performance_counters WHERE [counter_name] = 'Page life expectancy'",
      valueType: ValueType.NUMBER,
      relationalOperator: '<=',
      cycle: 1,
      noAlertRequired: false,
      isEnabled: true,
      metricQueryType: 1,
      thresholdsConfig: {
        type: 'GLOBAL',
        global: { warn: '300', high: '180', critical: '60' }
      },
    },
  ];

  // 6. Random UUID database groups
  const grpProdId = '0fa2c4d6-dbf1-46ab-a02e-c76b1e626e38';
  const grpFinanceId = '3ebc194e-28b9-4fa2-b6ab-1d3c5f2b2e90';
  const grpAnalyticsId = 'c0a80101-768a-4db5-9bf8-ca7788aa90e1';

  const groupsData = [
    {
      id: grpProdId,
      name: 'Production Mission Critical',
      description: 'Primary databases powering core transactional services. Tier-1 priority alerting.',
      alertMethodIds: 'meth-tg-01,meth-email-01',
      senderIds: '-1001234567890, dba-team@company.com, leads@company.com',
    },
    {
      id: grpFinanceId,
      name: 'Financial & Ledger Systems',
      description: 'High security accounting and payment settlement databases.',
      alertMethodIds: 'meth-email-01',
      senderIds: 'finance-tech@company.com',
    },
    {
      id: grpAnalyticsId,
      name: 'Data Warehouse & BI Analytics',
      description: 'Analytical reporting databases and ETL destination pipelines.',
      alertMethodIds: '',
      senderIds: '',
    },
  ];

  // 7. Random UUID Database Instances
  const dbOraId = '2a98f12d-fa01-4432-82ea-b9776d5423f1';
  const dbPgId = 'd8e3ab09-90bc-43bb-bf1c-5cb2b54bc3e8';
  const dbMyId = 'e3f4ab22-09ac-40fe-8fbc-df99824fcc2a';
  const dbMsId = '9cb8d712-4fb3-48ee-b883-fa4c2d3cb501';
  const dbStgMyId = '5526cb09-3ab3-46ea-9a88-77cb2d2c2d44';

  const databasesData = [
    {
      id: dbOraId,
      name: 'ERP_PROD_ORA',
      dbType: DbType.ORACLE,
      host: '10.0.12.44',
      port: 1521,
      pollId: 0,
      username: 'SYSTEM',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      connectionConfig: { sid: 'ORCLPRD', serviceName: 'orclprd.internal', sslMode: 'REQUIRED' },
      status: 'UP',
      lastCheckAt: new Date(Date.now() - 3 * 60000),
      isEnabled: true,
    },
    {
      id: dbPgId,
      name: 'PAYMENT_API_PG',
      dbType: DbType.POSTGRES,
      host: '10.0.14.88',
      port: 5432,
      pollId: 0,
      username: 'pay_service',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      connectionConfig: { databaseName: 'payment_ledger', sslMode: 'PREFER' },
      status: 'UP',
      lastCheckAt: new Date(Date.now() - 1 * 60000),
      isEnabled: true,
    },
    {
      id: dbMyId,
      name: 'CRM_PORTAL_MY',
      dbType: DbType.MYSQL,
      host: '10.0.20.102',
      port: 3306,
      pollId: 0,
      username: 'crm_admin',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      connectionConfig: { databaseName: 'crm_production', maxConnections: 500 },
      status: 'WARNING',
      lastCheckAt: new Date(Date.now() - 5 * 60000),
      isEnabled: true,
    },
    {
      id: dbMsId,
      name: 'DWH_REPORT_MS',
      dbType: DbType.MSSQL,
      host: '10.0.30.15',
      port: 1433,
      pollId: 0,
      username: 'sa_readonly',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      connectionConfig: { databaseName: 'DWH_Analytics', encrypt: true },
      status: 'UP',
      lastCheckAt: new Date(Date.now() - 12 * 60000),
      isEnabled: true,
    },
    {
      id: dbStgMyId,
      name: 'INVENTORY_STG_MY',
      dbType: DbType.MYSQL,
      host: '10.0.40.72',
      port: 3306,
      pollId: 0,
      username: 'stg_user',
      passwordEncrypted: 'enc:24be969ea89dd77dc256beab28bd03af:f73dedbced2513e6f2848f7d38b6bacd',
      connectionConfig: { databaseName: 'inventory_staging' },
      status: 'DOWN',
      lastCheckAt: new Date(Date.now() - 2 * 60000),
      isEnabled: true,
    },
  ];

  // 8. Prepare Relation Mappings
  const dbGroupMappings = [
    { databaseId: dbOraId, groupId: grpProdId },
    { databaseId: dbPgId, groupId: grpProdId },
    { databaseId: dbPgId, groupId: grpFinanceId },
    { databaseId: dbMyId, groupId: grpProdId },
    { databaseId: dbMsId, groupId: grpAnalyticsId },
    { databaseId: dbStgMyId, groupId: grpProdId },
  ];

  const dbMetricMappings = [
    { databaseId: dbOraId, metricId: metTablespaceId },
    { databaseId: dbOraId, metricId: metActiveSessionsId },
    { databaseId: dbPgId, metricId: metSaturationId },
    { databaseId: dbPgId, metricId: metCacheHitId },
    { databaseId: dbMyId, metricId: metThreadsId },
    { databaseId: dbMyId, metricId: metSlowQueriesId },
    { databaseId: dbMsId, metricId: metPageLifeId },
    { databaseId: dbStgMyId, metricId: metThreadsId },
    { databaseId: dbStgMyId, metricId: metSlowQueriesId },
  ];

  // Group to Template mappings with explicit names & targetDbType
  const groupTemplateMappings = [
    {
      groupId: grpProdId,
      groupName: 'Production Mission Critical',
      templateId: tplOracleId,
      templateName: 'Oracle Enterprise Standard',
      targetDbType: DbType.ORACLE,
    },
    {
      groupId: grpProdId,
      groupName: 'Production Mission Critical',
      templateId: tplPostgresId,
      templateName: 'PostgreSQL Core Health',
      targetDbType: DbType.POSTGRES,
    },
    {
      groupId: grpProdId,
      groupName: 'Production Mission Critical',
      templateId: tplMysqlId,
      templateName: 'MySQL Server Metrics',
      targetDbType: DbType.MYSQL,
    },
    {
      groupId: grpFinanceId,
      groupName: 'Financial & Ledger Systems',
      templateId: tplPostgresId,
      templateName: 'PostgreSQL Core Health',
      targetDbType: DbType.POSTGRES,
    },
    {
      groupId: grpAnalyticsId,
      groupName: 'Data Warehouse & BI Analytics',
      templateId: tplMssqlId,
      templateName: 'SQL Server Enterprise Baseline',
      targetDbType: DbType.MSSQL,
    },
  ];

  // New Dedicated Metric to Template mappings
  const metricTemplateMappings = [
    {
      metricId: metTablespaceId,
      metricName: 'Tablespace Usage %',
      templateId: tplOracleId,
      templateName: 'Oracle Enterprise Standard',
      targetDbType: DbType.ORACLE,
    },
    {
      metricId: metActiveSessionsId,
      metricName: 'Active Sessions Count',
      templateId: tplOracleId,
      templateName: 'Oracle Enterprise Standard',
      targetDbType: DbType.ORACLE,
    },
    {
      metricId: metSaturationId,
      metricName: 'Connection Saturation %',
      templateId: tplPostgresId,
      templateName: 'PostgreSQL Core Health',
      targetDbType: DbType.POSTGRES,
    },
    {
      metricId: metCacheHitId,
      metricName: 'Cache Hit Ratio %',
      templateId: tplPostgresId,
      templateName: 'PostgreSQL Core Health',
      targetDbType: DbType.POSTGRES,
    },
    {
      metricId: metThreadsId,
      metricName: 'Threads Connected',
      templateId: tplMysqlId,
      templateName: 'MySQL Server Metrics',
      targetDbType: DbType.MYSQL,
    },
    {
      metricId: metSlowQueriesId,
      metricName: 'Slow Queries Rate',
      templateId: tplMysqlId,
      templateName: 'MySQL Server Metrics',
      targetDbType: DbType.MYSQL,
    },
    {
      metricId: metPageLifeId,
      metricName: 'Page Life Expectancy (s)',
      templateId: tplMssqlId,
      templateName: 'SQL Server Enterprise Baseline',
      targetDbType: DbType.MSSQL,
    },
  ];

  // 9. Prepare Active Alerts
  const activeAlertsData = [
    {
      id: 1,
      dbId: dbMyId,
      metricId: metThreadsId,
      alertLevel: AlertLevel.WARN,
      message: 'Threads Connected (212) breached Warning threshold (200). Host: 10.0.20.102:3306.',
      value: '212',
      threshold: '200',
      objectName: 'Threads_connected',
      attributeName: 'threads',
      status: 'OPEN',
      createdAt: new Date(Date.now() - 15 * 60000),
    },
    {
      id: 2,
      dbId: dbStgMyId,
      metricId: metSlowQueriesId,
      alertLevel: AlertLevel.DOWN,
      message: 'Database Endpoint unreachable on TCP 10.0.40.72:3306. Connection refused.',
      value: '0',
      threshold: '1',
      objectName: 'INSTANCE',
      attributeName: 'connectivity',
      status: 'OPEN',
      createdAt: new Date(Date.now() - 45 * 60000),
    },
    {
      id: 3,
      dbId: dbOraId,
      metricId: metTablespaceId,
      alertLevel: AlertLevel.HIGH,
      message: 'Tablespace TS_DATA_PRD usage (91.40%) breached High threshold (90.00%).',
      value: '91.40',
      threshold: '90.00',
      objectName: 'TS_DATA_PRD',
      attributeName: 'used_space_pct',
      status: 'OPEN',
      createdAt: new Date(Date.now() - 120 * 60000),
    },
  ];

  // 10. Prepare Alert History Records
  const alertHistoryData = [
    {
      id: 1,
      dbId: dbPgId,
      metricId: metSaturationId,
      alertLevel: AlertLevel.HIGH,
      message: 'Connection Saturation % (87.50%) breached High threshold (85.00%).',
      value: '87.50',
      threshold: '85.00',
      objectName: 'payment_gateway',
      attributeName: 'active_connections_pct',
      resolutionStatus: 'CLEARED_BY_USER',
      dispatchStatus: 'DISPATCHED',
      createdAt: new Date(Date.now() - 180 * 60000),
      clearedAt: new Date(Date.now() - 120 * 60000),
      clearedById: adminUserId,
    },
    {
      id: 2,
      dbId: dbOraId,
      metricId: metActiveSessionsId,
      alertLevel: AlertLevel.CRITICAL,
      message: 'Active Sessions Count (512) breached Critical threshold (500).',
      value: '512',
      threshold: '500',
      objectName: 'SYSDBA',
      attributeName: 'active_sessions',
      resolutionStatus: 'CLEARED_BY_USER',
      dispatchStatus: 'DISPATCHED',
      createdAt: new Date(Date.now() - 360 * 60000),
      clearedAt: new Date(Date.now() - 240 * 60000),
      clearedById: adminUserId,
    },
    {
      id: 3,
      dbId: dbMsId,
      metricId: metPageLifeId,
      alertLevel: AlertLevel.WARN,
      message: 'Page Life Expectancy (280s) dropped below Warning threshold (300s).',
      value: '280',
      threshold: '300',
      objectName: 'GLOBAL',
      attributeName: 'ple_seconds',
      resolutionStatus: 'CLEARED_BY_USER',
      dispatchStatus: 'DISPATCHED',
      createdAt: new Date(Date.now() - 720 * 60000),
      clearedAt: new Date(Date.now() - 500 * 60000),
      clearedById: viewerUserId,
    },
  ];

  // 10.5. Prepare Raw Query & Measurement Data Points
  const metricDataPointsData = [
    {
      id: 'dp-a8d29c8e',
      dbId: dbOraId,
      metricId: metTablespaceId,
      objectName: 'TS_DATA_PRD',
      attributeName: 'used_space_pct',
      value: '91.4',
      measuredAt: new Date(Date.now() - 2 * 60000),
    },
    {
      id: 'dp-28a11eef',
      dbId: dbOraId,
      metricId: metActiveSessionsId,
      objectName: 'SYSDBA',
      attributeName: 'active_sessions',
      value: '184',
      measuredAt: new Date(Date.now() - 3 * 60000),
    },
    {
      id: 'dp-ef731a29',
      dbId: dbPgId,
      metricId: metSaturationId,
      objectName: 'payment_gateway',
      attributeName: 'active_connections_pct',
      value: '62.4',
      measuredAt: new Date(Date.now() - 4 * 60000),
    },
    {
      id: 'dp-78d12b0a',
      dbId: dbPgId,
      metricId: metCacheHitId,
      objectName: 'replica_standby_01',
      attributeName: 'lag_seconds',
      value: '0',
      measuredAt: new Date(Date.now() - 5 * 60000),
    },
    {
      id: 'dp-bc89ef2a',
      dbId: dbMyId,
      metricId: metThreadsId,
      objectName: 'Threads_connected',
      attributeName: 'threads',
      value: '212',
      measuredAt: new Date(Date.now() - 6 * 60000),
    },
  ];

  // 10.6. Seed Alert Notification Logs
  const alertNotificationLogsData = [
    {
      id: 'notif-log-01',
      timestamp: new Date(Date.now() - 18 * 60000),
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
      timestamp: new Date(Date.now() - 18 * 60000 + 1200),
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
      timestamp: new Date(Date.now() - 35 * 60000),
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
      timestamp: new Date(Date.now() - 75 * 60000),
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
      timestamp: new Date(Date.now() - 120 * 60000),
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
      timestamp: new Date(Date.now() - 5 * 3600000),
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

  // 10.7. Seed Database Poll Queue
  const databasePollQueueData: any[] = [];

  // 10.8. Seed Database Poll Log
  const databasePollLogData: any[] = [];

  // 10.9. Seed Alert Notification Queue
  const alertNotificationQueueData = [
    {
      id: 'notif-q-01',
      alertId: '1',
      dbId: dbMyId,
      dbName: 'CRM_PORTAL_MY',
      metricName: 'Threads Connected',
      attributeName: 'Threads_connected',
      alertLevel: 'WARN',
      eventType: 'TRIGGER',
      dispatcherId: 'meth-slack-03',
      dispatcherName: 'Slack NOC Incident Channel',
      dispatcherType: 'SLACK',
      status: 'PENDING',
      scheduledAt: new Date(),
      createdAt: new Date(),
    },
  ];

  // 10.95. Partition Table metric_data_points by measured_at Day (Format: pYYYYMMDD)
  console.log('📦 Setting up daily partitioning on metric_data_points (by measured_at, format pYYYYMMDD)...');
  try {
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const firstPartitionName = `p${yyyy}${mm}${dd}`;

    const nextDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
    const nextYyyy = nextDay.getUTCFullYear();
    const nextMm = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
    const nextDd = String(nextDay.getUTCDate()).padStart(2, '0');
    const nextDayStr = `${nextYyyy}-${nextMm}-${nextDd}`;

    // 1. Drop foreign keys if MySQL InnoDB constraints exist (MySQL disallows FKs on partitioned tables)
    try {
      const fks: any = await p.$queryRawUnsafe(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'metric_data_points' 
          AND REFERENCED_TABLE_NAME IS NOT NULL;
      `);
      if (Array.isArray(fks)) {
        for (const fk of fks) {
          if (fk.CONSTRAINT_NAME) {
            await p.$executeRawUnsafe(
              `ALTER TABLE \`metric_data_points\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\`;`
            );
          }
        }
      }
    } catch (fkErr: any) {
      // Ignored if not MySQL or no FKs present
    }

    // 2. Check if table is already partitioned
    const existingPartitions: any = await p.$queryRawUnsafe(`
      SELECT PARTITION_NAME 
      FROM information_schema.PARTITIONS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'metric_data_points' 
        AND PARTITION_NAME IS NOT NULL;
    `);

    if (Array.isArray(existingPartitions) && existingPartitions.length > 0) {
      console.log(`ℹ️ metric_data_points is already partitioned. Existing partitions: ${existingPartitions.map((ep: any) => ep.PARTITION_NAME).join(', ')}`);
      const hasFirstPartition = existingPartitions.some((ep: any) => ep.PARTITION_NAME === firstPartitionName);
      const hasFuturePartition = existingPartitions.some((ep: any) => ep.PARTITION_NAME === 'p_future');

      if (!hasFirstPartition) {
        if (hasFuturePartition) {
          try {
            await p.$executeRawUnsafe(`
              ALTER TABLE \`metric_data_points\` 
              REORGANIZE PARTITION \`p_future\` INTO (
                PARTITION \`${firstPartitionName}\` VALUES LESS THAN (TO_DAYS('${nextDayStr}'))
              );
            `);
            console.log(`✅ Reorganized partition p_future into initial partition ${firstPartitionName} (LESS THAN TO_DAYS('${nextDayStr}')).`);
          } catch {
            try {
              await p.$executeRawUnsafe(`
                ALTER TABLE \`metric_data_points\` 
                ADD PARTITION (
                  PARTITION \`${firstPartitionName}\` VALUES LESS THAN (TO_DAYS('${nextDayStr}'))
                );
              `);
              console.log(`✅ Added daily partition ${firstPartitionName}.`);
            } catch {
              // Already covered by range
            }
          }
        } else {
          try {
            await p.$executeRawUnsafe(`
              ALTER TABLE \`metric_data_points\` 
              ADD PARTITION (
                PARTITION \`${firstPartitionName}\` VALUES LESS THAN (TO_DAYS('${nextDayStr}'))
              );
            `);
            console.log(`✅ Added daily partition ${firstPartitionName}.`);
          } catch {
            // Already covered by range
          }
        }
      }
    } else {
      // 3. Alter table to partition by range of TO_DAYS(measured_at) with first partition pYYYYMMDD (no p_future)
      await p.$executeRawUnsafe(`
        ALTER TABLE \`metric_data_points\` 
        PARTITION BY RANGE (TO_DAYS(\`measured_at\`)) (
          PARTITION \`${firstPartitionName}\` VALUES LESS THAN (TO_DAYS('${nextDayStr}'))
        );
      `);
      console.log(`✅ Successfully created first partition "${firstPartitionName}" on metric_data_points table (by measured_at day).`);
    }
  } catch (partErr: any) {
    console.warn('⚠️ Partition configuration note (will proceed with data insertion):', partErr.message);
  }

  // 11. Execute High-Performance Batched Inserters (Atomic Transaction)
  console.log('⚡ Executing optimized batch insertions...');
  await p.$transaction([
    p.user.createMany({ data: usersData, skipDuplicates: true }),
    p.systemSettings.createMany({ data: systemSettingsData, skipDuplicates: true }),
    p.template.createMany({ data: templatesData, skipDuplicates: true }),
    p.metric.createMany({ data: metricsData, skipDuplicates: true }),
    p.databaseGroup.createMany({ data: groupsData, skipDuplicates: true }),
    p.database.createMany({ data: databasesData, skipDuplicates: true }),
    p.databaseEngine.createMany({ data: databaseEnginesData, skipDuplicates: true }),
    p.alertNotificationMethod.createMany({ data: alertNotificationMethodsData, skipDuplicates: true }),
    p.databaseGroupMapping.createMany({ data: dbGroupMappings, skipDuplicates: true }),
    p.databaseMetricMapping.createMany({ data: dbMetricMappings, skipDuplicates: true }),
    p.groupTemplateMapping.createMany({ data: groupTemplateMappings, skipDuplicates: true }),
    p.metricTemplateMapping.createMany({ data: metricTemplateMappings, skipDuplicates: true }),
    p.activeAlert.createMany({ data: activeAlertsData, skipDuplicates: true }),
    p.alertHistory.createMany({ data: alertHistoryData, skipDuplicates: true }),
    p.metricDataPoint.createMany({ data: metricDataPointsData, skipDuplicates: true }),
    p.alertNotificationLog.createMany({ data: alertNotificationLogsData, skipDuplicates: true }),
    p.databasePollQueue.createMany({ data: databasePollQueueData, skipDuplicates: true }),
    p.databasePollLog.createMany({ data: databasePollLogData, skipDuplicates: true }),
    p.alertNotificationQueue.createMany({ data: alertNotificationQueueData, skipDuplicates: true }),
  ]);

  // 12. Create views in database for mapping tables for analyze
  console.log('👁️ Creating analytical database views...');
  try {
    await p.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW view_group_template_analysis AS
      SELECT 
        group_id AS GroupID, 
        group_name AS GroupName, 
        template_id AS TemplateID, 
        template_name AS TemplateName, 
        target_db_type AS TargetDbType, 
        created_at AS AssociatedAt 
      FROM group_template_mappings;
    `);
    await p.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW view_metric_template_analysis AS
      SELECT 
        metric_id AS MetricID, 
        metric_name AS MetricName, 
        template_id AS TemplateID, 
        template_name AS TemplateName, 
        target_db_type AS TargetDbType, 
        created_at AS AssociatedAt 
      FROM metric_template_mappings;
    `);
    await p.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW \`view_metric_data_points\` AS
      SELECT 
        \`mdp\`.\`id\`, 
        \`mdp\`.\`database_id\`, 
        \`d\`.\`name\` AS \`database_name\`, 
        \`d\`.\`host\` AS \`database_ip\`, 
        \`d\`.\`port\` AS \`database_port\`, 
        \`mdp\`.\`metric_id\`, 
        \`m\`.\`name\` AS \`metric_name\`, 
        \`m\`.\`cycle\` AS \`cycle\`, 
        \`mdp\`.\`object_name\`, 
        \`mdp\`.\`attribute_name\`, 
        \`mdp\`.\`value\`, 
        \`mdp\`.\`measured_at\` 
      FROM \`metric_data_points\` \`mdp\`
      LEFT JOIN \`databases\` \`d\` ON \`mdp\`.\`database_id\` = \`d\`.\`id\`
      LEFT JOIN \`metrics\` \`m\` ON \`mdp\`.\`metric_id\` = \`m\`.\`id\`;
    `);
    await p.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW \`view_active_database_active_metrics\` AS
      SELECT DISTINCT
        \`d\`.\`id\` AS \`database_id\`,
        \`d\`.\`name\` AS \`database_name\`,
        \`d\`.\`dbType\` AS \`database_db_type\`,
        \`d\`.\`host\` AS \`database_host\`,
        \`d\`.\`port\` AS \`database_port\`,
        \`d\`.\`poll_id\` AS \`database_poll_id\`,
        \`d\`.\`tags\` AS \`database_tags\`,
        \`d\`.\`poll_interval_minutes\` AS \`database_poll_interval_minutes\`,
        \`d\`.\`note\` AS \`database_note\`,
        \`d\`.\`username\` AS \`database_username\`,
        \`d\`.\`passwordEncrypted\` AS \`database_password_encrypted\`,
        \`d\`.\`connectionConfig\` AS \`database_connection_config\`,
        \`d\`.\`status\` AS \`database_status\`,
        \`d\`.\`lastCheckAt\` AS \`database_last_check_at\`,
        \`d\`.\`isEnabled\` AS \`database_is_enabled\`,
        \`d\`.\`createdAt\` AS \`database_created_at\`,
        \`d\`.\`updatedAt\` AS \`database_updated_at\`,
        \`dg\`.\`id\` AS \`group_id\`,
        \`dg\`.\`name\` AS \`group_name\`,
        \`t\`.\`id\` AS \`template_id\`,
        \`t\`.\`name\` AS \`template_name\`,
        \`m\`.\`id\` AS \`metric_id\`,
        \`m\`.\`name\` AS \`metric_name\`,
        \`m\`.\`sqlQuery\` AS \`metric_sql_query\`,
        \`m\`.\`valueType\` AS \`metric_value_type\`,
        \`m\`.\`relational_operator\` AS \`metric_relational_operator\`,
        \`m\`.\`metric_query_type\` AS \`metric_query_type\`,
        \`m\`.\`thresholds_config\` AS \`metric_thresholds_config\`,
        \`m\`.\`cycle\` AS \`metric_cycle\`,
        \`m\`.\`no_alert_required\` AS \`metric_no_alert_required\`,
        \`m\`.\`isEnabled\` AS \`metric_is_enabled\`,
        \`m\`.\`createdAt\` AS \`metric_created_at\`,
        \`m\`.\`updatedAt\` AS \`metric_updated_at\`
      FROM \`databases\` \`d\`
      JOIN \`database_group_mappings\` \`dgm\` ON \`d\`.\`id\` = \`dgm\`.\`databaseId\`
      JOIN \`database_groups\` \`dg\` ON \`dgm\`.\`groupId\` = \`dg\`.\`id\`
      JOIN \`group_template_mappings\` \`gtm\` ON \`dg\`.\`id\` = \`gtm\`.\`group_id\`
      JOIN \`templates\` \`t\` ON \`gtm\`.\`template_id\` = \`t\`.\`id\`
      JOIN \`metric_template_mappings\` \`mtm\` ON \`t\`.\`id\` = \`mtm\`.\`template_id\`
      JOIN \`metrics\` \`m\` ON \`mtm\`.\`metric_id\` = \`m\`.\`id\`
      WHERE \`d\`.\`isEnabled\` = true 
        AND \`m\`.\`isEnabled\` = true
        AND (\`t\`.\`targetDbType\` IS NULL OR \`t\`.\`targetDbType\` = \`d\`.\`dbType\`);
    `);
    console.log('✅ Analytical views created successfully.');
  } catch (err: any) {
    console.warn('⚠️ Analytical views creation skipped or unsupported in this database dialect:', err.message);
  }

  const elapsedTimeMs = Date.now() - startTime;
  console.log(`✅ Database seeding completed successfully in ${elapsedTimeMs}ms!`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔒 Prisma Client disconnected.');
  });
