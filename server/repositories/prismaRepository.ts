import bcrypt from 'bcryptjs';
import { PrismaClient, Role, DbType, ValueType, AlertLevel } from '@prisma/client';
import { IStorageRepository } from './types';
import { encryptPassword, decryptPassword } from '../utils/crypto';
import { sqlLogger } from '../utils/sqlLogger';
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

export class PrismaRepository implements IStorageRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new (PrismaClient as any)({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'info' },
      ],
    });

    // Attach SQL logger to log all database queries, execution duration, and parameters
    (this.prisma as any).$on('query', (e: any) => {
      sqlLogger.logQuery({
        query: e.query,
        params: e.params,
        duration: e.duration,
        target: e.target,
        timestamp: e.timestamp,
        context: 'Prisma:Query',
      });
    });

    // Log query execution errors
    (this.prisma as any).$on('error', (e: any) => {
      sqlLogger.logError('Prisma Query Execution Error', e.message || e, e.target);
    });

    // Log Prisma warnings
    (this.prisma as any).$on('warn', (e: any) => {
      sqlLogger.logQuery({
        query: `[WARNING] ${e.message || e}`,
        context: 'Prisma:Warn',
      });
    });
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
      isLocked: (u as any).isLocked || false,
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
      isLocked: (u as any).isLocked || false,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async saveUser(userData: Partial<User> & { password?: string }): Promise<User> {
    const isEdit = !!userData.id;
    let u: any;

    const dataPayload: any = {
      username: userData.username,
      role: userData.role as any,
      isLocked: userData.isLocked,
    };

    // Remove undefined properties to avoid overwriting existing properties with undefined/null
    Object.keys(dataPayload).forEach((key) => {
      if (dataPayload[key] === undefined) delete dataPayload[key];
    });

    if (userData.password) {
      dataPayload.passwordHash = await bcrypt.hash(userData.password, 10);
    }

    if (isEdit) {
      u = await this.prisma.user.update({
        where: { id: userData.id },
        data: dataPayload,
      });
    } else {
      if (!userData.username) throw new Error('Username is required.');
      if (!dataPayload.passwordHash) {
        dataPayload.passwordHash = await bcrypt.hash(userData.password || 'TemporaryPassword#2026', 10);
      }
      u = await this.prisma.user.create({
        data: {
          id: userData.id,
          username: userData.username,
          passwordHash: dataPayload.passwordHash,
          role: (userData.role || 'VIEWER') as any,
          isLocked: userData.isLocked || false,
        },
      });
    }

    return {
      id: u.id,
      username: u.username,
      role: u.role as any,
      isLocked: u.isLocked || false,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async deleteUser(id: string): Promise<boolean> {
    const userToDelete = await this.prisma.user.findUnique({ where: { id } });
    if (userToDelete && userToDelete.role === 'ADMIN') {
      const remainingAdmins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', NOT: { id } },
      });
      if (remainingAdmins.length === 0) {
        throw new Error('Action denied: Cannot remove the last administrative user account.');
      }
    }

    await this.prisma.user.delete({ where: { id } });
    return true;
  }

  async verifyUserPassword(username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> {
    const trimmedUsername = (username || '').trim();
    const trimmedPassword = (password || '').trim();

    // Look up user strictly in the database `users` table
    let u = await this.prisma.user.findUnique({ where: { username: trimmedUsername } });
    if (!u) {
      // Case-insensitive fallback if database collation requires it
      u = await this.prisma.user.findFirst({
        where: {
          username: {
            equals: trimmedUsername,
          },
        },
      });
    }

    if (!u) {
      return { success: false, message: 'Invalid username. No matching account found in database.' };
    }
    if ((u as any).isLocked) {
      return { success: false, message: 'This account is locked. Please contact your system administrator.' };
    }

    if (!u.passwordHash) {
      return { success: false, message: 'No password configured in database for this account.' };
    }

    // STRICT: Only the password on the database table `users` is allowed (no hardcoded bypasses)
    let isMatch = false;
    try {
      if (
        u.passwordHash.startsWith('$2') ||
        u.passwordHash.startsWith('$2a$') ||
        u.passwordHash.startsWith('$2b$') ||
        u.passwordHash.startsWith('$2y$')
      ) {
        isMatch = await bcrypt.compare(trimmedPassword, u.passwordHash);
      } else {
        // Direct comparison if password is stored as plain text in the database
        isMatch = u.passwordHash === trimmedPassword;
      }
    } catch (err) {
      console.warn('Database user password verification error:', err);
      isMatch = u.passwordHash === trimmedPassword;
    }

    if (!isMatch) {
      return { success: false, message: 'Invalid password. Credentials verification failed.' };
    }

    return {
      success: true,
      user: {
        id: u.id,
        username: u.username,
        role: u.role as any,
        isLocked: (u as any).isLocked || false,
        createdAt: u.createdAt.toISOString(),
      },
    };
  }

  // --- Databases ---
  async getDatabases(): Promise<DatabaseEntity[]> {
    const dbs = await this.prisma.database.findMany({
      include: {
        groups: true,
        metrics: true,
        databaseEngine: true,
      },
    });

    return dbs.map((d) => ({
      id: d.id,
      name: d.name,
      dbType: (d.dbType as any) || ((d as any).databaseEngine ? (d as any).databaseEngine.dbCode : 'POSTGRES'),
      databaseEngineId: (d as any).databaseEngineId || undefined,
      host: d.host,
      port: d.port,
      pollId: (d as any).pollId ?? 0,
      tags: Array.isArray((d as any).tags) ? ((d as any).tags as string[]) : [],
      pollIntervalMinutes: (d as any).pollIntervalMinutes ?? 5,
      note: (d as any).note || '',
      username: d.username || '',
      password: decryptPassword(d.passwordEncrypted) || '',
      passwordEncrypted: d.passwordEncrypted || '',
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
      include: { groups: true, metrics: true, databaseEngine: true },
    });
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      dbType: (d.dbType as any) || ((d as any).databaseEngine ? (d as any).databaseEngine.dbCode : 'POSTGRES'),
      databaseEngineId: (d as any).databaseEngineId || undefined,
      host: d.host,
      port: d.port,
      pollId: (d as any).pollId ?? 0,
      tags: Array.isArray((d as any).tags) ? ((d as any).tags as string[]) : [],
      pollIntervalMinutes: (d as any).pollIntervalMinutes ?? 5,
      note: (d as any).note || '',
      username: d.username || '',
      password: decryptPassword(d.passwordEncrypted) || '',
      passwordEncrypted: d.passwordEncrypted || '',
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
    const rawType = (dbData.dbType || 'POSTGRES').toUpperCase();
    const validDbTypes = Object.values(DbType) as string[];
    const dbType = (validDbTypes.includes(rawType) ? rawType : 'POSTGRES') as DbType;

    let databaseEngineId: string | null = dbData.databaseEngineId || null;
    if (!databaseEngineId) {
      try {
        const eng = await (this.prisma as any).databaseEngine.findFirst({
          where: { dbCode: { equals: rawType } },
        });
        if (eng) {
          databaseEngineId = eng.id;
        }
      } catch {
        // Non-blocking query safe notice
      }
    }

    const encryptedPassword = encryptPassword(dbData.passwordEncrypted || dbData.password);
    const tagsJson = Array.isArray(dbData.tags) ? dbData.tags : [];
    const pollInterval = dbData.pollIntervalMinutes ? Math.max(1, Number(dbData.pollIntervalMinutes)) : 5;
    const noteText = dbData.note !== undefined ? dbData.note : null;
    const defaultLastCheckAt = new Date('2026-01-01T00:00:00Z');
    let dbRecord;
    if (id) {
      dbRecord = await this.prisma.database.upsert({
        where: { id },
        update: {
          name: dbData.name,
          dbType,
          databaseEngineId: databaseEngineId || undefined,
          host: dbData.host,
          port: dbData.port,
          tags: tagsJson,
          pollIntervalMinutes: pollInterval,
          note: noteText,
          username: dbData.username,
          passwordEncrypted: encryptedPassword,
          connectionConfig: (dbData.connectionConfig as any) || {},
          status: dbData.status || 'UP',
          lastCheckAt: defaultLastCheckAt,
          isEnabled: dbData.isEnabled !== false,
        },
        create: {
          id,
          name: dbData.name || 'NEW_DB',
          dbType,
          databaseEngineId: databaseEngineId || undefined,
          host: dbData.host || '127.0.0.1',
          port: dbData.port || 5432,
          tags: tagsJson,
          pollIntervalMinutes: pollInterval,
          note: noteText,
          username: dbData.username || 'dbmon_reader',
          passwordEncrypted: encryptedPassword || '',
          connectionConfig: (dbData.connectionConfig as any) || {},
          status: dbData.status || 'UP',
          lastCheckAt: defaultLastCheckAt,
          isEnabled: dbData.isEnabled !== false,
        },
        include: { groups: true, metrics: true },
      });
    } else {
      dbRecord = await this.prisma.database.create({
        data: {
          name: dbData.name || 'NEW_DB',
          dbType,
          databaseEngineId: databaseEngineId || undefined,
          host: dbData.host || '127.0.0.1',
          port: dbData.port || 5432,
          tags: tagsJson,
          pollIntervalMinutes: pollInterval,
          note: noteText,
          username: dbData.username || 'dbmon_reader',
          passwordEncrypted: encryptedPassword || '',
          connectionConfig: (dbData.connectionConfig as any) || {},
          status: dbData.status || 'UP',
          lastCheckAt: defaultLastCheckAt,
          isEnabled: dbData.isEnabled !== false,
        },
        include: { groups: true, metrics: true },
      });
    }

    // Sync group mappings if provided
    // if (dbData.groupIds !== undefined) {
    //   await (this.prisma as any).databaseGroupMapping.deleteMany({ where: { databaseId: dbRecord.id } });
    //   if (dbData.groupIds.length > 0) {
    //     await (this.prisma as any).databaseGroupMapping.createMany({
    //       data: dbData.groupIds.map((gid) => ({ databaseId: dbRecord.id, groupId: gid })),
    //       skipDuplicates: true,
    //     });
    //   }
    // }

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
  async getMetrics(): Promise<MetricEntity[]> {
    const metrics = await this.prisma.metric.findMany({
      include: { templates: true, databaseEngine: true },
    });

    return metrics.map((m) => {
      const templateIds = m.templates.map((t) => t.templateId);
      const firstTpl = m.templates[0];
      const tConfig = m.thresholdsConfig ? (typeof m.thresholdsConfig === 'string' ? JSON.parse(m.thresholdsConfig) : m.thresholdsConfig) : null;
      const globalConf = tConfig?.global || (tConfig?.type === 'GLOBAL' ? tConfig.global : null);
      const dbEngine = (m as any).databaseEngine ? {
        id: (m as any).databaseEngine.id,
        dbCode: (m as any).databaseEngine.dbCode,
        dbName: (m as any).databaseEngine.dbName,
        dbColor: (m as any).databaseEngine.dbColor,
        defaultPort: (m as any).databaseEngine.defaultPort,
        statusOnOff: (m as any).databaseEngine.statusOnOff as any,
        description: (m as any).databaseEngine.description || undefined,
        createdAt: (m as any).databaseEngine.createdAt.toISOString(),
        updatedAt: (m as any).databaseEngine.updatedAt.toISOString(),
      } : null;

      return {
        id: m.id,
        name: m.name,
        sqlQuery: m.sqlQuery,
        valueType: m.valueType as any,
        databaseEngineId: (m as any).databaseEngineId || null,
        databaseEngine: dbEngine,
        relationalOperator: (m as any).relationalOperator || (m as any).relational_operator || '>=',
        thresholdOperator: (m as any).relationalOperator || (m as any).relational_operator || '>=',
        thresholdWarn: globalConf?.warn || null,
        thresholdHigh: globalConf?.high || null,
        thresholdCritical: globalConf?.critical || null,
        // cycle: execution frequency per database polling run (1 = query every run, 3 = query every 3rd run)
        cycle: (m as any).cycle ?? (m as any).frequencyMinutes ?? 1,
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
      include: { templates: true, databaseEngine: true },
    });
    if (!m) return null;
    const templateIds = m.templates.map((t) => t.templateId);
    const firstTpl = m.templates[0];
    const tConfig = m.thresholdsConfig ? (typeof m.thresholdsConfig === 'string' ? JSON.parse(m.thresholdsConfig) : m.thresholdsConfig) : null;
    const globalConf = tConfig?.global || (tConfig?.type === 'GLOBAL' ? tConfig.global : null);
    const dbEngine = (m as any).databaseEngine ? {
      id: (m as any).databaseEngine.id,
      dbCode: (m as any).databaseEngine.dbCode,
      dbName: (m as any).databaseEngine.dbName,
      dbColor: (m as any).databaseEngine.dbColor,
      defaultPort: (m as any).databaseEngine.defaultPort,
      statusOnOff: (m as any).databaseEngine.statusOnOff as any,
      description: (m as any).databaseEngine.description || undefined,
      createdAt: (m as any).databaseEngine.createdAt.toISOString(),
      updatedAt: (m as any).databaseEngine.updatedAt.toISOString(),
    } : null;

    return {
      id: m.id,
      name: m.name,
      sqlQuery: m.sqlQuery,
      valueType: m.valueType as any,
      databaseEngineId: (m as any).databaseEngineId || null,
      databaseEngine: dbEngine,
      relationalOperator: (m as any).relationalOperator || (m as any).relational_operator || '>=',
      thresholdOperator: (m as any).relationalOperator || (m as any).relational_operator || '>=',
      thresholdWarn: globalConf?.warn || null,
      thresholdHigh: globalConf?.high || null,
      thresholdCritical: globalConf?.critical || null,
      cycle: (m as any).cycle ?? (m as any).frequencyMinutes ?? 1,
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
          cycle: metricData.cycle ?? 1,
          isEnabled: metricData.isEnabled !== false,
          metricQueryType,
          thresholdsConfig: thresholdsConfig as any,
          databaseEngineId: metricData.databaseEngineId !== undefined ? metricData.databaseEngineId : undefined,
        },
        create: {
          id,
          name: metricData.name || 'New Metric',
          sqlQuery: metricData.sqlQuery || 'SELECT 1',
          valueType,
          relationalOperator,
          cycle: metricData.cycle ?? 1,
          isEnabled: metricData.isEnabled !== false,
          metricQueryType,
          thresholdsConfig: thresholdsConfig as any,
          databaseEngineId: metricData.databaseEngineId !== undefined ? metricData.databaseEngineId : undefined,
        },
      });
    } else {
      mRecord = await this.prisma.metric.create({
        data: {
          name: metricData.name || 'New Metric',
          sqlQuery: metricData.sqlQuery || 'SELECT 1',
          valueType,
          relationalOperator,
          cycle: metricData.cycle ?? 1,
          isEnabled: metricData.isEnabled !== false,
          metricQueryType,
          thresholdsConfig: thresholdsConfig as any,
          databaseEngineId: metricData.databaseEngineId !== undefined ? metricData.databaseEngineId : undefined,
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
        databaseEngine: true,
      },
    });

    return templates.map((t) => {
      const dbEngine = (t as any).databaseEngine ? {
        id: (t as any).databaseEngine.id,
        dbCode: (t as any).databaseEngine.dbCode,
        dbName: (t as any).databaseEngine.dbName,
        dbColor: (t as any).databaseEngine.dbColor,
        defaultPort: (t as any).databaseEngine.defaultPort,
        statusOnOff: (t as any).databaseEngine.statusOnOff as any,
        description: (t as any).databaseEngine.description || undefined,
        createdAt: (t as any).databaseEngine.createdAt.toISOString(),
        updatedAt: (t as any).databaseEngine.updatedAt.toISOString(),
      } : null;

      return {
        id: t.id,
        name: t.name,
        description: t.description || null,
        targetDbType: (t.targetDbType as any) || (dbEngine ? dbEngine.dbCode : undefined),
        databaseEngineId: (t as any).databaseEngineId || null,
        databaseEngine: dbEngine,
        metricIds: t.metrics.map((m) => m.metricId),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });
  }

  async getTemplateById(id: string): Promise<TemplateEntity | null> {
    const t = await this.prisma.template.findUnique({
      where: { id },
      include: { metrics: true, databaseEngine: true },
    });
    if (!t) return null;
    const dbEngine = (t as any).databaseEngine ? {
      id: (t as any).databaseEngine.id,
      dbCode: (t as any).databaseEngine.dbCode,
      dbName: (t as any).databaseEngine.dbName,
      dbColor: (t as any).databaseEngine.dbColor,
      defaultPort: (t as any).databaseEngine.defaultPort,
      statusOnOff: (t as any).databaseEngine.statusOnOff as any,
      description: (t as any).databaseEngine.description || undefined,
      createdAt: (t as any).databaseEngine.createdAt.toISOString(),
      updatedAt: (t as any).databaseEngine.updatedAt.toISOString(),
    } : null;

    return {
      id: t.id,
      name: t.name,
      description: t.description || null,
      targetDbType: (t.targetDbType as any) || (dbEngine ? dbEngine.dbCode : undefined),
      databaseEngineId: (t as any).databaseEngineId || null,
      databaseEngine: dbEngine,
      metricIds: t.metrics.map((m) => m.metricId),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async saveTemplate(tplData: Partial<TemplateEntity>): Promise<TemplateEntity> {
    const id = tplData.id;
    let targetDbType: DbType | null = null;
    if (tplData.targetDbType) {
      const rawTarget = tplData.targetDbType.toUpperCase();
      const validDbTypes = Object.values(DbType) as string[];
      if (validDbTypes.includes(rawTarget)) {
        targetDbType = rawTarget as DbType;
      }
    }
    const databaseEngineId = tplData.databaseEngineId !== undefined ? tplData.databaseEngineId : null;

    let tRecord;
    if (id) {
      tRecord = await this.prisma.template.upsert({
        where: { id },
        update: {
          name: tplData.name,
          description: tplData.description,
          targetDbType,
          databaseEngineId: databaseEngineId || undefined,
        },
        create: {
          id,
          name: tplData.name || 'New Template',
          description: tplData.description || null,
          targetDbType,
          databaseEngineId: databaseEngineId || undefined,
        },
      });
    } else {
      tRecord = await this.prisma.template.create({
        data: {
          name: tplData.name || 'New Template',
          description: tplData.description || null,
          targetDbType,
          databaseEngineId: databaseEngineId || undefined,
        },
      });
    }

    if (tplData.metricIds !== undefined) {
      await (this.prisma as any).metricTemplateMapping.deleteMany({
        where: { templateId: tRecord.id },
      });
      if (tplData.metricIds.length > 0) {
        const metrics = await this.prisma.metric.findMany({
          where: { id: { in: tplData.metricIds } },
        });
        await (this.prisma as any).metricTemplateMapping.createMany({
          data: metrics.map((m) => ({
            metricId: m.id,
            metricName: m.name,
            templateId: tRecord.id,
            templateName: tRecord.name,
            targetDbType: tRecord.targetDbType,
          })),
          skipDuplicates: true,
        });
      }
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
        notificationMappings: true,
      },
    });

    return groups.map((g: any) => {
      const mappings = (g.notificationMappings || []).map((m: any) => ({
        groupId: m.groupId,
        notificationMethodId: m.notificationMethodId,
        senderIds: m.senderIds || '',
      }));
      return {
        id: g.id,
        name: g.name,
        description: g.description || null,
        databaseIds: g.databases.map((d: any) => d.databaseId),
        templateIds: g.templates.map((t: any) => t.templateId),
        notificationMappings: mappings,
        alertMethodIds: mappings.map((m: any) => m.notificationMethodId),
        senderIds: mappings.map((m: any) => m.senderIds).filter(Boolean).join(', '),
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      };
    });
  }

  async getGroupById(id: string): Promise<GroupEntity | null> {
    const g: any = await this.prisma.databaseGroup.findUnique({
      where: { id },
      include: {
        databases: true,
        templates: true,
        notificationMappings: true,
      },
    });
    if (!g) return null;
    const mappings = (g.notificationMappings || []).map((m: any) => ({
      groupId: m.groupId,
      notificationMethodId: m.notificationMethodId,
      senderIds: m.senderIds || '',
    }));
    return {
      id: g.id,
      name: g.name,
      description: g.description || null,
      databaseIds: g.databases.map((d: any) => d.databaseId),
      templateIds: g.templates.map((t: any) => t.templateId),
      notificationMappings: mappings,
      alertMethodIds: mappings.map((m: any) => m.notificationMethodId),
      senderIds: mappings.map((m: any) => m.senderIds).filter(Boolean).join(', '),
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    };
  }

  async saveGroup(groupData: Partial<GroupEntity>, assignedDbIds?: string[]): Promise<GroupEntity> {
    const id = groupData.id;

    let gRecord: any;
    if (id) {
      gRecord = await this.prisma.databaseGroup.upsert({
        where: { id },
        update: {
          name: groupData.name,
          description: groupData.description,
        },
        create: {
          id,
          name: groupData.name || 'New Group',
          description: groupData.description || null,
        },
      });
    } else {
      gRecord = await this.prisma.databaseGroup.create({
        data: {
          name: groupData.name || 'New Group',
          description: groupData.description || null,
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

    let mappingsToSave = groupData.notificationMappings;
    if (mappingsToSave === undefined && groupData.alertMethodIds !== undefined) {
      mappingsToSave = groupData.alertMethodIds.map((methodId) => ({
        notificationMethodId: methodId,
        senderIds: groupData.senderIds || '',
      }));
    }

    if (mappingsToSave !== undefined) {
      try {
        await (this.prisma as any).groupNotificationMapping?.deleteMany({ where: { groupId: gRecord.id } });
        if (mappingsToSave.length > 0) {
          await (this.prisma as any).groupNotificationMapping?.createMany({
            data: mappingsToSave.map((item) => ({
              groupId: gRecord.id,
              notificationMethodId: item.notificationMethodId,
              senderIds: item.senderIds ? item.senderIds.trim() : '',
            })),
            skipDuplicates: true,
          });
        }
      } catch (err) {
        console.warn('Syncing groupNotificationMapping failed:', err);
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
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map((a) => {
      const isAck = a.status === 'ACKNOWLEDGED';
      return {
        id: String(a.id),
        dbId: a.dbId,
        dbName: a.database?.name || a.dbId,
        metricId: a.metricId,
        metricName: a.metric?.name || a.metricId,
        objectName: a.objectName || 'INSTANCE',
        attributeName: a.attributeName || undefined,
        alertLevel: a.alertLevel as any,
        message: a.message,
        status: (isAck ? 'ACKNOWLEDGED' : 'OPEN') as any,
        dispatchStatus: ((a.dispatchStatus as any) || 'NOT_DISPATCHED'),
        value: a.value || undefined,
        threshold: a.threshold || undefined,
        createdAt: a.createdAt.toISOString(),
        acknowledgedAt: isAck ? new Date(a.createdAt).toISOString() : undefined,
        acknowledgedByName: isAck ? 'User' : undefined,
      };
    });
  }

  async saveActiveAlert(alertData: Partial<ActiveAlertEntity>): Promise<ActiveAlertEntity> {
    const alertLevel = (alertData.alertLevel || 'WARN') as AlertLevel;

    const alert = await this.prisma.activeAlert.upsert({
      where: {
        active_alerts_dbId_metricId_key: {
          dbId: alertData.dbId!,
          metricId: alertData.metricId!,
          objectName: alertData.objectName || 'INSTANCE',
          attributeName: alertData.attributeName || 'value',
        },
      },
      update: {
        alertLevel,
        message: alertData.message || '',
        objectName: alertData.objectName || 'INSTANCE',
        attributeName: alertData.attributeName || 'value',
        status: alertData.status || 'OPEN',
      },
      create: {
        dbId: alertData.dbId!,
        metricId: alertData.metricId!,
        alertLevel,
        message: alertData.message || '',
        objectName: alertData.objectName || 'INSTANCE',
        attributeName: alertData.attributeName || 'value',
        status: alertData.status || 'OPEN',
      },
      include: { database: true, metric: true },
    });

    const isAck = alert.status === 'ACKNOWLEDGED';
    return {
      id: String(alert.id),
      dbId: alert.dbId,
      dbName: alert.database?.name || alert.dbId,
      metricId: alert.metricId,
      metricName: alert.metric?.name || alert.metricId,
      objectName: alert.objectName || 'INSTANCE',
      attributeName: alert.attributeName || undefined,
      alertLevel: alert.alertLevel as any,
      message: alert.message,
      status: (isAck ? 'ACKNOWLEDGED' : 'OPEN') as any,
      createdAt: alert.createdAt.toISOString(),
      acknowledgedAt: isAck ? new Date(alert.createdAt).toISOString() : undefined,
      acknowledgedByName: isAck ? 'User' : undefined,
    };
  }

  async acknowledgeActiveAlert(alertId: string, acknowledgedById?: string | null, acknowledgedByName?: string): Promise<boolean> {
    let numId = Number(alertId);
    if (isNaN(numId)) {
      const digits = alertId.replace(/\D/g, '');
      if (digits) {
        numId = parseInt(digits, 10);
      }
    }
    if (isNaN(numId)) return false;

    return await (this.prisma as any).$transaction(async (tx: any) => {
      const target = await tx.activeAlert.findUnique({
        where: { id: numId },
      });
      if (!target) return false;

      await tx.activeAlert.update({
        where: { id: numId },
        data: {
          status: 'ACKNOWLEDGED',
        },
      });

      return true;
    });
  }

  async clearActiveAlert(alertId: string, clearedById?: string | null, clearedByName?: string): Promise<boolean> {
    let numId = Number(alertId);
    if (isNaN(numId)) {
      const digits = alertId.replace(/\D/g, '');
      if (digits) {
        numId = parseInt(digits, 10);
      }
    }
    if (isNaN(numId)) return false;

    return await (this.prisma as any).$transaction(async (tx: any) => {
      let target = await tx.activeAlert.findUnique({
        where: { id: numId },
        include: { database: true, metric: true },
      });

      if (!target) {
        target = await tx.activeAlert.findFirst({
          where: { id: numId },
          include: { database: true, metric: true },
        });
      }

      if (!target) return true;

      await tx.activeAlert.delete({ where: { id: numId } });

      let validUserId: string | null = null;
      if (clearedById) {
        const u = await tx.user.findUnique({ where: { id: clearedById } }).catch(() => null);
        if (u) validUserId = u.id;
      }
      if (!validUserId && clearedByName) {
        const u = await tx.user.findUnique({ where: { username: clearedByName } }).catch(() => null);
        if (u) validUserId = u.id;
      }

      await tx.alertHistory.create({
        data: {
          dbId: target.dbId,
          metricId: target.metricId,
          objectName: target.objectName,
          attributeName: target.attributeName || 'value',
          alertLevel: target.alertLevel,
          resolutionStatus: 'CLEARED_BY_USER',
          dispatchStatus: target.dispatchStatus || null,
          message: target.message,
          value: target.value,
          threshold: target.threshold,
          createdAt: target.createdAt,
          clearedAt: new Date(),
          clearedById: validUserId,
        },
      });

      return true;
    });
  }

  // --- Alert History ---
  async getAlertHistory(): Promise<AlertHistoryEntity[]> {
    const history = await this.prisma.alertHistory.findMany({
      include: { database: true, metric: true, clearedBy: true },
      orderBy: { clearedAt: 'desc' },
    });

    return history.map((h) => ({
      id: String(h.id),
      dbId: h.dbId,
      dbName: h.database?.name || h.dbId,
      metricId: h.metricId,
      metricName: h.metric?.name || h.metricId,
      objectName: h.objectName,
      attributeName: h.attributeName || undefined,
      resolutionStatus: h.resolutionStatus,
      dispatchStatus: (h.dispatchStatus as any) || undefined,
      alertLevel: h.alertLevel as any,
      message: h.message,
      createdAt: h.createdAt.toISOString(),
      clearedAt: h.clearedAt.toISOString(),
      clearedById: h.clearedById || null,
      clearedByName: h.clearedBy?.username || (h.resolutionStatus === 'CLEARED_BY_USER' ? 'User' : 'System Auto-Clear'),
    }));
  }

  async addAlertHistory(historyData: Partial<AlertHistoryEntity>): Promise<AlertHistoryEntity> {
    const alertLevel = (historyData.alertLevel || 'WARN') as AlertLevel;

    let validUserId: string | null = null;
    if (historyData.clearedById) {
      const u = await this.prisma.user.findUnique({ where: { id: historyData.clearedById } }).catch(() => null);
      if (u) validUserId = u.id;
    }
    if (!validUserId && historyData.clearedByName) {
      const u = await this.prisma.user.findUnique({ where: { username: historyData.clearedByName } }).catch(() => null);
      if (u) validUserId = u.id;
    }

    const h = await this.prisma.alertHistory.create({
      data: {
        dbId: historyData.dbId!,
        metricId: historyData.metricId!,
        objectName: historyData.objectName,
        attributeName: historyData.attributeName || 'value',
        alertLevel,
        resolutionStatus: historyData.resolutionStatus || 'CLEARED_BY_USER',
        dispatchStatus: (historyData.dispatchStatus as any) || null,
        message: historyData.message || '',
        createdAt: historyData.createdAt ? new Date(historyData.createdAt) : new Date(),
        clearedAt: historyData.clearedAt ? new Date(historyData.clearedAt) : new Date(),
        clearedById: validUserId,
      },
      include: { database: true, metric: true, clearedBy: true },
    });

    return {
      id: String(h.id),
      dbId: h.dbId,
      dbName: h.database?.name || h.dbId,
      metricId: h.metricId,
      metricName: h.metric?.name || h.metricId,
      objectName: h.objectName,
      attributeName: h.attributeName || undefined,
      resolutionStatus: h.resolutionStatus,
      dispatchStatus: (h.dispatchStatus as any) || undefined,
      alertLevel: h.alertLevel as any,
      message: h.message,
      createdAt: h.createdAt.toISOString(),
      clearedAt: h.clearedAt.toISOString(),
      clearedById: h.clearedById || null,
      clearedByName: h.clearedBy?.username || (h.resolutionStatus === 'CLEARED_BY_USER' ? 'User' : 'System Auto-Clear'),
    };
  }

  // --- Metric Value History ---
  async getMetricHistory(dbId?: string, metricId?: string, fromDate?: string, toDate?: string): Promise<MetricHistoryEntity[]> {
    const whereDataPoint: any = {};
    if (dbId && dbId !== 'ALL') whereDataPoint.dbId = dbId;
    if (metricId && metricId !== 'ALL') whereDataPoint.metricId = metricId;

    if (fromDate || toDate) {
      whereDataPoint.measuredAt = {};
      if (fromDate) {
        whereDataPoint.measuredAt.gte = new Date(fromDate);
      }
      if (toDate) {
        const toDateObj = toDate.length === 10 ? new Date(`${toDate}T23:59:59.999Z`) : new Date(toDate);
        whereDataPoint.measuredAt.lte = toDateObj;
      }
    }

    try {
      const list = await (this.prisma as any).metricDataPoint.findMany({
        where: whereDataPoint,
        include: { database: true, metric: true },
        orderBy: { measuredAt: 'desc' },
        take: 5000,
      });

      return list.map((m: any) => ({
        id: String(m.id),
        dbId: m.dbId || m.databaseId || '',
        dbName: m.database?.name || m.dbName || '',
        metricId: m.metricId || '',
        metricName: m.metric?.name || m.metricName || '',
        objectName: m.objectName || 'INSTANCE',
        attributeName: m.attributeName || 'value',
        value: m.value != null ? String(m.value) : '0',
        createdAt: (m.measuredAt instanceof Date ? m.measuredAt : new Date(m.measuredAt || Date.now())).toISOString(),
      }));
    } catch (prismaErr) {
      // Fallback 1: Query without include and map names in memory
      try {
        const [dbs, metrics, rawList] = await Promise.all([
          (this.prisma as any).database.findMany({ select: { id: true, name: true } }).catch(() => []),
          (this.prisma as any).metric.findMany({ select: { id: true, name: true } }).catch(() => []),
          (this.prisma as any).metricDataPoint.findMany({
            where: whereDataPoint,
            orderBy: { measuredAt: 'desc' },
            take: 5000,
          }),
        ]);

        const dbMap = new Map<string, string>(dbs.map((d: any) => [d.id, d.name]));
        const metricMap = new Map<string, string>(metrics.map((m: any) => [m.id, m.name]));

        return rawList.map((m: any) => {
          const dId = m.dbId || m.databaseId || '';
          const mId = m.metricId || '';
          return {
            id: String(m.id),
            dbId: dId,
            dbName: dbMap.get(dId) || '',
            metricId: mId,
            metricName: metricMap.get(mId) || '',
            objectName: m.objectName || 'INSTANCE',
            attributeName: m.attributeName || 'value',
            value: m.value != null ? String(m.value) : '0',
            createdAt: (m.measuredAt instanceof Date ? m.measuredAt : new Date(m.measuredAt || Date.now())).toISOString(),
          };
        });
      } catch (rawErr) {
        // Fallback 2: Raw SQL with LEFT JOIN
        try {
          const conditions: string[] = [];
          if (dbId && dbId !== 'ALL') conditions.push(`mdp.database_id = '${dbId.replace(/'/g, "''")}'`);
          if (metricId && metricId !== 'ALL') conditions.push(`mdp.metric_id = '${metricId.replace(/'/g, "''")}'`);
          if (fromDate) conditions.push(`mdp.measured_at >= '${new Date(fromDate).toISOString().slice(0, 19).replace('T', ' ')}'`);
          if (toDate) {
            const toDateObj = toDate.length === 10 ? new Date(`${toDate}T23:59:59.999Z`) : new Date(toDate);
            conditions.push(`mdp.measured_at <= '${toDateObj.toISOString().slice(0, 19).replace('T', ' ')}'`);
          }
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
          const sql = `
            SELECT mdp.id, mdp.database_id, mdp.metric_id, mdp.object_name, mdp.attribute_name, mdp.value, mdp.measured_at,
                   d.name as db_name, m.name as metric_name
            FROM metric_data_points mdp
            LEFT JOIN databases d ON mdp.database_id = d.id
            LEFT JOIN metrics m ON mdp.metric_id = m.id
            ${whereClause}
            ORDER BY mdp.measured_at DESC
            LIMIT 5000
          `;
          const sqlRes: any[] = await (this.prisma as any).$queryRawUnsafe(sql);
          return (sqlRes || []).map((r: any) => ({
            id: String(r.id),
            dbId: r.database_id || r.dbId || '',
            dbName: r.db_name || r.dbName || '',
            metricId: r.metric_id || r.metricId || '',
            metricName: r.metric_name || r.metricName || '',
            objectName: r.object_name || r.objectName || 'INSTANCE',
            attributeName: r.attribute_name || r.attributeName || 'value',
            value: r.value != null ? String(r.value) : '0',
            createdAt: (r.measured_at instanceof Date ? r.measured_at : new Date(r.measured_at || Date.now())).toISOString(),
          }));
        } catch (finalErr) {
          console.error('getMetricHistory error:', finalErr);
          return [];
        }
      }
    }
  }

  async addMetricHistory(historyData: Partial<MetricHistoryEntity>): Promise<MetricHistoryEntity> {
    const entry = await (this.prisma as any).metricDataPoint.create({
      data: {
        dbId: historyData.dbId!,
        metricId: historyData.metricId!,
        objectName: historyData.objectName,
        attributeName: historyData.attributeName || 'value',
        value: historyData.value || '0',
        measuredAt: historyData.createdAt ? new Date(historyData.createdAt) : new Date(),
      },
      include: { database: true, metric: true },
    });

    return {
      id: String(entry.id),
      dbId: entry.dbId || entry.databaseId,
      dbName: entry.database?.name || '',
      metricId: entry.metricId,
      metricName: entry.metric?.name || '',
      objectName: entry.objectName || 'INSTANCE',
      attributeName: entry.attributeName || 'value',
      value: entry.value,
      createdAt: (entry.measuredAt instanceof Date ? entry.measuredAt : new Date(entry.measuredAt || Date.now())).toISOString(),
    };
  }

  // --- System Settings ---
  async getSystemSettings(): Promise<SystemSettingsEntity> {
    try {
      const rows = await (this.prisma as any).systemSettings.findMany();
      if (rows && rows.length > 0) {
        const map: Record<string, string> = {};
        let latestDate = new Date(0);
        let latestBy = 'admin';

        for (const row of rows) {
          if (row.name) {
            map[row.name] = row.value ?? '';
          }
          if (row.updatedAt && new Date(row.updatedAt) > latestDate) {
            latestDate = new Date(row.updatedAt);
            if (row.updatedBy) latestBy = row.updatedBy;
          }
        }

        const sessionTimeoutMinutes = parseInt(map['SESSION_TIMEOUT_MINUTES'] || map['sessionTimeoutMinutes'] || '2880', 10) || 2880;

        return {
          apiCollectorEnabled: map['apiCollectorEnabled'] !== 'false',
          collectorEndpoint: map['collectorEndpoint'] || 'http://localhost:3000/api/collector/mock-health',
          collectorApiKey: map['collectorApiKey'] || 'dbf_live_col_9f88a2e1b4c3d4e5f6a7b8c9d0e1f2a3',
          collectorPollIntervalSeconds: parseInt(map['collectorPollIntervalSeconds'] || '60', 10) || 60,
          collectorBatchSize: parseInt(map['collectorBatchSize'] || '250', 10) || 250,
          collectorTimeoutMs: parseInt(map['collectorTimeoutMs'] || '5000', 10) || 5000,
          collectorRetryPolicy: map['collectorRetryPolicy'] || 'Exponential Backoff (Max 5 retries)',
          globalAlertThresholdMode: (map['globalAlertThresholdMode'] as any) || 'STANDARD',
          maxRetryAttempts: parseInt(map['maxRetryAttempts'] || '3', 10) || 3,
          notificationDispatchIntervalSeconds: parseInt(map['notificationDispatchIntervalSeconds'] || '2880', 10) || 2880,
          defaultTimezone: map['defaultTimezone'] || 'Asia/Ho_Chi_Minh (UTC+7)',
          dataRetentionDays: parseInt(map['dataRetentionDays'] || '7', 10) || 7,
          autoClearResolvedAlerts: map['autoClearResolvedAlerts'] !== 'false',
          showInfoTips: map['showInfoTips'] === 'true',
          annual_license_key: map['annual_license_key'] || '',
          sessionTimeoutMinutes,
          SESSION_TIMEOUT_MINUTES: String(sessionTimeoutMinutes),
          updatedAt: latestDate.getTime() > 0 ? latestDate.toISOString() : new Date().toISOString(),
          updatedBy: latestBy,
        };
      }
    } catch (e) {
      console.warn('Prisma getSystemSettings failed, returning fallback:', e);
    }

    return {
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
      dataRetentionDays: 7,
      autoClearResolvedAlerts: true,
      showInfoTips: false,
      annual_license_key: '',
      sessionTimeoutMinutes: 2880,
      SESSION_TIMEOUT_MINUTES: '2880',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
  }

  async saveSystemSettings(settingsData: Partial<SystemSettingsEntity>): Promise<SystemSettingsEntity> {
    const updatedBy = settingsData.updatedBy || 'admin';
    const entriesToSave: Array<{ name: string; value: string }> = [];

    if (settingsData.autoClearResolvedAlerts !== undefined) entriesToSave.push({ name: 'autoClearResolvedAlerts', value: String(settingsData.autoClearResolvedAlerts) });
    if (settingsData.showInfoTips !== undefined) entriesToSave.push({ name: 'showInfoTips', value: String(settingsData.showInfoTips) });
    if (settingsData.sessionTimeoutMinutes !== undefined) entriesToSave.push({ name: 'SESSION_TIMEOUT_MINUTES', value: String(settingsData.sessionTimeoutMinutes) });
    if (settingsData.SESSION_TIMEOUT_MINUTES !== undefined) entriesToSave.push({ name: 'SESSION_TIMEOUT_MINUTES', value: String(settingsData.SESSION_TIMEOUT_MINUTES) });
    if (settingsData.annual_license_key !== undefined) entriesToSave.push({ name: 'annual_license_key', value: settingsData.annual_license_key });

    for (const entry of entriesToSave) {
      await (this.prisma as any).systemSettings.upsert({
        where: { name: entry.name },
        update: { value: entry.value, updatedBy },
        create: { name: entry.name, value: entry.value, updatedBy },
      }).catch((err: any) => console.warn(`Error upserting setting ${entry.name}:`, err));
    }

    return this.getSystemSettings();
  }

  async getSystemSettingsList(): Promise<SystemSettingItem[]> {
    const systemSettingsData = [
      { id: 'ss-01', name: 'autoClearResolvedAlerts', value: 'true', updatedBy: 'admin' },
      { id: 'ss-02', name: 'showInfoTips', value: 'false', updatedBy: 'admin' },
      { id: 'ss-03', name: 'SESSION_TIMEOUT_MINUTES', value: '2880', updatedBy: 'admin' },
      { id: 'ss-04', name: 'annual_license_key', value: '', updatedBy: 'admin' },
    ];

    const allowedKeys = ['autoClearResolvedAlerts', 'showInfoTips', 'SESSION_TIMEOUT_MINUTES', 'annual_license_key'];

    try {
      const records = await (this.prisma as any).systemSettings.findMany({
        where: { name: { in: allowedKeys } },
        orderBy: { id: 'asc' },
      });
      if (records && records.length > 0) {
        // Map database records and fill any missing items from systemSettingsData
        const recordMap = new Map(records.map((r: any) => [r.name, r]));
        return systemSettingsData.map((d) => {
          const found = recordMap.get(d.name);
          if (found) {
            return {
              id: (found as any).id || d.id,
              name: (found as any).name,
              value: (found as any).value ?? d.value,
              updatedAt: (found as any).updatedAt ? new Date((found as any).updatedAt).toISOString() : new Date().toISOString(),
              updatedBy: (found as any).updatedBy || d.updatedBy,
            };
          }
          return {
            id: d.id,
            name: d.name,
            value: d.value,
            updatedAt: new Date().toISOString(),
            updatedBy: d.updatedBy,
          };
        });
      }
    } catch (e) {
      console.warn('Prisma getSystemSettingsList failed, returning defaults:', e);
    }

    return systemSettingsData.map((d) => ({
      id: d.id,
      name: d.name,
      value: d.value,
      updatedAt: new Date().toISOString(),
      updatedBy: d.updatedBy,
    }));
  }

  async saveSystemSettingItem(item: Partial<SystemSettingItem>): Promise<SystemSettingItem> {
    const updatedBy = item.updatedBy || 'admin';
    let record: any;
    if (item.id) {
      record = await (this.prisma as any).systemSettings.update({
        where: { id: item.id },
        data: {
          name: item.name,
          value: item.value ?? '',
          updatedBy,
        },
      }).catch(async () => {
        if (item.name) {
          return await (this.prisma as any).systemSettings.upsert({
            where: { name: item.name },
            update: { value: item.value ?? '', updatedBy },
            create: { name: item.name, value: item.value ?? '', updatedBy },
          });
        }
      });
    } else if (item.name) {
      record = await (this.prisma as any).systemSettings.upsert({
        where: { name: item.name },
        update: { value: item.value ?? '', updatedBy },
        create: { name: item.name, value: item.value ?? '', updatedBy },
      });
    }

    if (!record) {
      return {
        id: item.id || `ss-${Date.now()}`,
        name: item.name || 'customSetting',
        value: item.value || '',
        updatedAt: new Date().toISOString(),
        updatedBy,
      };
    }

    return {
      id: record.id,
      name: record.name,
      value: record.value ?? '',
      updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
      updatedBy: record.updatedBy || 'admin',
    };
  }

  async deleteSystemSettingItem(id: string): Promise<boolean> {
    try {
      await (this.prisma as any).systemSettings.delete({ where: { id } });
      return true;
    } catch (e) {
      console.warn('Prisma deleteSystemSettingItem error:', e);
      return true;
    }
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
    // Fallback default seeded engines matching databaseEnginesData
    return [
      { id: 'eng-01', dbCode: 'ORACLE', dbName: 'Oracle', dbColor: '#EA580C', defaultPort: 1521, statusOnOff: 'ACTIVE', description: 'Enterprise relational database management system by Oracle.' },
      { id: 'eng-02', dbCode: 'MYSQL', dbName: 'MySQL', dbColor: '#16A34A', defaultPort: 3306, statusOnOff: 'ACTIVE', description: 'Open-source relational database management system powered by Oracle.' },
      { id: 'eng-03', dbCode: 'POSTGRES', dbName: 'PostgreSQL', dbColor: '#2563EB', defaultPort: 5432, statusOnOff: 'ACTIVE', description: 'Powerful object-relational database with strong standard compliance.' },
      { id: 'eng-04', dbCode: 'MSSQL', dbName: 'Microsoft SQL Server', dbColor: '#0F172A', defaultPort: 1433, statusOnOff: 'ACTIVE', description: 'Enterprise relational database management system developed by Microsoft.' },
      { id: 'eng-05', dbCode: 'MARIADB', dbName: 'MariaDB', dbColor: '#C05621', defaultPort: 3306, statusOnOff: 'ACTIVE', description: 'Community-developed, commercially supported fork of the MySQL relational database.' },
      { id: 'eng-06', dbCode: 'DB2', dbName: 'IBM Db2', dbColor: '#0062FF', defaultPort: 50000, statusOnOff: 'ACTIVE', description: 'Family of data management products developed by IBM for enterprise workloads.' },
      { id: 'eng-07', dbCode: 'MONGODB', dbName: 'MongoDB', dbColor: '#059669', defaultPort: 27017, statusOnOff: 'ACTIVE', description: 'Document-oriented NoSQL database for flexible data modeling and clustering.' },
      { id: 'eng-08', dbCode: 'REDIS', dbName: 'Redis', dbColor: '#DC2626', defaultPort: 6379, statusOnOff: 'ACTIVE', description: 'In-memory data structure store used as a database, cache, message broker, and streaming engine.' },
      { id: 'eng-09', dbCode: 'SINGLESTORE', dbName: 'SingleStore', dbColor: '#9333EA', defaultPort: 3306, statusOnOff: 'ACTIVE', description: 'Cloud-native, real-time distributed SQL database for transactions and analytics.' },
      { id: 'eng-10', dbCode: 'CLICKHOUSE', dbName: 'ClickHouse', dbColor: '#F59E0B', defaultPort: 8123, statusOnOff: 'ACTIVE', description: 'Fast open-source column-oriented database management system for real-time analytical reporting.' },
      { id: 'eng-11', dbCode: 'ELASTICSEARCH', dbName: 'Elasticsearch', dbColor: '#005571', defaultPort: 9200, statusOnOff: 'ACTIVE', description: 'Distributed, JSON-based search and analytics engine designed for horizontal scalability.' },
      { id: 'eng-12', dbCode: 'OPENSEARCH', dbName: 'OpenSearch', dbColor: '#005FB8', defaultPort: 9200, statusOnOff: 'ACTIVE', description: 'Community-driven, open-source search and analytics suite derived from Elasticsearch.' },
      { id: 'eng-13', dbCode: 'CASSANDRA', dbName: 'Cassandra', dbColor: '#1287A5', defaultPort: 9042, statusOnOff: 'ACTIVE', description: 'Highly-scalable, distributed NoSQL database designed to handle large amounts of data across commodity servers.' },
      { id: 'eng-14', dbCode: 'SAPHANA', dbName: 'SAP HANA', dbColor: '#008FD3', defaultPort: 39015, statusOnOff: 'ACTIVE', description: 'High-performance in-memory database and application platform from SAP.' },
      { id: 'eng-15', dbCode: 'SNOWFLAKE', dbName: 'Snowflake', dbColor: '#29B5E8', defaultPort: 443, statusOnOff: 'ACTIVE', description: 'Cloud computing-based data warehousing and analytics service.' },
      { id: 'eng-16', dbCode: 'BIGQUERY', dbName: 'BigQuery', dbColor: '#4285F4', defaultPort: 443, statusOnOff: 'ACTIVE', description: 'Fully-managed, serverless enterprise data warehouse for analytics by Google Cloud.' },
      { id: 'eng-17', dbCode: 'REDSHIFT', dbName: 'Redshift', dbColor: '#8C4FFF', defaultPort: 5439, statusOnOff: 'ACTIVE', description: 'Fast, fully managed, petabyte-scale data warehouse service in the cloud by AWS.' },
      { id: 'eng-18', dbCode: 'DATABRICKS', dbName: 'Databricks', dbColor: '#FF3621', defaultPort: 443, statusOnOff: 'ACTIVE', description: 'Unified analytics and Lakehouse data intelligence platform built on Apache Spark.' },
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
          notificationMessage: m.notificationMessage || null,
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
        notificationMessage: '[ALERT] Database D_DATABASE_NAME (D_DATABASE_TYPE:D_DATABASE_PORT) Metric D_METRIC_NAME triggered alert! Value: D_ALERT_VALUE. Message: D_ALERT_MESSAGE. Created At: D_ALERT_CREATED_AT',
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
        notificationMessage: '🚨 <b>[INCIDENT ALERT]</b> 🚨\nDatabase: <b>D_DATABASE_NAME</b> (ID: D_DATABASE_ID, Engine: D_DATABASE_TYPE:D_DATABASE_PORT)\nMetric: <b>D_METRIC_NAME</b>\nObject: D_OBJECT_NAME | Attr: D_ATTR_NAME\nValue: <code>D_ALERT_VALUE</code>\nDetails: D_ALERT_MESSAGE\nCreated At: D_ALERT_CREATED_AT',
        configJson: {
          botToken: '6829103847:AAH9f_KzL2e-wZ5qM7Nx982Qp',
          apiBaseUrl: 'https://api.telegram.org',
          defaultChatTopic: 'DATABASE_OPERATIONS',
          parseMode: 'HTML',
        },
        statusOnOff: 'ACTIVE',
      },
    ];
  }

  async saveAlertNotificationMethod(methodData: Partial<AlertNotificationMethodEntity>): Promise<AlertNotificationMethodEntity> {
    try {
      if (methodData.id) {
        const record = await (this.prisma as any).alertNotificationMethod.upsert({
          where: { id: methodData.id },
          update: {
            name: methodData.name,
            type: methodData.type,
            notificationMessage: methodData.notificationMessage !== undefined ? methodData.notificationMessage : undefined,
            configJson: methodData.configJson as any,
            statusOnOff: methodData.statusOnOff,
          },
          create: {
            id: methodData.id,
            name: methodData.name || 'New Alert Dispatcher',
            type: methodData.type || 'EMAIL',
            notificationMessage: methodData.notificationMessage || null,
            configJson: (methodData.configJson as any) || {},
            statusOnOff: methodData.statusOnOff || 'ACTIVE',
          },
        });
        return {
          id: record.id,
          name: record.name,
          type: record.type as any,
          notificationMessage: record.notificationMessage || null,
          configJson: record.configJson as any,
          statusOnOff: record.statusOnOff as any,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        };
      }
      const created = await (this.prisma as any).alertNotificationMethod.create({
        data: {
          name: methodData.name || 'New Alert Dispatcher',
          type: methodData.type || 'EMAIL',
          notificationMessage: methodData.notificationMessage || null,
          configJson: (methodData.configJson as any) || {},
          statusOnOff: methodData.statusOnOff || 'ACTIVE',
        },
      });
      return {
        id: created.id,
        name: created.name,
        type: created.type as any,
        notificationMessage: created.notificationMessage || null,
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
        notificationMessage: methodData.notificationMessage || null,
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
  async getRawMeasurements(filterOrLimit?: number | RawMeasurementFilter): Promise<RawMeasurementEntity[]> {
    try {
      const client = (this.prisma as any).metricDataPoint;
      if (client) {
        let limit = 0;
        const where: any = {};

        if (typeof filterOrLimit === 'number') {
          limit = filterOrLimit;
        } else if (filterOrLimit) {
          if (filterOrLimit.limit !== undefined) {
            limit = filterOrLimit.limit;
          }
          if (filterOrLimit.dbId && filterOrLimit.dbId !== 'ALL') {
            where.dbId = filterOrLimit.dbId;
          }
          if (filterOrLimit.metricId && filterOrLimit.metricId !== 'ALL') {
            where.metricId = filterOrLimit.metricId;
          }
          if (filterOrLimit.dbType && filterOrLimit.dbType !== 'ALL') {
            where.database = {
              dbType: filterOrLimit.dbType,
            };
          }
          if (filterOrLimit.objectName && filterOrLimit.objectName !== 'ALL') {
            where.objectName = filterOrLimit.objectName;
          }
          if (filterOrLimit.attributeName && filterOrLimit.attributeName !== 'ALL') {
            where.attributeName = filterOrLimit.attributeName;
          }
          if (filterOrLimit.fromDate || filterOrLimit.toDate) {
            where.measuredAt = {};
            if (filterOrLimit.fromDate) {
              where.measuredAt.gte = new Date(filterOrLimit.fromDate);
            }
            if (filterOrLimit.toDate) {
              const toDateObj = filterOrLimit.toDate.length === 10
                ? new Date(`${filterOrLimit.toDate}T23:59:59.999Z`)
                : new Date(filterOrLimit.toDate);
              where.measuredAt.lte = toDateObj;
            }
          }
        }

        const dataPoints = await client.findMany({
          where,
          orderBy: { measuredAt: 'desc' },
          ...(limit > 0 ? { take: limit } : {}),
          include: {
            database: true,
            metric: true,
          },
        });

        if (dataPoints) {
          let list: RawMeasurementEntity[] = dataPoints.map((dp: any) => {
            let triggeredThreshold: string | null = null;
            let status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'DOWN' = 'NORMAL';
            const valNum = parseFloat(dp.value);

            let warnNum: number | null = null;
            let critNum: number | null = null;
            if (dp.metric?.thresholdsConfig) {
              try {
                const config = typeof dp.metric.thresholdsConfig === 'string' ? JSON.parse(dp.metric.thresholdsConfig) : dp.metric.thresholdsConfig;
                if (config?.type === 'GLOBAL' && config?.global) {
                  warnNum = config.global.warn !== undefined && config.global.warn !== '' ? parseFloat(config.global.warn) : null;
                  critNum = config.global.critical !== undefined && config.global.critical !== '' ? parseFloat(config.global.critical) : null;
                } else if (config?.type === 'PER_ATTRIBUTE' && Array.isArray(config.perAttribute)) {
                  const match = config.perAttribute.find((a: any) => a.attributeName === dp.attributeName);
                  if (match) {
                    warnNum = match.warn !== undefined && match.warn !== '' ? parseFloat(match.warn) : null;
                    critNum = match.critical !== undefined && match.critical !== '' ? parseFloat(match.critical) : null;
                  }
                }
              } catch (e) {
                // ignore
              }
            }

            if (!isNaN(valNum)) {
              if (critNum !== null && !isNaN(critNum) && valNum >= critNum) {
                status = 'CRITICAL';
                triggeredThreshold = `Crit: ${critNum} (>=)`;
              } else if (warnNum !== null && !isNaN(warnNum) && valNum >= warnNum) {
                status = 'WARNING';
                triggeredThreshold = `Warn: ${warnNum} (>=)`;
              }
            }

            return {
              id: dp.id,
              dbId: dp.dbId || dp.databaseId,
              dbName: dp.database?.name || dp.dbId || 'Unknown DB',
              dbType: dp.database?.dbType || 'ORACLE',
              metricId: dp.metricId,
              metricName: dp.metric?.name || dp.metricId || 'Metric Probe',
              objectName: dp.objectName || 'INSTANCE',
              attributeName: dp.attributeName || 'value',
              value: dp.value,
              valueType: (dp.metric?.valueType as any) || 'NUMBER',
              thresholdOperator: dp.metric?.thresholdOperator || '>=',
              triggeredThreshold,
              cycle: (dp.metric as any)?.cycle ?? 1,
              status,
              measuredAt: dp.measuredAt ? new Date(dp.measuredAt).toISOString() : new Date().toISOString(),
            };
          });

          if (typeof filterOrLimit === 'object' && filterOrLimit?.searchTerm?.trim()) {
            const q = filterOrLimit.searchTerm.toLowerCase().trim();
            list = list.filter((m: RawMeasurementEntity) =>
              (m.dbName && m.dbName.toLowerCase().includes(q)) ||
              (m.metricName && m.metricName.toLowerCase().includes(q)) ||
              (m.objectName && m.objectName.toLowerCase().includes(q)) ||
              (m.attributeName && m.attributeName.toLowerCase().includes(q)) ||
              (m.value && m.value.toLowerCase().includes(q)) ||
              (m.dbType && m.dbType.toLowerCase().includes(q))
            );
          }

          return list;
        }
      }
    } catch (err) {
      console.warn('Prisma getRawMeasurements query error:', err);
    }

    return [];
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
          cycle: data.cycle || 1,
          status: data.status || 'NORMAL',
          triggeredThreshold: data.triggeredThreshold || null,
          measuredAt: data.measuredAt || new Date().toISOString(),
        };
      }
      const created = await client.create({
        data: {
          dbId: data.dbId || '',
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
        dbId: created.dbId || created.databaseId,
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
        cycle: (created.metric as any)?.cycle ?? data.cycle ?? 1,
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
        cycle: data.cycle || 1,
        status: data.status || 'NORMAL',
        measuredAt: new Date().toISOString(),
      };
    }
  }

  async getAlertNotificationLogs(): Promise<AlertNotificationLogEntity[]> {
    const safeIso = (val: any): string => {
      if (!val) return new Date().toISOString();
      if (val instanceof Date) {
        return isNaN(val.getTime()) ? new Date().toISOString() : val.toISOString();
      }
      const s = String(val).trim();
      const d1 = new Date(s);
      if (!isNaN(d1.getTime())) return d1.toISOString();
      const d2 = new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z'));
      if (!isNaN(d2.getTime())) return d2.toISOString();
      return s || new Date().toISOString();
    };

    const safeStr = (val: any): string => {
      if (val == null) return '';
      if (typeof val === 'bigint') return val.toString();
      return String(val);
    };

    let records: any[] = [];
    try {
      if ((this.prisma as any).alertNotificationLog) {
        records = await (this.prisma as any).alertNotificationLog.findMany({
          orderBy: { finishedAt: 'desc' },
        });
      }
    } catch (e) {
      console.warn('Prisma alertNotificationLog.findMany error:', e);
    }

    if (!records || records.length === 0) {
      try {
        records = await (this.prisma as any).$queryRawUnsafe(
          'SELECT * FROM alert_notification_logs ORDER BY finished_at DESC LIMIT 500'
        );
      } catch (e1) {
        try {
          records = await (this.prisma as any).$queryRawUnsafe(
            'SELECT * FROM alert_notification_log ORDER BY finished_at DESC LIMIT 500'
          );
        } catch (e2) {}
      }
    }

    if (records && records.length > 0) {
      return records.map((r: any) => {
        const isSuccess =
          r.responseStatus === 'SUCCESS' ||
          r.response_status === 'SUCCESS' ||
          r.response_success === 1 ||
          r.response_success === true ||
          (r.responseSuccess === true && r.responseStatus !== 'FAILED' && r.response_status !== 'FAILED');

        const respStatus = r.responseStatus || r.response_status || (isSuccess ? 'SUCCESS' : 'FAILED');
        const respDetail = r.responseDetail || r.response_detail || null;
        const msgAlert = r.messageAlert || r.message_alert || null;
        const dispType = r.dispatcherType || r.dispatcher_type || 'EMAIL';
        const dispName = r.dispatcherName || r.dispatcher_name || '';
        const senderIds = r.senderIdList || r.sender_id_list || '';
        const finAt = safeIso(r.finishedAt || r.finished_at || r.lockedAt || r.locked_at);
        const lckAt = (r.lockedAt || r.locked_at) ? safeIso(r.lockedAt || r.locked_at) : null;

        // Calculate latency in ms from finished_at - locked_at
        let calculatedLatencyMs: number | undefined = undefined;
        if (lckAt && finAt) {
          const tLck = new Date(lckAt).getTime();
          const tFin = new Date(finAt).getTime();
          if (!isNaN(tLck) && !isNaN(tFin)) {
            calculatedLatencyMs = Math.max(0, tFin - tLck);
          }
        }

        return {
          id: safeStr(r.id),
          alertId: safeStr(r.alertId || r.alert_id || ''),
          alertLevel: r.alertLevel || r.alert_level || 'WARN',
          dbId: safeStr(r.dbId || r.db_id || ''),
          dbName: r.dbName || r.db_name || '',
          metricId: (r.metricId || r.metric_id) ? safeStr(r.metricId || r.metric_id) : null,
          metricName: r.metricName || r.metric_name || '',
          objectName: r.objectName || r.object_name || null,
          attributeName: r.attributeName || r.attribute_name || null,
          value: r.value != null ? safeStr(r.value) : null,
          messageAlert: msgAlert,
          senderIdList: senderIds,
          dispatcherId: (r.dispatcherId || r.dispatcher_id) ? safeStr(r.dispatcherId || r.dispatcher_id) : null,
          dispatcherName: dispName,
          dispatcherType: dispType,
          dispatcherConfig:
            typeof (r.dispatcherConfig || r.dispatcher_config) === 'object'
              ? JSON.stringify(r.dispatcherConfig || r.dispatcher_config)
              : (r.dispatcherConfig || r.dispatcher_config || null),
          responseSuccess: isSuccess,
          responseStatus: respStatus,
          responseDetail: respDetail,
          lockedAt: lckAt,
          lockedBy: r.lockedBy || r.locked_by || null,
          finishedAt: finAt,

          // Compatibility fields for UI table views & filters
          timestamp: finAt,
          eventType: r.eventType || r.event_type || (msgAlert?.startsWith('CLEAR') ? 'CLEAR_ALERT' : 'NEW_ALERT'),
          dispatchMethod: dispName,
          dispatchType: dispType,
          senderIds: senderIds,
          status: isSuccess ? 'DISPATCHED' : 'FAILED',
          payloadSummary: msgAlert || '',
          detailResponse: respDetail || respStatus || null,
          errorMessage: !isSuccess ? (respDetail || respStatus || 'Dispatch failed') : null,
          latencyMs: calculatedLatencyMs ?? (r.latencyMs || r.latency_ms || undefined),
        };
      });
    }

    return [];
  }

  async getAlertNotificationQueue(): Promise<AlertNotificationQueueEntity[]> {
    const safeIso = (val: any): string => {
      if (!val) return new Date().toISOString();
      if (val instanceof Date) {
        return isNaN(val.getTime()) ? new Date().toISOString() : val.toISOString();
      }
      const s = String(val).trim();
      const d1 = new Date(s);
      if (!isNaN(d1.getTime())) return d1.toISOString();
      const d2 = new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z'));
      if (!isNaN(d2.getTime())) return d2.toISOString();
      return s || new Date().toISOString();
    };

    const safeStr = (val: any): string => {
      if (val == null) return '';
      if (typeof val === 'bigint') return val.toString();
      return String(val);
    };

    let records: any[] = [];
    try {
      if ((this.prisma as any).alertNotificationQueue) {
        records = await (this.prisma as any).alertNotificationQueue.findMany({
          orderBy: { id: 'asc' },
        });
      }
    } catch (e) {
      console.warn('Prisma alertNotificationQueue.findMany error:', e);
    }

    if (!records || records.length === 0) {
      try {
        records = await (this.prisma as any).$queryRawUnsafe(
          'SELECT * FROM alert_notification_queue ORDER BY id ASC LIMIT 500'
        );
      } catch (e1) {
        try {
          records = await (this.prisma as any).$queryRawUnsafe(
            'SELECT * FROM alert_notification_queues ORDER BY id ASC LIMIT 500'
          );
        } catch (e2) {}
      }
    }

    if (records && records.length > 0) {
      return records.map((r: any) => {
        const isLocked = !!(r.lockedBy || r.locked_by || r.lockedAt || r.locked_at);
        const dispType = r.dispatcherType || r.dispatcher_type || 'TELEGRAM';
        const dispName = r.dispatcherName || r.dispatcher_name || null;
        const msgAlert = r.messageAlert || r.message_alert || null;
        const lckAt = (r.lockedAt || r.locked_at) ? safeIso(r.lockedAt || r.locked_at) : null;

        return {
          id: safeStr(r.id),
          alertId: safeStr(r.alertId || r.alert_id || ''),
          alertLevel: r.alertLevel || r.alert_level || 'WARN',
          dbId: safeStr(r.dbId || r.db_id || ''),
          dbName: r.dbName || r.db_name || '',
          metricId: (r.metricId || r.metric_id) ? safeStr(r.metricId || r.metric_id) : null,
          metricName: r.metricName || r.metric_name || '',
          objectName: r.objectName || r.object_name || null,
          attributeName: r.attributeName || r.attribute_name || null,
          value: r.value != null ? safeStr(r.value) : null,
          messageAlert: msgAlert,
          senderIdList: r.senderIdList || r.sender_id_list || null,
          dispatcherId: (r.dispatcherId || r.dispatcher_id) ? safeStr(r.dispatcherId || r.dispatcher_id) : null,
          dispatcherName: dispName,
          dispatcherType: dispType,
          dispatcherConfig:
            typeof (r.dispatcherConfig || r.dispatcher_config) === 'object'
              ? JSON.stringify(r.dispatcherConfig || r.dispatcher_config)
              : (r.dispatcherConfig || r.dispatcher_config || null),
          lockedAt: lckAt,
          lockedBy: r.lockedBy || r.locked_by || null,

          // Compatibility fields for UI
          status: isLocked ? 'PROCESSING' : 'PENDING',
          eventType: 'TRIGGER',
          scheduledAt: lckAt || new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
      });
    }

    return [];
  }

  async getDatabasePollQueue(): Promise<DatabasePollQueueEntity[]> {
    try {
      const records = await (this.prisma as any).databasePollQueue?.findMany({
        orderBy: { scheduledAt: 'desc' },
      });
      if (records) {
        return records.map((r: any) => ({
          id: String(r.id),
          dbId: r.dbId || '',
          dbName: r.dbName || '',
          status: r.status || 'pending',
          lockedBy: r.lockedBy || null,
          lockedAt: r.lockedAt ? new Date(r.lockedAt).toISOString() : null,
          scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : new Date().toISOString(),
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        }));
      }
    } catch (e) {
      console.warn('Prisma getDatabasePollQueue failed:', e);
    }

    return [];
  }

  async clearDatabasePollQueue(statusFilter: 'processing' | 'pending' | 'all' = 'processing', dbId?: string): Promise<{ clearedCount: number }> {
    let clearedCount = 0;
    try {
      const where: any = {};
      if (statusFilter === 'processing') {
        where.status = 'processing';
      } else if (statusFilter === 'pending') {
        where.status = 'pending';
      }
      if (dbId && dbId !== 'ALL') {
        where.dbId = dbId;
      }

      try {
        if ((this.prisma as any).databasePollQueue) {
          const res = await (this.prisma as any).databasePollQueue.deleteMany({ where });
          clearedCount = res.count || 0;
        }
      } catch (e1) {
        console.warn('Prisma databasePollQueue.deleteMany error:', e1);
      }

      if (clearedCount === 0) {
        try {
          let sql = 'DELETE FROM database_poll_queue';
          const conds: string[] = [];
          if (statusFilter === 'processing') conds.push("status = 'processing'");
          else if (statusFilter === 'pending') conds.push("status = 'pending'");
          if (dbId && dbId !== 'ALL') conds.push(`db_id = '${dbId.replace(/'/g, "''")}'`);
          if (conds.length > 0) sql += ' WHERE ' + conds.join(' AND ');
          const rawRes = await (this.prisma as any).$executeRawUnsafe(sql);
          clearedCount = typeof rawRes === 'number' ? rawRes : 0;
        } catch (rawErr) {
          console.warn('Raw SQL database_poll_queue deletion error:', rawErr);
        }
      }
    } catch (e) {
      console.warn('clearDatabasePollQueue failed:', e);
    }
    return { clearedCount };
  }

  async getDatabasePollLogs(dbId?: string, fromDate?: string, toDate?: string, limit?: number): Promise<DatabasePollLogEntity[]> {
    try {
      const effectiveLimit = limit !== undefined && limit > 0 ? limit : (dbId && dbId !== 'ALL' ? 5000 : 2000);
      const where: any = {};
      if (dbId && dbId !== 'ALL') {
        where.OR = [
          { dbId: dbId },
          { dbName: dbId },
        ];
      }
      if (fromDate || toDate) {
        where.startedAt = {};
        if (fromDate) where.startedAt.gte = new Date(fromDate);
        if (toDate) where.startedAt.lte = new Date(toDate);
      }

      let records = await (this.prisma as any).databasePollLog?.findMany({
        where,
        orderBy: { finishedAt: 'desc' },
        take: effectiveLimit,
      });

      if (!records || records.length === 0) {
        try {
          let sql = 'SELECT * FROM database_poll_log';
          const conditions: string[] = [];
          if (dbId && dbId !== 'ALL') {
            const escaped = dbId.replace(/'/g, "''");
            conditions.push(`(db_id = '${escaped}' OR db_name = '${escaped}')`);
          }
          if (fromDate) {
            conditions.push(`started_at >= '${new Date(fromDate).toISOString().slice(0, 19).replace('T', ' ')}'`);
          }
          if (toDate) {
            conditions.push(`started_at <= '${new Date(toDate).toISOString().slice(0, 19).replace('T', ' ')}'`);
          }
          if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
          }
          sql += ` ORDER BY finished_at DESC LIMIT ${effectiveLimit}`;
          records = await (this.prisma as any).$queryRawUnsafe(sql);
        } catch (rawErr) {
          // silent fallback
        }
      }

      if (records && records.length > 0) {
        return records.map((r: any) => ({
          id: String(r.id),
          dbId: r.dbId || r.db_id || '',
          dbName: r.dbName || r.db_name || '',
          status: (r.status || 'success').toLowerCase() === 'success' ? 'success' : 'failed',
          errorMessage: r.errorMessage || r.error_message || null,
          startedAt: r.startedAt || r.started_at ? new Date(r.startedAt || r.started_at).toISOString() : new Date().toISOString(),
          finishedAt: r.finishedAt || r.finished_at ? new Date(r.finishedAt || r.finished_at).toISOString() : new Date().toISOString(),
        }));
      }
    } catch (e) {
      console.warn('Prisma getDatabasePollLogs failed:', e);
    }

    return [];
  }

  async cleanAllMonitorData(daysToKeep = 0, dbId = 'ALL') {
    const cutoffDate = daysToKeep <= 0 ? new Date(Date.now() + 60000) : new Date(Date.now() - daysToKeep * 86400000);
    const dbFilter = dbId === 'ALL' ? {} : { dbId };

    let activeCount = 0;
    let histCount = 0;
    let metricsCount = 0;
    let logsCount = 0;

    try {
      const activeRes = await this.prisma.activeAlert.deleteMany({
        where: {
          ...dbFilter,
          createdAt: { lte: cutoffDate },
        },
      });
      activeCount = activeRes.count;
    } catch (e) {
      console.warn('activeAlert deleteMany failed:', e);
    }

    try {
      const histRes = await this.prisma.alertHistory.deleteMany({
        where: {
          ...dbFilter,
          createdAt: { lte: cutoffDate },
        },
      });
      histCount = histRes.count;
    } catch (e) {
      console.warn('alertHistory deleteMany failed:', e);
    }

    try {
      const metricsRes = await (this.prisma as any).metricDataPoint?.deleteMany({
        where: {
          ...(dbId === 'ALL' ? {} : { dbId }),
          measuredAt: { lte: cutoffDate },
        },
      });
      metricsCount = metricsRes?.count || 0;
    } catch (e) {
      console.warn('Prisma metricDataPoint deleteMany failed, falling back to raw SQL:', e);
    }

    if (metricsCount === 0) {
      try {
        const isoCutoff = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');
        const whereClause = dbId === 'ALL'
          ? `WHERE measured_at <= '${isoCutoff}'`
          : `WHERE database_id = '${dbId}' AND measured_at <= '${isoCutoff}'`;
        const rawRes = await (this.prisma as any).$executeRawUnsafe(`DELETE FROM metric_data_points ${whereClause}`);
        metricsCount = typeof rawRes === 'number' ? rawRes : 0;
      } catch (rawErr) {
        console.warn('Raw SQL metric_data_points deletion failed:', rawErr);
      }
    }

    try {
      const logsRes = await (this.prisma as any).alertNotificationLog?.deleteMany({
        where: {
          ...dbFilter,
          finishedAt: { lte: cutoffDate },
        },
      });
      logsCount = logsRes?.count || 0;
    } catch (e) {
      console.warn('Prisma alertNotificationLog deleteMany failed, falling back to raw SQL:', e);
    }

    if (logsCount === 0) {
      try {
        const isoCutoff = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');
        const whereClause = dbId === 'ALL'
          ? `WHERE finished_at <= '${isoCutoff}'`
          : `WHERE db_id = '${dbId}' AND finished_at <= '${isoCutoff}'`;
        const rawRes = await (this.prisma as any).$executeRawUnsafe(`DELETE FROM alert_notification_logs ${whereClause}`);
        logsCount = typeof rawRes === 'number' ? rawRes : 0;
      } catch (rawErr) {
        console.warn('Raw SQL alert_notification_logs deletion failed:', rawErr);
      }
    }

    return {
      activeAlertsDeleted: activeCount,
      alertHistoryDeleted: histCount,
      metricDataPointsDeleted: metricsCount,
      notificationLogsDeleted: logsCount,
    };
  }

  async cleanRawQueryHistory(daysToKeep = 0, dbId = 'ALL') {
    const cutoffDate = daysToKeep <= 0 ? new Date(Date.now() + 60000) : new Date(Date.now() - daysToKeep * 86400000);
    let metricsCount = 0;

    try {
      const metricsRes = await (this.prisma as any).metricDataPoint?.deleteMany({
        where: {
          ...(dbId === 'ALL' ? {} : { dbId }),
          measuredAt: { lte: cutoffDate },
        },
      });
      metricsCount = metricsRes?.count || 0;
    } catch (e) {
      console.warn('Prisma metricDataPoint deleteMany failed, trying raw SQL:', e);
    }

    if (metricsCount === 0) {
      try {
        const isoCutoff = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');
        const whereClause = dbId === 'ALL'
          ? `WHERE measured_at <= '${isoCutoff}'`
          : `WHERE database_id = '${dbId}' AND measured_at <= '${isoCutoff}'`;
        const rawRes = await (this.prisma as any).$executeRawUnsafe(`DELETE FROM metric_data_points ${whereClause}`);
        metricsCount = typeof rawRes === 'number' ? rawRes : 0;
      } catch (rawErr) {
        console.warn('Raw SQL metric_data_points deletion failed:', rawErr);
      }
    }

    return {
      metricDataPointsDeleted: metricsCount,
    };
  }

  async resetData(): Promise<void> {
    const p = this.prisma as any;
    try {
      await p.$transaction([
        p.alertNotificationQueue.deleteMany(),
        p.databasePollQueue.deleteMany(),
        p.databasePollLog.deleteMany(),
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
        await p.$executeRawUnsafe('DELETE FROM `alert_notification_queue`;');
        await p.$executeRawUnsafe('DELETE FROM `database_poll_queue`;');
        await p.$executeRawUnsafe('DELETE FROM `database_poll_log`;');
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
