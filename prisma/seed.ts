import { PrismaClient, Role, DbType, ValueType, AlertLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const p = prisma as any;

async function main() {
  console.log('🌱 Starting optimized database seeding with Prisma v6...');
  const startTime = Date.now();

  // 1. Clean Upside-Down Truncations / Deletions (handling dependent tables first)
  console.log('🧹 Cleaning existing data in reverse dependency order...');
  await p.$transaction([
    p.metricValueHistory.deleteMany(),
    p.metricDataPoint.deleteMany(),
    p.alertHistory.deleteMany(),
    p.activeAlert.deleteMany(),
    p.databaseMetricMapping.deleteMany(),
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

  const usersData = [
    { id: 'usr-admin-01', username: adminUsername, passwordHash: adminHash, role: Role.ADMIN },
    { id: 'usr-viewer-02', username: viewerUsername, passwordHash: viewerHash, role: Role.VIEWER },
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

  // 4. Prepare Monitoring Templates
  const templatesData = [
    {
      id: 'tpl-ora-01',
      name: 'Oracle Enterprise Standard',
      targetDbType: DbType.ORACLE,
      description: 'Standard health checks for Oracle Database instances (Tablespace, Active Sessions, Buffer Cache Hit Ratio).',
    },
    {
      id: 'tpl-pg-01',
      name: 'PostgreSQL Core Health',
      targetDbType: DbType.POSTGRES,
      description: 'Connection saturation, cache hit ratio, and replication lag metrics for PostgreSQL.',
    },
    {
      id: 'tpl-my-01',
      name: 'MySQL Server Metrics',
      targetDbType: DbType.MYSQL,
      description: 'Thread concurrency, InnoDB buffer pool, and slow queries.',
    },
    {
      id: 'tpl-ms-01',
      name: 'SQL Server Enterprise Baseline',
      targetDbType: DbType.MSSQL,
      description: 'Page Life Expectancy, buffer cache ratio, and batch requests per second.',
    },
  ];

  // 5. Prepare Metrics Definitions
  const metricsData = [
    {
      id: 'met-01',
      name: 'Tablespace Usage %',
      sqlQuery: 'SELECT tablespace_name AS name, ROUND((used_space/total_space)*100, 2) AS value FROM dba_tablespace_usage_metrics',
      valueType: ValueType.NUMBER,
      thresholdWarn: '80',
      thresholdHigh: '90',
      thresholdCritical: '95',
      frequencyMinutes: 5,
      templateId: 'tpl-ora-01',
      isEnabled: true,
    },
    {
      id: 'met-02',
      name: 'Active Sessions Count',
      sqlQuery: "SELECT username AS name, COUNT(*) AS value FROM v$session WHERE status = 'ACTIVE' AND type != 'BACKGROUND' GROUP BY username",
      valueType: ValueType.NUMBER,
      thresholdWarn: '150',
      thresholdHigh: '300',
      thresholdCritical: '500',
      frequencyMinutes: 1,
      templateId: 'tpl-ora-01',
      isEnabled: true,
    },
    {
      id: 'met-03',
      name: 'Connection Saturation %',
      sqlQuery: "SELECT ROUND((count(*)::numeric / current_setting('max_connections')::numeric) * 100, 2) AS value FROM pg_stat_activity",
      valueType: ValueType.NUMBER,
      thresholdWarn: '75',
      thresholdHigh: '85',
      thresholdCritical: '95',
      frequencyMinutes: 2,
      templateId: 'tpl-pg-01',
      isEnabled: true,
    },
    {
      id: 'met-04',
      name: 'Cache Hit Ratio %',
      sqlQuery: 'SELECT ROUND(sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2) AS value FROM pg_statio_user_tables',
      valueType: ValueType.NUMBER,
      thresholdWarn: '95',
      thresholdHigh: '90',
      thresholdCritical: '80',
      frequencyMinutes: 5,
      templateId: 'tpl-pg-01',
      isEnabled: true,
    },
    {
      id: 'met-05',
      name: 'Threads Connected',
      sqlQuery: "SHOW GLOBAL STATUS LIKE 'Threads_connected'",
      valueType: ValueType.NUMBER,
      thresholdWarn: '200',
      thresholdHigh: '400',
      thresholdCritical: '800',
      frequencyMinutes: 1,
      templateId: 'tpl-my-01',
      isEnabled: true,
    },
    {
      id: 'met-06',
      name: 'Slow Queries Rate',
      sqlQuery: "SHOW GLOBAL STATUS LIKE 'Slow_queries'",
      valueType: ValueType.NUMBER,
      thresholdWarn: '10',
      thresholdHigh: '50',
      thresholdCritical: '100',
      frequencyMinutes: 5,
      templateId: 'tpl-my-01',
      isEnabled: true,
    },
    {
      id: 'met-07',
      name: 'Page Life Expectancy (s)',
      sqlQuery: "SELECT [cntr_value] FROM sys.dm_os_performance_counters WHERE [counter_name] = 'Page life expectancy'",
      valueType: ValueType.NUMBER,
      thresholdWarn: '300',
      thresholdHigh: '180',
      thresholdCritical: '60',
      frequencyMinutes: 2,
      templateId: 'tpl-ms-01',
      isEnabled: true,
    },
  ];

  // 6. Prepare Database Groups
  const groupsData = [
    {
      id: 'grp-prod-01',
      name: 'Production Mission Critical',
      description: 'Primary databases powering core transactional services. Tier-1 priority alerting.',
      alertMethodIds: 'meth-tg-01,meth-email-01',
      senderIds: '-1001234567890, dba-team@company.com, leads@company.com',
    },
    {
      id: 'grp-finance-02',
      name: 'Financial & Ledger Systems',
      description: 'High security accounting and payment settlement databases.',
      alertMethodIds: 'meth-email-01',
      senderIds: 'finance-tech@company.com',
    },
    {
      id: 'grp-analytics-03',
      name: 'Data Warehouse & BI Analytics',
      description: 'Analytical reporting databases and ETL destination pipelines.',
      alertMethodIds: '',
      senderIds: '',
    },
  ];

  // 7. Prepare Database Instances
  const databasesData = [
    {
      id: 'db-01',
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
      id: 'db-02',
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
      id: 'db-03',
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
      id: 'db-04',
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
      id: 'db-05',
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
    { databaseId: 'db-01', groupId: 'grp-prod-01' },
    { databaseId: 'db-02', groupId: 'grp-prod-01' },
    { databaseId: 'db-02', groupId: 'grp-finance-02' },
    { databaseId: 'db-03', groupId: 'grp-prod-01' },
    { databaseId: 'db-04', groupId: 'grp-analytics-03' },
  ];

  const dbMetricMappings = [
    { databaseId: 'db-01', metricId: 'met-01' },
    { databaseId: 'db-01', metricId: 'met-02' },
    { databaseId: 'db-02', metricId: 'met-03' },
    { databaseId: 'db-02', metricId: 'met-04' },
    { databaseId: 'db-03', metricId: 'met-05' },
    { databaseId: 'db-03', metricId: 'met-06' },
    { databaseId: 'db-04', metricId: 'met-07' },
    { databaseId: 'db-05', metricId: 'met-05' },
    { databaseId: 'db-05', metricId: 'met-06' },
  ];

  const groupTemplateMappings = [
    { groupId: 'grp-prod-01', templateId: 'tpl-ora-01' },
    { groupId: 'grp-prod-01', templateId: 'tpl-pg-01' },
    { groupId: 'grp-finance-02', templateId: 'tpl-pg-01' },
    { groupId: 'grp-analytics-03', templateId: 'tpl-ms-01' },
  ];

  // 9. Prepare Active Alerts
  const activeAlertsData = [
    {
      id: 'alt-01',
      dbId: 'db-03',
      metricId: 'met-05',
      alertLevel: AlertLevel.WARN,
      message: 'Threads Connected (212) breached Warning threshold (200). Host: 10.0.20.102:3306.',
      value: '212',
      threshold: '200',
      createdAt: new Date(Date.now() - 15 * 60000),
    },
    {
      id: 'alt-02',
      dbId: 'db-05',
      metricId: 'met-06',
      alertLevel: AlertLevel.DOWN,
      message: 'Database Endpoint unreachable on TCP 10.0.40.72:3306. Connection refused.',
      value: '0',
      threshold: '1',
      createdAt: new Date(Date.now() - 45 * 60000),
    },
    {
      id: 'alt-03',
      dbId: 'db-01',
      metricId: 'met-01',
      alertLevel: AlertLevel.HIGH,
      message: 'Tablespace TS_DATA_PRD usage (91.40%) breached High threshold (90.00%).',
      value: '91.40',
      threshold: '90.00',
      createdAt: new Date(Date.now() - 120 * 60000),
    },
  ];

  // 10. Prepare Alert History Records
  const alertHistoryData = [
    {
      id: 'h-01',
      dbId: 'db-02',
      metricId: 'met-03',
      alertLevel: AlertLevel.HIGH,
      message: 'Connection Saturation % (87.50%) breached High threshold (85.00%).',
      value: '87.50',
      threshold: '85.00',
      createdAt: new Date(Date.now() - 180 * 60000),
      clearedAt: new Date(Date.now() - 120 * 60000),
      clearedById: 'usr-admin-01',
    },
    {
      id: 'h-02',
      dbId: 'db-01',
      metricId: 'met-02',
      alertLevel: AlertLevel.CRITICAL,
      message: 'Active Sessions Count (512) breached Critical threshold (500).',
      value: '512',
      threshold: '500',
      createdAt: new Date(Date.now() - 360 * 60000),
      clearedAt: new Date(Date.now() - 240 * 60000),
      clearedById: 'usr-admin-01',
    },
    {
      id: 'h-03',
      dbId: 'db-04',
      metricId: 'met-07',
      alertLevel: AlertLevel.WARN,
      message: 'Page Life Expectancy (280s) dropped below Warning threshold (300s).',
      value: '280',
      threshold: '300',
      createdAt: new Date(Date.now() - 720 * 60000),
      clearedAt: new Date(Date.now() - 500 * 60000),
      clearedById: 'usr-viewer-02',
    },
  ];
  
  // 10.5. Prepare Raw Query & Measurement Data Points
  const metricDataPointsData = [
    {
      id: 'dp-01',
      databaseId: 'db-01',
      metricId: 'met-01',
      objectName: 'TS_DATA_PRD',
      attributeName: 'used_space_pct',
      value: '91.4',
      measuredAt: new Date(Date.now() - 2 * 60000),
    },
    {
      id: 'dp-02',
      databaseId: 'db-01',
      metricId: 'met-02',
      objectName: 'SYSDBA',
      attributeName: 'active_sessions',
      value: '184',
      measuredAt: new Date(Date.now() - 3 * 60000),
    },
    {
      id: 'dp-03',
      databaseId: 'db-02',
      metricId: 'met-03',
      objectName: 'payment_gateway',
      attributeName: 'active_connections_pct',
      value: '62.4',
      measuredAt: new Date(Date.now() - 4 * 60000),
    },
    {
      id: 'dp-04',
      databaseId: 'db-02',
      metricId: 'met-04',
      objectName: 'replica_standby_01',
      attributeName: 'lag_seconds',
      value: '0',
      measuredAt: new Date(Date.now() - 5 * 60000),
    },
    {
      id: 'dp-05',
      databaseId: 'db-03',
      metricId: 'met-05',
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
    p.activeAlert.createMany({ data: activeAlertsData, skipDuplicates: true }),
    p.alertHistory.createMany({ data: alertHistoryData, skipDuplicates: true }),
    p.metricDataPoint.createMany({ data: metricDataPointsData, skipDuplicates: true }),
  ]);

  const elapsedTimeMs = Date.now() - startTime;
  console.log(`✅ Database seeding completed successfully in ${elapsedTimeMs}ms!`);
  console.log(`   - 👤 Users: ${usersData.length} seeded (${adminUsername}, ${viewerUsername})`);
  console.log(`   - ⚙️ System Settings: 1 default config created`);
  console.log(`   - 📋 Templates: ${templatesData.length} records`);
  console.log(`   - 📊 Metrics: ${metricsData.length} records`);
  console.log(`   - 📁 Groups: ${groupsData.length} records`);
  console.log(`   - 🗄️ Databases: ${databasesData.length} instances`);
  console.log(`   - 🔔 Active Alerts: ${activeAlertsData.length} records`);
  console.log(`   - 📜 Alert History: ${alertHistoryData.length} records`);
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
