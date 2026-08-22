import { PrismaClient, Role, DbType, ValueType, AlertLevel } from '@prisma/client';
import { IStorageRepository } from './types';
import { encryptPassword, decryptPassword } from '../utils/crypto';
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

export class PrismaRepository implements IStorageRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  getStorageType(): 'prisma' | 'memory' {
    return 'prisma';
  }

  // --- Users ---
  async getUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany();
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role as any,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const u = await this.prisma.user.findUnique({ where: { username } });
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      role: u.role as any,
      createdAt: u.createdAt.toISOString(),
    };
  }

  // --- Databases ---
  async getDatabases(): Promise<DatabaseEntity[]> {
    const dbs = await this.prisma.database.findMany({
      include: {
        groups: true,
        metrics: true,
      },
    });

    return dbs.map((d) => ({
      id: d.id,
      name: d.name,
      dbType: d.dbType as any,
      host: d.host,
      port: d.port,
      username: d.username || '',
      password: decryptPassword(d.passwordEncrypted) || '',
      connectionConfig: (d.connectionConfig as any) || {},
      status: (d.status as any) || 'UP',
      lastCheckAt: d.lastCheckAt ? d.lastCheckAt.toISOString() : undefined,
      isEnabled: d.isEnabled,
      groupIds: d.groups.map((g) => g.groupId),
      metricIds: d.metrics.map((m) => m.metricId),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async getDatabaseById(id: string): Promise<DatabaseEntity | null> {
    const d = await this.prisma.database.findUnique({
      where: { id },
      include: { groups: true, metrics: true },
    });
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      dbType: d.dbType as any,
      host: d.host,
      port: d.port,
      username: d.username || '',
      password: decryptPassword(d.passwordEncrypted) || '',
      connectionConfig: (d.connectionConfig as any) || {},
      status: (d.status as any) || 'UP',
      lastCheckAt: d.lastCheckAt ? d.lastCheckAt.toISOString() : undefined,
      isEnabled: d.isEnabled,
      groupIds: d.groups.map((g) => g.groupId),
      metricIds: d.metrics.map((m) => m.metricId),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async saveDatabase(dbData: Partial<DatabaseEntity>): Promise<DatabaseEntity> {
    const id = dbData.id;
    const dbType = (dbData.dbType || 'POSTGRES') as DbType;

    const encryptedPassword = encryptPassword(dbData.password);

    let dbRecord;
    if (id) {
      dbRecord = await this.prisma.database.upsert({
        where: { id },
        update: {
          name: dbData.name,
          dbType,
          host: dbData.host,
          port: dbData.port,
          username: dbData.username,
          passwordEncrypted: encryptedPassword,
          connectionConfig: (dbData.connectionConfig as any) || {},
          status: dbData.status || 'UP',
          lastCheckAt: dbData.lastCheckAt ? new Date(dbData.lastCheckAt) : undefined,
          isEnabled: dbData.isEnabled !== false,
        },
        create: {
          id,
          name: dbData.name || 'NEW_DB',
          dbType,
          host: dbData.host || '127.0.0.1',
          port: dbData.port || 5432,
          username: dbData.username || 'dbmon_reader',
          passwordEncrypted: encryptedPassword || '',
          connectionConfig: (dbData.connectionConfig as any) || {},
          status: dbData.status || 'UP',
          lastCheckAt: dbData.lastCheckAt ? new Date(dbData.lastCheckAt) : new Date(),
          isEnabled: dbData.isEnabled !== false,
        },
        include: { groups: true, metrics: true },
      });
    } else {
      dbRecord = await this.prisma.database.create({
        data: {
          name: dbData.name || 'NEW_DB',
          dbType,
          host: dbData.host || '127.0.0.1',
          port: dbData.port || 5432,
          username: dbData.username || 'dbmon_reader',
          passwordEncrypted: encryptedPassword || '',
          connectionConfig: (dbData.connectionConfig as any) || {},
          status: dbData.status || 'UP',
          lastCheckAt: dbData.lastCheckAt ? new Date(dbData.lastCheckAt) : new Date(),
          isEnabled: dbData.isEnabled !== false,
        },
        include: { groups: true, metrics: true },
      });
    }

    // Sync group mappings if provided
    if (dbData.groupIds !== undefined) {
      await (this.prisma as any).databaseGroupMapping.deleteMany({ where: { databaseId: dbRecord.id } });
      if (dbData.groupIds.length > 0) {
        await (this.prisma as any).databaseGroupMapping.createMany({
          data: dbData.groupIds.map((gid) => ({ databaseId: dbRecord.id, groupId: gid })),
          skipDuplicates: true,
        });
      }
    }

    // Sync metric mappings if provided
    if (dbData.metricIds !== undefined) {
      await (this.prisma as any).databaseMetricMapping.deleteMany({ where: { databaseId: dbRecord.id } });
      if (dbData.metricIds.length > 0) {
        await (this.prisma as any).databaseMetricMapping.createMany({
          data: dbData.metricIds.map((mid) => ({ databaseId: dbRecord.id, metricId: mid })),
          skipDuplicates: true,
        });
      }
    }

    const reloaded = await this.getDatabaseById(dbRecord.id);
    return reloaded!;
  }

  async deleteDatabase(id: string): Promise<boolean> {
    await this.prisma.database.delete({ where: { id } });
    return true;
  }

  // --- Metrics ---
  // --- Metrics ---
  async getMetrics(): Promise<MetricEntity[]> {
    const metrics = await this.prisma.metric.findMany({
      include: { templates: true },
    });

    return metrics.map((m) => {
      const templateIds = m.templates.map((t) => t.templateId);
      const firstTpl = m.templates[0];
      const tConfig = m.thresholdsConfig ? (typeof m.thresholdsConfig === 'string' ? JSON.parse(m.thresholdsConfig) : m.thresholdsConfig) : null;
      const globalConf = tConfig?.global || (tConfig?.type === 'GLOBAL' ? tConfig.global : null);
      return {
        id: m.id,
        name: m.name,
        sqlQuery: m.sqlQuery,
        valueType: m.valueType as any,
        relationalOperator: (m as any).relationalOperator || (m as any).relational_operator || '>=',
        thresholdOperator: (m as any).relationalOperator || (m as any).relational_operator || '>=',
        thresholdWarn: globalConf?.warn || null,
        thresholdHigh: globalConf?.high || null,
        thresholdCritical: globalConf?.critical || null,
        frequencyMinutes: m.frequencyMinutes,
        templateId: firstTpl ? firstTpl.templateId : undefined,
        templateName: firstTpl ? firstTpl.templateName : undefined,
        templateIds,
        isEnabled: m.isEnabled,
        metricQueryType: ((m as any).metricQueryType ?? 1) as 1 | 2 | 3,
        thresholdsConfig: tConfig,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      };
    });
  }

  async getMetricById(id: string): Promise<MetricEntity | null> {
    const m = await this.prisma.metric.findUnique({
      where: { id },
      include: { templates: true },
    });
    if (!m) return null;
    const templateIds = m.templates.map((t) => t.templateId);
    const firstTpl = m.templates[0];
    const tConfig = m.thresholdsConfig ? (typeof m.thresholdsConfig === 'string' ? JSON.parse(m.thresholdsConfig) : m.thresholdsConfig) : null;
    const globalConf = tConfig?.global || (tConfig?.type === 'GLOBAL' ? tConfig.global : null);
    return {
      id: m.id,
      name: m.name,
      sqlQuery: m.sqlQuery,
      valueType: m.valueType as any,
      relationalOperator: (m as any).relationalOperator || (m as any).relational_operator || '>=',
      thresholdOperator: (m as any).relationalOperator || (m as any).relational_operator || '>=',
      thresholdWarn: globalConf?.warn || null,
      thresholdHigh: globalConf?.high || null,
      thresholdCritical: globalConf?.critical || null,
      frequencyMinutes: m.frequencyMinutes,
      templateId: firstTpl ? firstTpl.templateId : undefined,
      templateName: firstTpl ? firstTpl.templateName : undefined,
      templateIds,
      isEnabled: m.isEnabled,
      metricQueryType: ((m as any).metricQueryType ?? 1) as 1 | 2 | 3,
      thresholdsConfig: tConfig,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  async saveMetric(metricData: Partial<MetricEntity>): Promise<MetricEntity> {
    const id = metricData.id;
    const valueType = (metricData.valueType || 'NUMBER') as ValueType;
    const relationalOperator = metricData.relationalOperator || metricData.thresholdOperator || '>=';

    const metricQueryType = metricData.metricQueryType ?? 1;
    let thresholdsConfig = metricData.thresholdsConfig ? (typeof metricData.thresholdsConfig === 'string' ? JSON.parse(metricData.thresholdsConfig) : metricData.thresholdsConfig) : null;

    if (!thresholdsConfig) {
      thresholdsConfig = {
        type: 'GLOBAL',
        global: {
          warn: metricData.thresholdWarn || undefined,
          high: metricData.thresholdHigh || undefined,
          critical: metricData.thresholdCritical || undefined,
        }
      };
    }

    let mRecord;
    if (id) {
      mRecord = await this.prisma.metric.upsert({
        where: { id },
        update: {
          name: metricData.name,
          sqlQuery: metricData.sqlQuery,
          valueType,
          relationalOperator,
          frequencyMinutes: metricData.frequencyMinutes,
          isEnabled: metricData.isEnabled !== false,
          metricQueryType,
          thresholdsConfig: thresholdsConfig as any,
        },
        create: {
          id,
          name: metricData.name || 'New Metric',
          sqlQuery: metricData.sqlQuery || 'SELECT 1',
          valueType,
          relationalOperator,
          frequencyMinutes: metricData.frequencyMinutes || 5,
          isEnabled: metricData.isEnabled !== false,
          metricQueryType,
          thresholdsConfig: thresholdsConfig as any,
        },
      });
    } else {
      mRecord = await this.prisma.metric.create({
        data: {
          name: metricData.name || 'New Metric',
          sqlQuery: metricData.sqlQuery || 'SELECT 1',
          valueType,
          relationalOperator,
          frequencyMinutes: metricData.frequencyMinutes || 5,
          isEnabled: metricData.isEnabled !== false,
          metricQueryType,
          thresholdsConfig: thresholdsConfig as any,
        },
      });
    }

    const targetTemplateIds = metricData.templateIds || (metricData.templateId ? [metricData.templateId] : undefined);
    if (targetTemplateIds !== undefined) {
      await (this.prisma as any).metricTemplateMapping.deleteMany({ where: { metricId: mRecord.id } });
      if (targetTemplateIds.length > 0) {
        const templates = await this.prisma.template.findMany({
          where: { id: { in: targetTemplateIds } },
        });
        await (this.prisma as any).metricTemplateMapping.createMany({
          data: templates.map((tpl) => ({
            metricId: mRecord.id,
            metricName: mRecord.name,
            templateId: tpl.id,
            templateName: tpl.name,
            targetDbType: tpl.targetDbType,
          })),
          skipDuplicates: true,
        });
      }
    }

    const reloaded = await this.getMetricById(mRecord.id);
    return reloaded!;
  }

  async deleteMetric(id: string): Promise<boolean> {
    await this.prisma.metric.delete({ where: { id } });
    return true;
  }

  // --- Templates ---
  async getTemplates(): Promise<TemplateEntity[]> {
    const templates = await this.prisma.template.findMany({
      include: {
        metrics: true,
      },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || null,
      targetDbType: (t.targetDbType as any) || undefined,
      metricIds: t.metrics.map((m) => m.metricId),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  async getTemplateById(id: string): Promise<TemplateEntity | null> {
    const t = await this.prisma.template.findUnique({
      where: { id },
      include: { metrics: true },
    });
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      description: t.description || null,
      targetDbType: (t.targetDbType as any) || undefined,
      metricIds: t.metrics.map((m) => m.metricId),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async saveTemplate(tplData: Partial<TemplateEntity>): Promise<TemplateEntity> {
    const id = tplData.id;
    const targetDbType = tplData.targetDbType ? (tplData.targetDbType as DbType) : null;

    let tRecord;
    if (id) {
      tRecord = await this.prisma.template.upsert({
        where: { id },
        update: {
          name: tplData.name,
          description: tplData.description,
          targetDbType,
        },
        create: {
          id,
          name: tplData.name || 'New Template',
          description: tplData.description || null,
          targetDbType,
        },
      });
    } else {
      tRecord = await this.prisma.template.create({
        data: {
          name: tplData.name || 'New Template',
          description: tplData.description || null,
          targetDbType,
        },
      });
    }

    const reloaded = await this.getTemplateById(tRecord.id);
    return reloaded!;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    await this.prisma.template.delete({ where: { id } });
    return true;
  }

  // --- Groups ---
  async getGroups(): Promise<GroupEntity[]> {
    const groups = await this.prisma.databaseGroup.findMany({
      include: {
        databases: true,
        templates: true,
      },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description || null,
      databaseIds: g.databases.map((d) => d.databaseId),
      templateIds: g.templates.map((t) => t.templateId),
      alertMethodIds: g.alertMethodIds ? g.alertMethodIds.split(',').filter(Boolean) : [],
      senderIds: g.senderIds || '',
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }));
  }

  async getGroupById(id: string): Promise<GroupEntity | null> {
    const g = await this.prisma.databaseGroup.findUnique({
      where: { id },
      include: { databases: true, templates: true },
    });
    if (!g) return null;
    return {
      id: g.id,
      name: g.name,
      description: g.description || null,
      databaseIds: g.databases.map((d) => d.databaseId),
      templateIds: g.templates.map((t) => t.templateId),
      alertMethodIds: g.alertMethodIds ? g.alertMethodIds.split(',').filter(Boolean) : [],
      senderIds: g.senderIds || '',
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    };
  }

  async saveGroup(groupData: Partial<GroupEntity>, assignedDbIds?: string[]): Promise<GroupEntity> {
    const id = groupData.id;
    const alertMethodIdsStr = groupData.alertMethodIds ? groupData.alertMethodIds.join(',') : null;

    let gRecord;
    if (id) {
      gRecord = await this.prisma.databaseGroup.upsert({
        where: { id },
        update: {
          name: groupData.name,
          description: groupData.description,
          alertMethodIds: alertMethodIdsStr,
          senderIds: groupData.senderIds,
        },
        create: {
          id,
          name: groupData.name || 'New Group',
          description: groupData.description || null,
          alertMethodIds: alertMethodIdsStr,
          senderIds: groupData.senderIds || '',
        },
      });
    } else {
      gRecord = await this.prisma.databaseGroup.create({
        data: {
          name: groupData.name || 'New Group',
          description: groupData.description || null,
          alertMethodIds: alertMethodIdsStr,
          senderIds: groupData.senderIds || '',
        },
      });
    }

    const targetDbIds = assignedDbIds || groupData.databaseIds;
    if (targetDbIds !== undefined) {
      await (this.prisma as any).databaseGroupMapping.deleteMany({ where: { groupId: gRecord.id } });
      if (targetDbIds.length > 0) {
        await (this.prisma as any).databaseGroupMapping.createMany({
          data: targetDbIds.map((dbId) => ({ groupId: gRecord.id, databaseId: dbId })),
          skipDuplicates: true,
        });
      }
    }

    const targetTemplateIds = groupData.templateIds;
    if (targetTemplateIds !== undefined) {
      await (this.prisma as any).groupTemplateMapping.deleteMany({ where: { groupId: gRecord.id } });
      if (targetTemplateIds.length > 0) {
        const templates = await this.prisma.template.findMany({
          where: { id: { in: targetTemplateIds } },
        });
        await (this.prisma as any).groupTemplateMapping.createMany({
          data: templates.map((tpl) => ({
            groupId: gRecord.id,
            groupName: gRecord.name,
            templateId: tpl.id,
            templateName: tpl.name,
            targetDbType: tpl.targetDbType,
          })),
          skipDuplicates: true,
        });
      }
    }

    const reloaded = await this.getGroupById(gRecord.id);
    return reloaded!;
  }

  async deleteGroup(id: string): Promise<boolean> {
    await this.prisma.databaseGroup.delete({ where: { id } });
    return true;
  }

  // --- Active Alerts ---
  async getActiveAlerts(): Promise<ActiveAlertEntity[]> {
    const alerts = await this.prisma.activeAlert.findMany({
      include: {
        database: true,
        metric: true,
      },
    });

    return alerts.map((a) => ({
      id: a.id,
      dbId: a.dbId,
      dbName: a.database.name,
      metricId: a.metricId,
      metricName: a.metric.name,
      objectName: a.objectName || 'INSTANCE',
      alertLevel: a.alertLevel as any,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async saveActiveAlert(alertData: Partial<ActiveAlertEntity>): Promise<ActiveAlertEntity> {
    const alertLevel = (alertData.alertLevel || 'WARN') as AlertLevel;

    const alert = await this.prisma.activeAlert.upsert({
      where: {
        dbId_metricId: {
          dbId: alertData.dbId!,
          metricId: alertData.metricId!,
        },
      },
      update: {
        alertLevel,
        message: alertData.message || '',
        objectName: alertData.objectName || 'INSTANCE',
      },
      create: {
        dbId: alertData.dbId!,
        metricId: alertData.metricId!,
        alertLevel,
        message: alertData.message || '',
        objectName: alertData.objectName || 'INSTANCE',
      },
      include: { database: true, metric: true },
    });

    return {
      id: alert.id,
      dbId: alert.dbId,
      dbName: alert.database.name,
      metricId: alert.metricId,
      metricName: alert.metric.name,
      objectName: alert.objectName || 'INSTANCE',
      alertLevel: alert.alertLevel as any,
      message: alert.message,
      createdAt: alert.createdAt.toISOString(),
    };
  }

  async clearActiveAlert(alertId: string, clearedById?: string | null, clearedByName?: string): Promise<boolean> {
    const target = await this.prisma.activeAlert.findUnique({
      where: { id: alertId },
      include: { database: true, metric: true },
    });

    if (!target) return false;

    await this.prisma.activeAlert.delete({ where: { id: alertId } });

    await this.prisma.alertHistory.create({
      data: {
        dbId: target.dbId,
        metricId: target.metricId,
        objectName: target.objectName || 'INSTANCE',
        alertLevel: target.alertLevel,
        message: target.message,
        createdAt: target.createdAt,
        clearedAt: new Date(),
        clearedById: clearedById || null,
      },
    });

    return true;
  }

  // --- Alert History ---
  async getAlertHistory(): Promise<AlertHistoryEntity[]> {
    const history = await this.prisma.alertHistory.findMany({
      include: { database: true, metric: true, clearedBy: true },
      orderBy: { clearedAt: 'desc' },
    });

    return history.map((h) => ({
      id: h.id,
      dbId: h.dbId,
      dbName: h.database.name,
      metricId: h.metricId,
      metricName: h.metric.name,
      objectName: h.objectName || 'INSTANCE',
      alertLevel: h.alertLevel as any,
      message: h.message,
      createdAt: h.createdAt.toISOString(),
      clearedAt: h.clearedAt.toISOString(),
      clearedById: h.clearedById || null,
      clearedByName: h.clearedBy?.username || 'admin',
    }));
  }

  async addAlertHistory(historyData: Partial<AlertHistoryEntity>): Promise<AlertHistoryEntity> {
    const alertLevel = (historyData.alertLevel || 'WARN') as AlertLevel;

    const h = await this.prisma.alertHistory.create({
      data: {
        dbId: historyData.dbId!,
        metricId: historyData.metricId!,
        objectName: historyData.objectName || 'INSTANCE',
        alertLevel,
        message: historyData.message || '',
        createdAt: historyData.createdAt ? new Date(historyData.createdAt) : new Date(),
        clearedAt: historyData.clearedAt ? new Date(historyData.clearedAt) : new Date(),
        clearedById: historyData.clearedById || null,
      },
      include: { database: true, metric: true, clearedBy: true },
    });

    return {
      id: h.id,
      dbId: h.dbId,
      dbName: h.database.name,
      metricId: h.metricId,
      metricName: h.metric.name,
      objectName: h.objectName || 'INSTANCE',
      alertLevel: h.alertLevel as any,
      message: h.message,
      createdAt: h.createdAt.toISOString(),
      clearedAt: h.clearedAt.toISOString(),
      clearedById: h.clearedById || null,
      clearedByName: h.clearedBy?.username || 'admin',
    };
  }

  // --- Metric Value History ---
  async getMetricHistory(dbId?: string, metricId?: string): Promise<MetricHistoryEntity[]> {
    const whereDataPoint: any = {};
    if (dbId) whereDataPoint.databaseId = dbId;
    if (metricId) whereDataPoint.metricId = metricId;

    const list = await (this.prisma as any).metricDataPoint.findMany({
      where: whereDataPoint,
      include: { database: true, metric: true },
      orderBy: { measuredAt: 'desc' },
      take: 200,
    });

    return list.map((m: any) => ({
      id: m.id,
      dbId: m.databaseId,
      dbName: m.database?.name,
      metricId: m.metricId,
      metricName: m.metric?.name,
      objectName: m.objectName || 'INSTANCE',
      attributeName: m.attributeName || 'value',
      value: m.value,
      createdAt: m.measuredAt.toISOString(),
    }));
  }

  async addMetricHistory(historyData: Partial<MetricHistoryEntity>): Promise<MetricHistoryEntity> {
    const entry = await (this.prisma as any).metricDataPoint.create({
      data: {
        databaseId: historyData.dbId!,
        metricId: historyData.metricId!,
        objectName: historyData.objectName || 'GLOBAL',
        attributeName: historyData.attributeName || 'value',
        value: historyData.value || '0',
        measuredAt: historyData.createdAt ? new Date(historyData.createdAt) : new Date(),
      },
      include: { database: true, metric: true },
    });

    return {
      id: entry.id,
      dbId: entry.databaseId,
      dbName: entry.database?.name,
      metricId: entry.metricId,
      metricName: entry.metric?.name,
      objectName: entry.objectName || 'INSTANCE',
      attributeName: entry.attributeName || 'value',
      value: entry.value,
      createdAt: entry.measuredAt.toISOString(),
    };
  }

  // --- System Settings ---
  async getSystemSettings(): Promise<SystemSettingsEntity> {
    let settings = await (this.prisma as any).systemSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await (this.prisma as any).systemSettings.create({
        data: {
          id: 'default',
          apiCollectorEnabled: true,
          collectorEndpoint: 'https://api-collector.dbfarm.internal/v2/ingest',
          collectorApiKey: 'dbf_live_col_9f88a2e1b4c3d4e5f6a7b8c9d0e1f2a3',
          collectorPollIntervalSeconds: 60,
          collectorBatchSize: 250,
          collectorTimeoutMs: 5000,
          collectorRetryPolicy: 'Exponential Backoff (Max 5 retries)',
          globalAlertThresholdMode: 'STANDARD',
          maxRetryAttempts: 3,
          notificationDispatchIntervalSeconds: 30,
          defaultTimezone: 'Asia/Ho_Chi_Minh (UTC+7)',
          dataRetentionDays: 90,
          autoClearResolvedAlerts: true,
          centralDbSyncEnabled: true,
          centralDbConnectionString: 'mysql://dbmon_user:secret_storage_password@127.0.0.1:3306/db_monitoring_system',
          showInfoTips: true,
          updatedBy: 'admin',
        },
      });
    }

    return {
      apiCollectorEnabled: settings.apiCollectorEnabled,
      collectorEndpoint: settings.collectorEndpoint,
      collectorApiKey: settings.collectorApiKey,
      collectorPollIntervalSeconds: settings.collectorPollIntervalSeconds,
      collectorBatchSize: settings.collectorBatchSize,
      collectorTimeoutMs: settings.collectorTimeoutMs,
      collectorRetryPolicy: settings.collectorRetryPolicy,
      globalAlertThresholdMode: settings.globalAlertThresholdMode as any,
      maxRetryAttempts: settings.maxRetryAttempts,
      notificationDispatchIntervalSeconds: settings.notificationDispatchIntervalSeconds,
      defaultTimezone: settings.defaultTimezone,
      dataRetentionDays: settings.dataRetentionDays,
      autoClearResolvedAlerts: settings.autoClearResolvedAlerts,
      centralDbSyncEnabled: settings.centralDbSyncEnabled,
      centralDbConnectionString: settings.centralDbConnectionString,
      showInfoTips: settings.showInfoTips ?? true,
      updatedAt: settings.updatedAt.toISOString(),
      updatedBy: settings.updatedBy || 'admin',
    };
  }

  async saveSystemSettings(settingsData: Partial<SystemSettingsEntity>): Promise<SystemSettingsEntity> {
    const settings = await (this.prisma as any).systemSettings.upsert({
      where: { id: 'default' },
      update: {
        apiCollectorEnabled: settingsData.apiCollectorEnabled,
        collectorEndpoint: settingsData.collectorEndpoint,
        collectorApiKey: settingsData.collectorApiKey,
        collectorPollIntervalSeconds: settingsData.collectorPollIntervalSeconds,
        collectorBatchSize: settingsData.collectorBatchSize,
        collectorTimeoutMs: settingsData.collectorTimeoutMs,
        collectorRetryPolicy: settingsData.collectorRetryPolicy,
        globalAlertThresholdMode: settingsData.globalAlertThresholdMode,
        maxRetryAttempts: settingsData.maxRetryAttempts,
        notificationDispatchIntervalSeconds: settingsData.notificationDispatchIntervalSeconds,
        defaultTimezone: settingsData.defaultTimezone,
        dataRetentionDays: settingsData.dataRetentionDays,
        autoClearResolvedAlerts: settingsData.autoClearResolvedAlerts,
        centralDbSyncEnabled: settingsData.centralDbSyncEnabled,
        centralDbConnectionString: settingsData.centralDbConnectionString,
        showInfoTips: settingsData.showInfoTips ?? true,
        updatedBy: settingsData.updatedBy || 'admin',
      },
      create: {
        id: 'default',
        apiCollectorEnabled: settingsData.apiCollectorEnabled ?? true,
        collectorEndpoint: settingsData.collectorEndpoint || 'https://api-collector.dbfarm.internal/v2/ingest',
        collectorApiKey: settingsData.collectorApiKey || 'dbf_live_col_9f88a2e1b4c3d4e5f6a7b8c9d0e1f2a3',
        collectorPollIntervalSeconds: settingsData.collectorPollIntervalSeconds || 60,
        collectorBatchSize: settingsData.collectorBatchSize || 250,
        collectorTimeoutMs: settingsData.collectorTimeoutMs || 5000,
        collectorRetryPolicy: settingsData.collectorRetryPolicy || 'Exponential Backoff (Max 5 retries)',
        globalAlertThresholdMode: settingsData.globalAlertThresholdMode || 'STANDARD',
        maxRetryAttempts: settingsData.maxRetryAttempts || 3,
        notificationDispatchIntervalSeconds: settingsData.notificationDispatchIntervalSeconds || 30,
        defaultTimezone: settingsData.defaultTimezone || 'Asia/Ho_Chi_Minh (UTC+7)',
        dataRetentionDays: settingsData.dataRetentionDays || 90,
        autoClearResolvedAlerts: settingsData.autoClearResolvedAlerts ?? true,
        centralDbSyncEnabled: settingsData.centralDbSyncEnabled ?? true,
        centralDbConnectionString: settingsData.centralDbConnectionString || 'mysql://dbmon_user:secret_storage_password@127.0.0.1:3306/db_monitoring_system',
        showInfoTips: settingsData.showInfoTips ?? true,
        updatedBy: settingsData.updatedBy || 'admin',
      },
    });

    return {
      apiCollectorEnabled: settings.apiCollectorEnabled,
      collectorEndpoint: settings.collectorEndpoint,
      collectorApiKey: settings.collectorApiKey,
      collectorPollIntervalSeconds: settings.collectorPollIntervalSeconds,
      collectorBatchSize: settings.collectorBatchSize,
      collectorTimeoutMs: settings.collectorTimeoutMs,
      collectorRetryPolicy: settings.collectorRetryPolicy,
      globalAlertThresholdMode: settings.globalAlertThresholdMode as any,
      maxRetryAttempts: settings.maxRetryAttempts,
      notificationDispatchIntervalSeconds: settings.notificationDispatchIntervalSeconds,
      defaultTimezone: settings.defaultTimezone,
      dataRetentionDays: settings.dataRetentionDays,
      autoClearResolvedAlerts: settings.autoClearResolvedAlerts,
      centralDbSyncEnabled: settings.centralDbSyncEnabled,
      centralDbConnectionString: settings.centralDbConnectionString,
      showInfoTips: settings.showInfoTips ?? true,
      updatedAt: settings.updatedAt.toISOString(),
      updatedBy: settings.updatedBy || 'admin',
    };
  }

  // --- Audit Logs ---
  async getAuditLogs(limit = 100): Promise<AuditLogEntity[]> {
    try {
      const logs = await (this.prisma as any).auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return logs.map((l: any) => ({
        id: l.id,
        userId: l.userId,
        clientIp: l.clientIp,
        actionType: l.actionType,
        targetEntity: l.targetEntity,
        targetId: l.targetId,
        details: l.details,
        createdAt: l.createdAt.toISOString(),
      }));
    } catch (err) {
      console.warn('Prisma getAuditLogs error, returning empty list:', err);
      return [];
    }
  }

  async addAuditLog(logData: Partial<AuditLogEntity>): Promise<AuditLogEntity> {
    const record = {
      userId: logData.userId || 'admin',
      clientIp: logData.clientIp || '127.0.0.1',
      actionType: logData.actionType || 'UPDATE',
      targetEntity: logData.targetEntity || 'SYSTEM',
      targetId: logData.targetId || null,
      details: logData.details || null,
    };
    try {
      const created = await (this.prisma as any).auditLog.create({ data: record });
      return {
        id: created.id,
        userId: created.userId,
        clientIp: created.clientIp,
        actionType: created.actionType as any,
        targetEntity: created.targetEntity,
        targetId: created.targetId,
        details: created.details,
        createdAt: created.createdAt.toISOString(),
      };
    } catch (err) {
      console.warn('Prisma addAuditLog fallback to local return:', err);
      return {
        id: `aud-${Date.now()}`,
        ...record,
        actionType: record.actionType as any,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // --- Database Engines ---
  async getDatabaseEngines(): Promise<DatabaseEngineEntity[]> {
    try {
      const engines = await (this.prisma as any).databaseEngine.findMany({
        orderBy: { dbCode: 'asc' },
      });
      if (engines && engines.length > 0) {
        return engines.map((e: any) => ({
          id: e.id,
          dbCode: e.dbCode,
          dbName: e.dbName,
          dbColor: e.dbColor,
          defaultPort: e.defaultPort,
          statusOnOff: e.statusOnOff as any,
          description: e.description,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }));
      }
    } catch (err) {
      console.warn('Prisma getDatabaseEngines query notice:', err);
    }
    // Fallback default seeded engines
    return [
      { id: 'eng-01', dbCode: 'ORACLE', dbName: 'Oracle', dbColor: '#EA580C', defaultPort: 1521, statusOnOff: 'ACTIVE', description: 'Enterprise relational database management system by Oracle.' },
      { id: 'eng-02', dbCode: 'MYSQL', dbName: 'MySQL', dbColor: '#16A34A', defaultPort: 3306, statusOnOff: 'ACTIVE', description: 'Open-source relational database management system powered by Oracle.' },
      { id: 'eng-03', dbCode: 'POSTGRES', dbName: 'PostgreSQL', dbColor: '#2563EB', defaultPort: 5432, statusOnOff: 'ACTIVE', description: 'Powerful object-relational database with strong standard compliance.' },
      { id: 'eng-04', dbCode: 'MSSQL', dbName: 'Microsoft SQL Server', dbColor: '#0F172A', defaultPort: 1433, statusOnOff: 'ACTIVE', description: 'Enterprise relational database management system developed by Microsoft.' },
      { id: 'eng-05', dbCode: 'SINGLESTORE', dbName: 'SingleStore', dbColor: '#9333EA', defaultPort: 3306, statusOnOff: 'ACTIVE', description: 'Real-time distributed SQL database for transactions and analytics.' },
      { id: 'eng-06', dbCode: 'MONGODB', dbName: 'MongoDB', dbColor: '#059669', defaultPort: 27017, statusOnOff: 'ACTIVE', description: 'Document-oriented NoSQL database for modern apps.' },
      { id: 'eng-07', dbCode: 'REDIS', dbName: 'Redis', dbColor: '#D97706', defaultPort: 6379, statusOnOff: 'ACTIVE', description: 'In-memory key-value data structure store.' },
    ];
  }

  async saveDatabaseEngine(engineData: Partial<DatabaseEngineEntity>): Promise<DatabaseEngineEntity> {
    try {
      if (engineData.id) {
        const updated = await (this.prisma as any).databaseEngine.update({
          where: { id: engineData.id },
          data: {
            dbCode: engineData.dbCode ? engineData.dbCode.toUpperCase() : undefined,
            dbName: engineData.dbName,
            dbColor: engineData.dbColor,
            defaultPort: engineData.defaultPort,
            statusOnOff: engineData.statusOnOff,
            description: engineData.description,
          },
        });
        return {
          id: updated.id,
          dbCode: updated.dbCode,
          dbName: updated.dbName,
          dbColor: updated.dbColor,
          defaultPort: updated.defaultPort,
          statusOnOff: updated.statusOnOff as any,
          description: updated.description,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      }
      const created = await (this.prisma as any).databaseEngine.create({
        data: {
          dbCode: (engineData.dbCode || 'CUSTOM').toUpperCase(),
          dbName: engineData.dbName || engineData.dbCode || 'Custom Engine',
          dbColor: engineData.dbColor || '#2563EB',
          defaultPort: engineData.defaultPort || 5432,
          statusOnOff: engineData.statusOnOff || 'ACTIVE',
          description: engineData.description,
        },
      });
      return {
        id: created.id,
        dbCode: created.dbCode,
        dbName: created.dbName,
        dbColor: created.dbColor,
        defaultPort: created.defaultPort,
        statusOnOff: created.statusOnOff as any,
        description: created.description,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    } catch (err) {
      console.warn('Prisma saveDatabaseEngine fallback:', err);
      return {
        id: engineData.id || `eng-${Date.now()}`,
        dbCode: (engineData.dbCode || 'CUSTOM').toUpperCase(),
        dbName: engineData.dbName || 'Custom Engine',
        dbColor: engineData.dbColor || '#2563EB',
        defaultPort: engineData.defaultPort || 5432,
        statusOnOff: engineData.statusOnOff || 'ACTIVE',
        description: engineData.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async deleteDatabaseEngine(id: string): Promise<boolean> {
    try {
      await (this.prisma as any).databaseEngine.delete({ where: { id } });
      return true;
    } catch (err) {
      console.warn('Prisma deleteDatabaseEngine error:', err);
      return true;
    }
  }

  // --- Alert Notification Methods ---
  async getAlertNotificationMethods(): Promise<AlertNotificationMethodEntity[]> {
    try {
      const methods = await (this.prisma as any).alertNotificationMethod.findMany({
        orderBy: { name: 'asc' },
      });
      if (methods && methods.length > 0) {
        return methods.map((m: any) => ({
          id: m.id,
          name: m.name,
          type: m.type as any,
          configJson: m.configJson as any,
          statusOnOff: m.statusOnOff as any,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        }));
      }
    } catch (err) {
      console.warn('Prisma getAlertNotificationMethods error:', err);
    }
    return [
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
        },
        statusOnOff: 'ACTIVE',
      },
    ];
  }

  async saveAlertNotificationMethod(methodData: Partial<AlertNotificationMethodEntity>): Promise<AlertNotificationMethodEntity> {
    try {
      if (methodData.id) {
        const updated = await (this.prisma as any).alertNotificationMethod.update({
          where: { id: methodData.id },
          data: {
            name: methodData.name,
            type: methodData.type,
            configJson: methodData.configJson as any,
            statusOnOff: methodData.statusOnOff,
          },
        });
        return {
          id: updated.id,
          name: updated.name,
          type: updated.type as any,
          configJson: updated.configJson as any,
          statusOnOff: updated.statusOnOff as any,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      }
      const created = await (this.prisma as any).alertNotificationMethod.create({
        data: {
          name: methodData.name || 'New Alert Dispatcher',
          type: methodData.type || 'EMAIL',
          configJson: (methodData.configJson as any) || {},
          statusOnOff: methodData.statusOnOff || 'ACTIVE',
        },
      });
      return {
        id: created.id,
        name: created.name,
        type: created.type as any,
        configJson: created.configJson as any,
        statusOnOff: created.statusOnOff as any,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    } catch (err) {
      console.warn('Prisma saveAlertNotificationMethod fallback:', err);
      return {
        id: methodData.id || `meth-${Date.now()}`,
        name: methodData.name || 'New Alert Dispatcher',
        type: methodData.type || 'EMAIL',
        configJson: methodData.configJson || {},
        statusOnOff: methodData.statusOnOff || 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async deleteAlertNotificationMethod(id: string): Promise<boolean> {
    try {
      await (this.prisma as any).alertNotificationMethod.delete({ where: { id } });
      return true;
    } catch (err) {
      console.warn('Prisma deleteAlertNotificationMethod error:', err);
      return true;
    }
  }

  // --- Raw Measurements / Telemetry ---
  async getRawMeasurements(limit = 100): Promise<RawMeasurementEntity[]> {
    try {
      const client = (this.prisma as any).metricDataPoint;
      if (client) {
        const dataPoints = await client.findMany({
          orderBy: { measuredAt: 'desc' },
          take: limit,
          include: {
            database: true,
            metric: true,
          },
        });

        if (dataPoints && dataPoints.length > 0) {
          return dataPoints.map((dp: any) => {
            let triggeredThreshold: string | null = null;
            let status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'DOWN' = 'NORMAL';
            const valNum = parseFloat(dp.value);

            let warnNum: number | null = null;
            let critNum: number | null = null;
            if (dp.metric?.thresholdsConfig) {
              try {
                const config = typeof dp.metric.thresholdsConfig === 'string' ? JSON.parse(dp.metric.thresholdsConfig) : dp.metric.thresholdsConfig;
                if (config?.type === 'GLOBAL' && config?.global) {
                  warnNum = config.global.warn ? parseFloat(config.global.warn) : null;
                  critNum = config.global.critical ? parseFloat(config.global.critical) : null;
                }
              } catch (e) {
                // ignore
              }
            }

            if (!isNaN(valNum) && warnNum !== null) {
              if (critNum !== null && valNum >= critNum) {
                status = 'CRITICAL';
                triggeredThreshold = `Crit: ${critNum} (>=)`;
              } else if (valNum >= warnNum) {
                status = 'WARNING';
                triggeredThreshold = `Warn: ${warnNum} (>=)`;
              }
            }

            return {
              id: dp.id,
              dbId: dp.databaseId,
              dbName: dp.database?.name || 'Unknown DB',
              dbType: dp.database?.dbType || 'POSTGRES',
              metricId: dp.metricId,
              metricName: dp.metric?.name || 'Metric Probe',
              objectName: dp.objectName || 'INSTANCE',
              attributeName: dp.attributeName || 'value',
              value: dp.value,
              valueType: (dp.metric?.valueType as any) || 'NUMBER',
              thresholdOperator: dp.metric?.thresholdOperator || '>=',
              triggeredThreshold,
              frequencyMinutes: dp.metric?.frequencyMinutes || 5,
              status,
              measuredAt: dp.measuredAt.toISOString(),
            };
          });
        }
      }
    } catch (err) {
      console.warn('Prisma getRawMeasurements fallback to default sample set:', err);
    }

    // Default sample set
    return [
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
        status: 'WARNING',
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
    ];
  }

  async addRawMeasurement(data: Partial<RawMeasurementEntity>): Promise<RawMeasurementEntity> {
    try {
      const client = (this.prisma as any).metricDataPoint;
      if (!client) {
        return {
          id: `meas_${Date.now()}`,
          dbId: data.dbId || 'db-1',
          dbName: data.dbName || 'ORACLE_PROD_01',
          dbType: data.dbType || 'ORACLE',
          metricId: data.metricId || 'met-1',
          metricName: data.metricName || 'Tablespace Usage',
          objectName: data.objectName || 'INSTANCE',
          attributeName: data.attributeName || 'value',
          value: data.value || '0',
          valueType: data.valueType || 'NUMBER',
          frequencyMinutes: data.frequencyMinutes || 5,
          status: data.status || 'NORMAL',
          triggeredThreshold: data.triggeredThreshold || null,
          measuredAt: data.measuredAt || new Date().toISOString(),
        };
      }
      const created = await client.create({
        data: {
          databaseId: data.dbId || '',
          metricId: data.metricId || '',
          objectName: data.objectName || 'INSTANCE',
          attributeName: data.attributeName || 'value',
          value: data.value || '0',
          measuredAt: data.measuredAt ? new Date(data.measuredAt) : new Date(),
        },
        include: {
          database: true,
          metric: true,
        },
      });

      return {
        id: created.id,
        dbId: created.databaseId,
        dbName: created.database?.name || data.dbName || 'Database',
        dbType: created.database?.dbType || data.dbType || 'POSTGRES',
        metricId: created.metricId,
        metricName: created.metric?.name || data.metricName || 'Metric Probe',
        objectName: created.objectName || 'INSTANCE',
        attributeName: created.attributeName || 'value',
        value: created.value,
        valueType: (created.metric?.valueType as any) || 'NUMBER',
        thresholdOperator: created.metric?.thresholdOperator || '>=',
        triggeredThreshold: data.triggeredThreshold || null,
        frequencyMinutes: created.metric?.frequencyMinutes || 5,
        status: data.status || 'NORMAL',
        measuredAt: created.measuredAt.toISOString(),
      };
    } catch (err) {
      console.warn('Prisma addRawMeasurement fallback:', err);
      return {
        id: `raw-${Date.now()}`,
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
        measuredAt: new Date().toISOString(),
      };
    }
  }

  async getAlertNotificationLogs(): Promise<AlertNotificationLogEntity[]> {
    return [
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
        timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
        alertId: 'althist-01',
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
  }

  async resetData(): Promise<void> {
    const p = this.prisma as any;
    try {
      await p.$transaction([
        p.metricDataPoint.deleteMany(),
        p.activeAlert.deleteMany(),
        p.alertHistory.deleteMany(),
        p.alertNotificationLog.deleteMany(),
        p.databaseGroupMapping.deleteMany(),
        p.groupTemplateMapping.deleteMany(),
        p.metricTemplateMapping.deleteMany(),
        p.databaseMetricMapping.deleteMany(),
        p.database.deleteMany(),
        p.databaseGroup.deleteMany(),
        p.metric.deleteMany(),
        p.template.deleteMany(),
      ]);
    } catch (err) {
      console.warn('⚠️ Standard Prisma delete transaction failed, falling back to raw SQL deletion:', err);
      await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
      try {
        await p.$executeRawUnsafe('DELETE FROM `metric_data_points`;');
        await p.$executeRawUnsafe('DELETE FROM `active_alerts`;');
        await p.$executeRawUnsafe('DELETE FROM `alert_history`;');
        await p.$executeRawUnsafe('DELETE FROM `alert_notification_logs`;');
        await p.$executeRawUnsafe('DELETE FROM `database_group_mappings`;');
        await p.$executeRawUnsafe('DELETE FROM `group_template_mappings`;');
        await p.$executeRawUnsafe('DELETE FROM `metric_template_mappings`;');
        await p.$executeRawUnsafe('DELETE FROM `database_metric_mappings`;');
        await p.$executeRawUnsafe('DELETE FROM `databases`;');
        await p.$executeRawUnsafe('DELETE FROM `database_groups`;');
        await p.$executeRawUnsafe('DELETE FROM `metrics`;');
        await p.$executeRawUnsafe('DELETE FROM `templates`;');
      } finally {
        await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
      }
    }
  }
}
