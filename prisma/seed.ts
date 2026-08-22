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
    p.metricValueHistory.deleteMany(),
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
  ]);
  console.log('✨ Data cleanup completed successfully.');

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

  // 3. Prepare System Settings Record
  const systemSettingsData = {
    id: 'default',
    apiCollectorEnabled: true,
    collectorEndpoint: process.env.COLLECTOR_HEALTH_CHECK_URL || 'http://localhost:3000/api/collector/mock-health',
    collectorApiKey: 'dbf_live_col_9f88a2e1b4c3d4e5f6a7b8c9d0e1f2a3',
    collectorPollIntervalSeconds: 60,
    collectorBatchSize: 250,
    collectorTimeoutMs: 5000,
    collectorRetryPolicy: 'Exponential Backoff (Max 5 retries)',
    globalAlertThresholdMode: 'STANDARD',
    maxRetryAttempts: 3,
    notificationDispatchIntervalSeconds: 30,
    defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Ho_Chi_Minh (UTC+7)',
    dataRetentionDays: 90,
    autoClearResolvedAlerts: true,
    centralDbSyncEnabled: true,
    centralDbConnectionString: process.env.DATABASE_URL || 'mysql://dbmon_user:secret_storage_password@127.0.0.1:3306/db_monitoring_system',
    updatedBy: 'admin',
  };

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
      thresholdWarn: '80',
      thresholdHigh: '90',
      thresholdCritical: '95',
      frequencyMinutes: 5,
      noAlertRequired: false,
      isEnabled: true,
    },
    {
      id: metActiveSessionsId,
      name: 'Active Sessions Count',
      sqlQuery: "SELECT username AS name, COUNT(*) AS value FROM v$session WHERE status = 'ACTIVE' AND type != 'BACKGROUND' GROUP BY username",
      valueType: ValueType.NUMBER,
      thresholdWarn: '150',
      thresholdHigh: '300',
      thresholdCritical: '500',
      frequencyMinutes: 1,
      noAlertRequired: false,
      isEnabled: true,
    },
    {
      id: metSaturationId,
      name: 'Connection Saturation %',
      sqlQuery: "SELECT ROUND((count(*)::numeric / current_setting('max_connections')::numeric) * 100, 2) AS value FROM pg_stat_activity",
      valueType: ValueType.NUMBER,
      thresholdWarn: '75',
      thresholdHigh: '85',
      thresholdCritical: '95',
      frequencyMinutes: 2,
      noAlertRequired: false,
      isEnabled: true,
    },
    {
      id: metCacheHitId,
      name: 'Cache Hit Ratio %',
      sqlQuery: 'SELECT ROUND(sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2) AS value FROM pg_statio_user_tables',
      valueType: ValueType.NUMBER,
      thresholdWarn: '95',
      thresholdHigh: '90',
      thresholdCritical: '80',
      frequencyMinutes: 5,
      noAlertRequired: false,
      isEnabled: true,
    },
    {
      id: metThreadsId,
      name: 'Threads Connected',
      sqlQuery: "SHOW GLOBAL STATUS LIKE 'Threads_connected'",
      valueType: ValueType.NUMBER,
      thresholdWarn: '200',
      thresholdHigh: '400',
      thresholdCritical: '800',
      frequencyMinutes: 1,
      noAlertRequired: false,
      isEnabled: true,
    },
    {
      id: metSlowQueriesId,
      name: 'Slow Queries Rate',
      sqlQuery: "SHOW GLOBAL STATUS LIKE 'Slow_queries'",
      valueType: ValueType.NUMBER,
      thresholdWarn: '10',
      thresholdHigh: '50',
      thresholdCritical: '100',
      frequencyMinutes: 5,
      noAlertRequired: false,
      isEnabled: true,
    },
    {
      id: metPageLifeId,
      name: 'Page Life Expectancy (s)',
      sqlQuery: "SELECT [cntr_value] FROM sys.dm_os_performance_counters WHERE [counter_name] = 'Page life expectancy'",
      valueType: ValueType.NUMBER,
      thresholdWarn: '300',
      thresholdHigh: '180',
      thresholdCritical: '60',
      frequencyMinutes: 2,
      noAlertRequired: false,
      isEnabled: true,
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
      username: 'SYSTEM',
      passwordEncrypted: 'Encrypted(P@ssw0rd123!)',
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
      username: 'pay_service',
      passwordEncrypted: 'Encrypted(PaySecure#2026)',
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
      username: 'crm_admin',
      passwordEncrypted: 'Encrypted(CrmAdmin!99)',
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
      username: 'sa_readonly',
      passwordEncrypted: 'Encrypted(DwhReadonly#123)',
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
      username: 'stg_user',
      passwordEncrypted: 'Encrypted(StgUserPass!)',
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
      id: 'alt-f8319a2b',
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
      id: 'alt-d09f7a11',
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
      id: 'alt-e9a11c82',
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
      id: 'h-67a21f8e',
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
      id: 'h-0a911e2f',
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
      id: 'h-de938a1f',
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

  // 11. Execute High-Performance Batched Inserters (Atomic Transaction)
  console.log('⚡ Executing optimized batch insertions...');
  await p.$transaction([
    p.user.createMany({ data: usersData, skipDuplicates: true }),
    p.systemSettings.create({ data: systemSettingsData }),
    p.template.createMany({ data: templatesData, skipDuplicates: true }),
    p.metric.createMany({ data: metricsData, skipDuplicates: true }),
    p.databaseGroup.createMany({ data: groupsData, skipDuplicates: true }),
    p.database.createMany({ data: databasesData, skipDuplicates: true }),
    p.databaseGroupMapping.createMany({ data: dbGroupMappings, skipDuplicates: true }),
    p.databaseMetricMapping.createMany({ data: dbMetricMappings, skipDuplicates: true }),
    p.groupTemplateMapping.createMany({ data: groupTemplateMappings, skipDuplicates: true }),
    p.metricTemplateMapping.createMany({ data: metricTemplateMappings, skipDuplicates: true }),
    p.activeAlert.createMany({ data: activeAlertsData, skipDuplicates: true }),
    p.alertHistory.createMany({ data: alertHistoryData, skipDuplicates: true }),
    p.metricDataPoint.createMany({ data: metricDataPointsData, skipDuplicates: true }),
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
