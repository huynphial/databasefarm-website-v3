export type UserRole = 'ADMIN' | 'VIEWER';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt?: string;
  isLocked?: boolean;
  lastLogin?: string;
}

export type DbEngine =
  | 'ORACLE'
  | 'MYSQL'
  | 'POSTGRES'
  | 'MSSQL'
  | 'MARIADB'
  | 'DB2'
  | 'MONGODB'
  | 'REDIS'
  | 'SINGLESTORE'
  | 'CLICKHOUSE'
  | 'ELASTICSEARCH'
  | 'OPENSEARCH'
  | 'CASSANDRA'
  | 'SAPHANA'
  | 'SNOWFLAKE'
  | 'BIGQUERY'
  | 'REDSHIFT'
  | 'DATABRICKS'
  | string;

export interface DbEngineConfig {
  code: string;
  name: string;
  defaultPort: number;
  badgeColor?: string;
  color?: string;
  description?: string;
}

export interface DatabaseEngineEntity {
  id: string;
  dbCode: string;
  dbName: string;
  dbColor: string;
  defaultPort: number;
  statusOnOff: 'ACTIVE' | 'INACTIVE';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AlertMethodType = 'EMAIL' | 'TELEGRAM' | 'WEBHOOK';

export interface AlertNotificationMethodEntity {
  id: string;
  name: string;
  type: AlertMethodType;
  notificationMessage?: string | null; // TOKEN template message (e.g. D_DATABASE_NAME, D_METRIC_NAME)
  configJson: Record<string, any>; // Protocol-specific parameters e.g., SMTP servers, Bot Tokens
  statusOnOff: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export type AuthMethod = 'PASSWORD' | 'AUTH_KEY' | 'TRUST';

export interface DatabaseEntity {
  id: string;
  name: string;
  dbType: DbEngine;
  host: string;
  port: number;
  pollId?: number; // Auto-created poll sequence identifier (default: 0), view-only in UI
  tags?: string[]; // Array of tags e.g., ['PRODUCTION', 'STAGING', 'LAB']
  pollIntervalMinutes?: number; // Query frequency polling interval in minutes (default: 5)
  note?: string; // Operational notes or comments
  authMethod?: AuthMethod; // 'PASSWORD' | 'AUTH_KEY' | 'TRUST'
  username?: string;
  password?: string;
  passwordEncrypted?: string; // AES-256 encrypted database password ciphertext
  authKey?: string;
  databaseName?: string;
  environment?: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  connectionConfig: Record<string, any>;
  groupIds: string[]; // Many-to-Many: A database can belong to multiple groups
  metricIds?: string[]; // Inherited automatically from group templates
  createdAt: string;
  updatedAt: string;
  status?: 'UP' | 'DOWN' | 'WARNING';
  lastCheckAt?: string; // Precise date & time timestamp of the most recent health check
  isEnabled?: boolean; // Active monitoring toggle state for database instance
}

export interface SystemSettingsEntity {
  // API Collector Configuration
  apiCollectorEnabled: boolean;
  collectorEndpoint: string;
  collectorApiKey: string;
  collectorPollIntervalSeconds: number;
  collectorBatchSize: number;
  collectorTimeoutMs: number;
  collectorRetryPolicy: string;
  
  // General Application Settings
  globalAlertThresholdMode: 'STRICT' | 'STANDARD' | 'RELAXED';
  maxRetryAttempts: number;
  notificationDispatchIntervalSeconds: number;
  defaultTimezone: string;
  timestampFormat?: string; // e.g. "HH24:MI:SS DD/MM/YYYY"
  dataRetentionDays: number;
  autoClearResolvedAlerts: boolean;
  centralDbConnectionString?: string;
  sessionTimeoutMinutes?: number;
  SESSION_TIMEOUT_MINUTES?: string | number;

  // Global UI Customization
  showInfoTips?: boolean;

  updatedAt: string;
  updatedBy?: string;
}

export interface SystemSettingItem {
  id: string;
  name: string;
  value: string;
  updatedAt: string;
  updatedBy?: string | null;
}

export type MetricValueType = 'NUMBER' | 'STRING' | 'BOOLEAN';
export type RelationalOperator = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'CONTAINS' | 'DOES_NOT_CONTAIN' | 'DOES_NOT_CONTAINS' | 'REGEX';

export interface AttributeConfig {
  attributeName: string;
  valueType: MetricValueType; // NUMBER, STRING, BOOLEAN
  relationalOperator: RelationalOperator; // >=, <=, =, !=, CONTAINS, DOES_NOT_CONTAIN
  warn?: string;
  high?: string;
  critical?: string;
}

export interface ThresholdTopology {
  type: 'GLOBAL' | 'PER_ATTRIBUTE' | 'OBJECT_OVERRIDE';
  global?: {
    warn?: string;
    high?: string;
    critical?: string;
  };
  perAttribute?: AttributeConfig[];
  objectOverrides?: Array<{
    objectName: string;
    attributeName?: string;
    warn?: string;
    high?: string;
    critical?: string;
  }>;
}

export interface MetricEntity {
  id: string;
  name: string;
  sqlQuery: string;
  valueType: MetricValueType;
  databaseEngineId?: string | null;
  databaseEngine?: DatabaseEngineEntity | null;
  relationalOperator?: RelationalOperator; // Operator selected according to valueType
  thresholdOperator?: RelationalOperator; // Legacy alias for relationalOperator
  thresholdWarn?: string | null;
  thresholdHigh?: string | null;
  thresholdCritical?: string | null;
  cycle: number;
  templateId?: string | null;
  templateName?: string | null;
  templateIds?: string[]; // Multiple templates assigned
  isEnabled: boolean; // Active monitoring toggle state within template
  noAlertRequired?: boolean; // When true, probe collects data only without firing threshold alert notifications
  metricQueryType?: 1 | 2 | 3; // Redesigned query types: Type 1, 2, or 3
  thresholdsConfig?: ThresholdTopology | null; // Reorganized JSON thresholds config
  createdAt: string;
  updatedAt: string;
}

export interface MetricDataPointEntity {
  id: string;
  databaseId: string;
  databaseName?: string;
  metricId: string;
  metricName?: string;
  objectName?: string | null;
  attributeName?: string | null;
  value: string;
  measuredAt: string;
}

export interface RawMeasurementEntity {
  id: string;
  dbId: string;
  dbName: string;
  dbType: string;
  metricId: string;
  metricName: string;
  objectName: string; // Target object identifier (e.g. "TS_DATA", "v$session", "replica_01", "INSTANCE")
  attributeName: string; // Target attribute identifier (e.g. "used_space_pct", "active_count")
  value: string;
  valueType?: MetricValueType;
  thresholdOperator?: string;
  triggeredThreshold?: string | null; // e.g. "Warn: 80 / High: 90 / Crit: 95"
  cycle?: number;
  status: 'NORMAL' | 'WARN' | 'WARNING' | 'HIGH' | 'CRITICAL' | 'FATAL' | 'DOWN' | string;
  measuredAt: string;
}

export interface RawMeasurementFilter {
  limit?: number;
  dbId?: string;
  metricId?: string;
  dbType?: string;
  objectName?: string;
  attributeName?: string;
  fromDate?: string;
  toDate?: string;
  searchTerm?: string;
}

export interface TemplateEntity {
  id: string;
  name: string;
  description?: string | null;
  targetDbType?: DbEngine | 'ALL' | string; // Engine Compatibility: strictly matches specific DB engine
  databaseEngineId?: string | null;
  databaseEngine?: DatabaseEngineEntity | null;
  metricIds?: string[]; // Bound metric IDs in this template
  createdAt: string;
  updatedAt: string;
}

export interface GroupNotificationMappingEntity {
  groupId?: string;
  notificationMethodId: string;
  senderIds?: string | null;
  createdAt?: string;
}

export interface GroupEntity {
  id: string;
  name: string;
  description?: string | null;
  databaseIds: string[]; // Many-to-Many: Databases assigned to this group
  templateIds: string[]; // Monitoring templates applied to this group
  
  // Notification Method Mappings (stored in group_notification_mappings table)
  notificationMappings?: GroupNotificationMappingEntity[];

  // Legacy fallback optional fields
  alertMethodIds?: string[];
  senderIds?: string;

  createdAt: string;
  updatedAt: string;
}

export type AlertSeverity = 'WARN' | 'HIGH' | 'CRITICAL' | 'DOWN';
export type ActiveAlertStatus = 'OPEN' | 'ACKNOWLEDGED';
export type NotificationDispatchStatus = 'NOT_DISPATCHED' | 'DISPATCHED';
export type AlertResolutionStatus = 'CLOSED' | 'CLEARED_BY_USER' | 'AUTO_RESOLVED' | 'RESOLVED_BY_LEVEL_CHANGE';
export type NotificationDeliveryStatus = 'DISPATCHED' | 'FAILED' | 'PENDING';

export interface ActiveAlertEntity {
  id: string;
  dbId: string;
  dbName: string;
  metricId: string;
  metricName: string;
  objectName?: string; // Measured object name e.g. 'TS_DATA', 'payment_ledger', 'replica_01'
  attributeName?: string | null;
  alertLevel: AlertSeverity;
  message: string;
  status?: ActiveAlertStatus; // 'OPEN' | 'ACKNOWLEDGED'
  dispatchStatus?: NotificationDispatchStatus; // 'NOT_DISPATCHED' | 'DISPATCHED'
  acknowledgedAt?: string;
  acknowledgedById?: string | null;
  acknowledgedByName?: string | null;
  createdAt: string;
}

export interface AlertHistoryEntity {
  id: string;
  dbId: string;
  dbName: string;
  metricId: string;
  metricName: string;
  objectName?: string; // Measured object name
  attributeName?: string | null;
  alertLevel: AlertSeverity;
  message: string;
  resolutionStatus?: AlertResolutionStatus; // 'CLOSED' | 'CLEARED_BY_USER' | 'AUTO_RESOLVED'
  dispatchStatus?: NotificationDispatchStatus; // 'NOT_DISPATCHED' | 'DISPATCHED'
  createdAt: string;
  clearedAt: string;
  clearedById?: string | null;
  clearedByName?: string | null;
}

export interface AlertNotificationLogEntity {
  id: string;
  alertId: string;
  alertLevel: AlertSeverity | string;
  dbId: string;
  dbName: string;
  metricId?: string | null;
  metricName: string;
  objectName?: string | null;
  attributeName?: string | null;
  value?: string | null;
  messageAlert?: string | null;
  senderIdList?: string | null;
  dispatcherId?: string | null;
  dispatcherName?: string | null;
  dispatcherType?: AlertMethodType | string | null;
  dispatcherConfig?: any;
  responseSuccess?: boolean;
  responseStatus?: string | null;
  responseDetail?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  finishedAt?: string | null;

  // Legacy/UI fallback getters & optional fields
  timestamp?: string;
  eventType?: string;
  dispatchMethod?: string;
  dispatchType?: string;
  senderIds?: string;
  status?: string;
  errorMessage?: string | null;
  payloadSummary?: string;
  detailResponse?: string | null;
  latencyMs?: number;
}

export interface MetricHistoryEntity {
  id: string; // Composite key: [dbId]_[metricId]_[objectName]_[timestamp]
  dbId: string;
  dbName?: string;
  metricId: string;
  metricName?: string;
  objectName: string; // Target object identifier (e.g. tablespace name, mount point, replica, or instance/total)
  attributeName?: string | null; // Redesigned attribute name for multi-attribute support
  value: string;
  createdAt: string;
}

export interface AuditLogEntity {
  id: string;
  userId: string;
  clientIp: string;
  actionType: 'LOGIN' | 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'PAGE_VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFIG_CHANGE';
  targetEntity: string;
  targetId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface DatabasePollQueueEntity {
  id: string;
  dbId: string;
  dbName: string;
  status: 'pending' | 'processing';
  lockedBy?: string | null;
  lockedAt?: string | null;
  scheduledAt: string;
  createdAt: string;
}

export interface DatabasePollLogEntity {
  id: string;
  dbId: string;
  dbName: string;
  status: 'success' | 'failed';
  errorMessage?: string | null;
  startedAt: string;
  finishedAt: string;
}

export interface AlertNotificationQueueEntity {
  id: string;
  alertId: string;
  alertLevel: AlertSeverity | string;
  dbId: string;
  dbName: string;
  metricId?: string | null;
  metricName: string;
  objectName?: string | null;
  attributeName?: string | null;
  value?: string | null;
  messageAlert?: string | null;
  senderIdList?: string | null;
  dispatcherId?: string | null;
  dispatcherName?: string | null;
  dispatcherType?: AlertMethodType | string | null;
  dispatcherConfig?: any;
  lockedAt?: string | null;
  lockedBy?: string | null;

  // Legacy/UI fallback getters & optional fields
  eventType?: string;
  status?: string;
  scheduledAt?: string;
  createdAt?: string;
}

