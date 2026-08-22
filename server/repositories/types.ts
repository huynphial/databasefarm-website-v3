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

export interface IStorageRepository {
  getStorageType(): 'prisma' | 'memory';

  // Users
  getUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | null>;

  // Database Engines (Dynamic Registry)
  getDatabaseEngines(): Promise<DatabaseEngineEntity[]>;
  saveDatabaseEngine(engineData: Partial<DatabaseEngineEntity>): Promise<DatabaseEngineEntity>;
  deleteDatabaseEngine(id: string): Promise<boolean>;

  // Alert Notification Methods (Dynamic Dispatchers)
  getAlertNotificationMethods(): Promise<AlertNotificationMethodEntity[]>;
  saveAlertNotificationMethod(methodData: Partial<AlertNotificationMethodEntity>): Promise<AlertNotificationMethodEntity>;
  deleteAlertNotificationMethod(id: string): Promise<boolean>;

  // Databases
  getDatabases(): Promise<DatabaseEntity[]>;
  getDatabaseById(id: string): Promise<DatabaseEntity | null>;
  saveDatabase(dbData: Partial<DatabaseEntity>): Promise<DatabaseEntity>;
  deleteDatabase(id: string): Promise<boolean>;

  // Metrics
  getMetrics(): Promise<MetricEntity[]>;
  getMetricById(id: string): Promise<MetricEntity | null>;
  saveMetric(metricData: Partial<MetricEntity>): Promise<MetricEntity>;
  deleteMetric(id: string): Promise<boolean>;

  // Templates
  getTemplates(): Promise<TemplateEntity[]>;
  getTemplateById(id: string): Promise<TemplateEntity | null>;
  saveTemplate(tplData: Partial<TemplateEntity>): Promise<TemplateEntity>;
  deleteTemplate(id: string): Promise<boolean>;

  // Groups
  getGroups(): Promise<GroupEntity[]>;
  getGroupById(id: string): Promise<GroupEntity | null>;
  saveGroup(groupData: Partial<GroupEntity>, assignedDbIds?: string[]): Promise<GroupEntity>;
  deleteGroup(id: string): Promise<boolean>;

  // Active Alerts
  getActiveAlerts(): Promise<ActiveAlertEntity[]>;
  saveActiveAlert(alertData: Partial<ActiveAlertEntity>): Promise<ActiveAlertEntity>;
  clearActiveAlert(alertId: string, clearedById?: string | null, clearedByName?: string): Promise<boolean>;

  // Alert History
  getAlertHistory(): Promise<AlertHistoryEntity[]>;
  addAlertHistory(historyData: Partial<AlertHistoryEntity>): Promise<AlertHistoryEntity>;

  // Metric History & Raw Telemetry Measurements
  getMetricHistory(dbId?: string, metricId?: string): Promise<MetricHistoryEntity[]>;
  addMetricHistory(historyData: Partial<MetricHistoryEntity>): Promise<MetricHistoryEntity>;
  getRawMeasurements(limit?: number): Promise<RawMeasurementEntity[]>;
  addRawMeasurement(data: Partial<RawMeasurementEntity>): Promise<RawMeasurementEntity>;
  getAlertNotificationLogs(): Promise<AlertNotificationLogEntity[]>;

  // System Settings
  getSystemSettings(): Promise<SystemSettingsEntity>;
  saveSystemSettings(settings: Partial<SystemSettingsEntity>): Promise<SystemSettingsEntity>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<AuditLogEntity[]>;
  addAuditLog(logData: Partial<AuditLogEntity>): Promise<AuditLogEntity>;
}
