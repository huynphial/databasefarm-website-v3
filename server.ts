import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getStorageRepository } from './server/repositories';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global BigInt serialization patch for JSON.stringify support (MySQL BigInt values)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  const repo = getStorageRepository();

  app.use(express.json());

  // Helper functions for client IP and User ID extraction for Audit Logging
  function getClientIp(req: express.Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor).split(',');
      return ips[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || '127.0.0.1';
  }

  function getUserId(req: express.Request, fallback = 'admin'): string {
    const h = req.headers['x-user-username'] || req.headers['x-user-id'];
    if (h && typeof h === 'string' && h.trim()) {
      return h.trim();
    }
    if (req.body && req.body.userId) {
      return String(req.body.userId);
    }
    if (req.body && req.body.updatedBy) {
      return String(req.body.updatedBy);
    }
    return fallback;
  }

  // Audit Logs API
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const logs = await repo.getAuditLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/audit-logs', async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      const userId = getUserId(req, req.body.userId || 'admin');
      const log = await repo.addAuditLog({
        ...req.body,
        userId,
        clientIp,
      });
      res.status(201).json(log);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Health & Config Info
  app.get('/api/health', async (req, res) => {
    res.json({
      status: 'ok',
      service: 'db-sentinel-api',
      storageType: repo.getStorageType(),
      timestamp: new Date().toISOString(),
      timezone: 'UTC+7 (Asia/Ho_Chi_Minh)',
    });
  });

  app.get('/api/config/storage-type', (req, res) => {
    res.json({
      storageType: repo.getStorageType(),
      isPrismaActive: repo.getStorageType() === 'prisma',
    });
  });

  // Users API
  app.get('/api/users', async (req, res) => {
    try {
      const users = await repo.getUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const saved = await repo.saveUser(req.body);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CREATE',
        targetEntity: 'USER',
        targetId: saved.id,
        details: `Created user account for "${saved.username}" with role ${saved.role}`,
      });
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      const saved = await repo.saveUser({ ...req.body, id: req.params.id });
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      
      let details = `Updated user account config for "${saved.username}"`;
      if (req.body.password) {
        details += ` (Password Reset/Update)`;
      }
      if (req.body.isLocked !== undefined) {
        details += ` (Account ${saved.isLocked ? 'Locked' : 'Unlocked'})`;
      }

      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'UPDATE',
        targetEntity: 'USER',
        targetId: saved.id,
        details,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const users = await repo.getUsers();
      const targetUser = users.find((u) => u.id === req.params.id);
      const username = targetUser ? targetUser.username : req.params.id;

      await repo.deleteUser(req.params.id);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'USER',
        targetId: req.params.id,
        details: `Removed user account "${username}" (ID: ${req.params.id})`,
      });
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
      }
      const result = await repo.verifyUserPassword(username, password);
      if (!result.success || !result.user) {
        await repo.addAuditLog({
          userId: username,
          clientIp: getClientIp(req),
          actionType: 'LOGIN_FAILED',
          targetEntity: 'AUTH',
          details: `Authentication failed: ${result.message || 'Invalid credentials'}`,
        });
        return res.status(401).json(result);
      }

      const nowIso = new Date().toISOString();
      await repo.saveUser({
        id: result.user.id,
        lastLogin: nowIso,
      }).catch(() => {});

      await repo.addAuditLog({
        userId: result.user.username,
        clientIp: getClientIp(req),
        actionType: 'LOGIN_SUCCESS',
        targetEntity: 'AUTH',
        targetId: result.user.id,
        details: `User "${result.user.username}" authenticated successfully via dynamic storage`,
      });

      res.json({
        success: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          role: result.user.role,
          isLocked: result.user.isLocked,
          lastLogin: nowIso,
          fullName: result.user.username === 'admin' ? 'System Administrator' : result.user.username === 'viewer' ? 'Operations Viewer' : `${result.user.username.charAt(0).toUpperCase() + result.user.username.slice(1)} User`,
          email: `${result.user.username}@databasefarm.internal`,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Databases API
  app.get('/api/databases', async (req, res) => {
    try {
      const dbs = await repo.getDatabases();
      res.json(dbs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/databases', async (req, res) => {
    try {
      const saved = await repo.saveDatabase(req.body);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CREATE',
        targetEntity: 'DATABASE',
        targetId: saved.id,
        details: `Created database "${saved.name}" (${saved.dbType} at ${saved.host}:${saved.port})`,
      });
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/databases/:id', async (req, res) => {
    try {
      const saved = await repo.saveDatabase({ ...req.body, id: req.params.id });
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'UPDATE',
        targetEntity: 'DATABASE',
        targetId: saved.id,
        details: `Updated database configuration for "${saved.name}"`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/databases/:id', async (req, res) => {
    try {
      await repo.deleteDatabase(req.params.id);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'DATABASE',
        targetId: req.params.id,
        details: `Deleted database ID ${req.params.id}`,
      });
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/databases/:id/test-connection', (req, res) => {
    const { id } = req.params;
    res.json({
      success: true,
      databaseId: id,
      latencyMs: 14,
      message: 'Connection to database endpoint succeeded (Simulated check).',
      testedAt: new Date().toISOString(),
    });
  });

  // Metrics API
  app.get('/api/metrics', async (req, res) => {
    try {
      const metrics = await repo.getMetrics();
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/metrics', async (req, res) => {
    try {
      const saved = await repo.saveMetric(req.body);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CREATE',
        targetEntity: 'METRIC',
        targetId: saved.id,
        details: `Created metric probe "${saved.name}" (${saved.valueType})`,
      });
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/metrics/:id', async (req, res) => {
    try {
      const saved = await repo.saveMetric({ ...req.body, id: req.params.id });
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'UPDATE',
        targetEntity: 'METRIC',
        targetId: saved.id,
        details: `Updated metric probe "${saved.name}"`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/metrics/:id', async (req, res) => {
    try {
      await repo.deleteMetric(req.params.id);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'METRIC',
        targetId: req.params.id,
        details: `Deleted metric probe ID ${req.params.id}`,
      });
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Templates API
  app.get('/api/templates', async (req, res) => {
    try {
      const templates = await repo.getTemplates();
      res.json(templates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/templates', async (req, res) => {
    try {
      const saved = await repo.saveTemplate(req.body);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CREATE',
        targetEntity: 'TEMPLATE',
        targetId: saved.id,
        details: `Created monitoring template bundle "${saved.name}"`,
      });
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/templates/:id', async (req, res) => {
    try {
      const saved = await repo.saveTemplate({ ...req.body, id: req.params.id });
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'UPDATE',
        targetEntity: 'TEMPLATE',
        targetId: saved.id,
        details: `Updated monitoring template bundle "${saved.name}"`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/templates/:id', async (req, res) => {
    try {
      await repo.deleteTemplate(req.params.id);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'TEMPLATE',
        targetId: req.params.id,
        details: `Deleted monitoring template ID ${req.params.id}`,
      });
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Groups API
  app.get('/api/groups', async (req, res) => {
    try {
      const groups = await repo.getGroups();
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/groups', async (req, res) => {
    try {
      const { assignedDbIds, ...groupData } = req.body;
      const saved = await repo.saveGroup(groupData, assignedDbIds);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CREATE',
        targetEntity: 'GROUP',
        targetId: saved.id,
        details: `Created database group "${saved.name}"`,
      });
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/groups/:id', async (req, res) => {
    try {
      const { assignedDbIds, ...groupData } = req.body;
      const saved = await repo.saveGroup({ ...groupData, id: req.params.id }, assignedDbIds);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'UPDATE',
        targetEntity: 'GROUP',
        targetId: saved.id,
        details: `Updated database group "${saved.name}"`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/groups/:id', async (req, res) => {
    try {
      await repo.deleteGroup(req.params.id);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'GROUP',
        targetId: req.params.id,
        details: `Deleted database group ID ${req.params.id}`,
      });
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Active Alerts API
  app.get('/api/active-alerts', async (req, res) => {
    try {
      const alerts = await repo.getActiveAlerts();
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/active-alerts', async (req, res) => {
    try {
      const saved = await repo.saveActiveAlert(req.body);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/active-alerts/:id/acknowledge', async (req, res) => {
    try {
      const { acknowledgedById, acknowledgedByName } = req.body || {};
      const ok = await repo.acknowledgeActiveAlert(req.params.id, acknowledgedById, acknowledgedByName);
      res.json({ success: ok, alertId: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/active-alerts/:id/clear', async (req, res) => {
    try {
      const { clearedById, clearedByName } = req.body || {};
      const ok = await repo.clearActiveAlert(req.params.id, clearedById, clearedByName);
      res.json({ success: ok, alertId: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Alert History API
  app.get('/api/alert-history', async (req, res) => {
    try {
      const history = await repo.getAlertHistory();
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/alert-history', async (req, res) => {
    try {
      const entry = await repo.addAlertHistory(req.body);
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Metric History API
  app.get('/api/metric-history', async (req, res) => {
    try {
      const { dbId, metricId, fromDate, toDate } = req.query as {
        dbId?: string;
        metricId?: string;
        fromDate?: string;
        toDate?: string;
      };
      const history = await repo.getMetricHistory(dbId, metricId, fromDate, toDate);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/metric-history', async (req, res) => {
    try {
      const entry = await repo.addMetricHistory(req.body);
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Database Engines API (Dynamic Registry)
  app.get('/api/database-engines', async (req, res) => {
    try {
      const engines = await repo.getDatabaseEngines();
      res.json(engines);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/database-engines', async (req, res) => {
    try {
      const saved = await repo.saveDatabaseEngine(req.body);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CREATE',
        targetEntity: 'DATABASE_ENGINE',
        targetId: saved.id,
        details: `Registered database engine "${saved.dbName}" (${saved.dbCode})`,
      });
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/database-engines/:id', async (req, res) => {
    try {
      const saved = await repo.saveDatabaseEngine({ ...req.body, id: req.params.id });
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'UPDATE',
        targetEntity: 'DATABASE_ENGINE',
        targetId: saved.id,
        details: `Updated database engine "${saved.dbName}" (${saved.dbCode})`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/database-engines/:id', async (req, res) => {
    try {
      await repo.deleteDatabaseEngine(req.params.id);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'DATABASE_ENGINE',
        targetId: req.params.id,
        details: `Removed database engine ID ${req.params.id}`,
      });
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Alert Notification Methods API (Dynamic Dispatchers)
  app.get('/api/alert-methods', async (req, res) => {
    try {
      const methods = await repo.getAlertNotificationMethods();
      res.json(methods);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/alert-methods', async (req, res) => {
    try {
      const saved = await repo.saveAlertNotificationMethod(req.body);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CREATE',
        targetEntity: 'ALERT_METHOD',
        targetId: saved.id,
        details: `Created alert notification dispatcher "${saved.name}" (${saved.type})`,
      });
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/alert-methods/:id', async (req, res) => {
    try {
      const saved = await repo.saveAlertNotificationMethod({ ...req.body, id: req.params.id });
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'UPDATE',
        targetEntity: 'ALERT_METHOD',
        targetId: saved.id,
        details: `Updated alert notification dispatcher "${saved.name}" (${saved.type})`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/alert-methods/:id', async (req, res) => {
    try {
      await repo.deleteAlertNotificationMethod(req.params.id);
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'ALERT_METHOD',
        targetId: req.params.id,
        details: `Removed alert notification dispatcher ID ${req.params.id}`,
      });
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Raw Measurements & Telemetry API
  app.get('/api/raw-measurements', async (req, res) => {
    try {
      const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : 0;
      const dbId = req.query.dbId as string | undefined;
      const metricId = req.query.metricId as string | undefined;
      const dbType = req.query.dbType as string | undefined;
      const objectName = req.query.objectName as string | undefined;
      const attributeName = req.query.attributeName as string | undefined;
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;
      const searchTerm = req.query.searchTerm as string | undefined;

      const measurements = await repo.getRawMeasurements({
        limit,
        dbId,
        metricId,
        dbType,
        objectName,
        attributeName,
        fromDate,
        toDate,
        searchTerm,
      });
      res.json(measurements);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/alert-notification-logs', async (req, res) => {
    try {
      const logs = await repo.getAlertNotificationLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/alert-notification-queue', async (req, res) => {
    try {
      const queue = await repo.getAlertNotificationQueue();
      res.json(queue);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/database-poll-queue', async (req, res) => {
    try {
      const queue = await repo.getDatabasePollQueue();
      res.json(queue);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/database-poll-queue/clear', async (req, res) => {
    try {
      const { status = 'processing', dbId = 'ALL' } = req.body || {};
      const result = await repo.clearDatabasePollQueue(status, dbId);
      const clientIp = getClientIp(req);
      const userId = getUserId(req, 'admin');
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'DATABASE_POLL_QUEUE',
        targetId: status,
        details: `Cleared ${result.clearedCount} item(s) from database poll queue (status: ${status}, dbId: ${dbId})`,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/database-poll-logs', async (req, res) => {
    try {
      const dbId = req.query.dbId as string | undefined;
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;
      const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : undefined;
      const logs = await repo.getDatabasePollLogs(dbId, fromDate, toDate, limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/raw-measurements', async (req, res) => {
    try {
      const entry = await repo.addRawMeasurement(req.body);
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // System Settings API
  app.get('/api/system-settings', async (req, res) => {
    try {
      const settings = await repo.getSystemSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/system-settings/items', async (req, res) => {
    try {
      const items = await repo.getSystemSettingsList();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system-settings/items', async (req, res) => {
    try {
      const saved = await repo.saveSystemSettingItem(req.body);
      const clientIp = getClientIp(req);
      const userId = getUserId(req, saved.updatedBy || 'admin');
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CONFIG_CHANGE',
        targetEntity: 'SYSTEM_SETTINGS',
        targetId: saved.id,
        details: `Created/updated system setting item "${saved.name}" = "${saved.value}"`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/system-settings/items/:id', async (req, res) => {
    try {
      const saved = await repo.saveSystemSettingItem({ ...req.body, id: req.params.id });
      const clientIp = getClientIp(req);
      const userId = getUserId(req, saved.updatedBy || 'admin');
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CONFIG_CHANGE',
        targetEntity: 'SYSTEM_SETTINGS',
        targetId: saved.id,
        details: `Updated system setting item "${saved.name}" = "${saved.value}"`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/system-settings/items/:id', async (req, res) => {
    try {
      await repo.deleteSystemSettingItem(req.params.id);
      const clientIp = getClientIp(req);
      const userId = getUserId(req, 'admin');
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'SYSTEM_SETTINGS',
        targetId: req.params.id,
        details: `Deleted system setting item ID ${req.params.id}`,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/system-settings', async (req, res) => {
    try {
      const saved = await repo.saveSystemSettings(req.body);
      const clientIp = getClientIp(req);
      const userId = getUserId(req, saved.updatedBy || 'admin');
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'CONFIG_CHANGE',
        targetEntity: 'SYSTEM_SETTINGS',
        targetId: 'default',
        details: `Updated global system configuration (Info & Guidance Tips: ${saved.showInfoTips !== false ? 'Visible' : 'Hidden'}, Retention: ${saved.dataRetentionDays}d)`,
      });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system-settings/reset-data', async (req, res) => {
    try {
      await repo.resetData();
      const clientIp = getClientIp(req);
      const userId = getUserId(req, 'admin');
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'SYSTEM',
        targetId: 'all',
        details: 'Performed global system settings reset (purged all databases, groups, templates, metrics, alerts, and histories)',
      });
      res.json({ status: 'ok', message: 'All transient and monitoring data has been successfully reset.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/danger-zone/clean-all-monitor-data', async (req, res) => {
    try {
      const { daysToKeep = 0, dbId = 'ALL' } = req.body || {};
      const result = await repo.cleanAllMonitorData(Number(daysToKeep) || 0, dbId);
      const clientIp = getClientIp(req);
      const userId = getUserId(req, 'admin');
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'SYSTEM',
        targetId: dbId,
        details: `Cleaned all monitor data older than ${daysToKeep} day(s) for database scope "${dbId}". Deleted: ${result.activeAlertsDeleted} active alerts, ${result.alertHistoryDeleted} alert history records, ${result.metricDataPointsDeleted} metric points, ${result.notificationLogsDeleted} notification logs.`,
      });
      res.json({ status: 'ok', ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/danger-zone/clean-raw-query-history', async (req, res) => {
    try {
      const { daysToKeep = 0, dbId = 'ALL' } = req.body || {};
      const result = await repo.cleanRawQueryHistory(Number(daysToKeep) || 0, dbId);
      const clientIp = getClientIp(req);
      const userId = getUserId(req, 'admin');
      await repo.addAuditLog({
        userId,
        clientIp,
        actionType: 'DELETE',
        targetEntity: 'SYSTEM',
        targetId: dbId,
        details: `Cleaned raw query history older than ${daysToKeep} day(s) for database scope "${dbId}". Deleted ${result.metricDataPointsDeleted} metric measurement points.`,
      });
      res.json({ status: 'ok', ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Collector API Health Check Endpoints
  app.get('/api/collector/mock-health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      code: 200,
      module: 'Collector API Service',
      message: 'Collector module is operational and healthy.',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/collector/health-check', async (req, res) => {
    const { url } = req.body || {};
    let targetUrl = url;
    if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
      try {
        const sys = await repo.getSystemSettings();
        targetUrl = sys.collectorEndpoint || 'http://localhost:3000/api/collector/mock-health';
      } catch {
        targetUrl = 'http://localhost:3000/api/collector/mock-health';
      }
    }

    const startTime = Date.now();
    try {
      const fullUrl = targetUrl.startsWith('/') ? `http://localhost:3000${targetUrl}` : targetUrl;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseTimeMs = Date.now() - startTime;
      const isOk = response.status === 200;

      let responseData: any = null;
      try {
        const text = await response.text();
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text.slice(0, 300);
        }
      } catch {
        responseData = null;
      }

      res.json({
        targetUrl,
        statusCode: response.status,
        statusText: response.statusText || (isOk ? 'OK' : 'Error'),
        isHealthy: isOk,
        responseTimeMs,
        timestamp: new Date().toISOString(),
        responseData,
        message: isOk
          ? `Collector API module is operational and healthy (HTTP 200 OK).`
          : `Collector API endpoint returned HTTP status ${response.status} ${response.statusText || ''}. Module is considered unhealthy.`,
      });
    } catch (err: any) {
      const responseTimeMs = Date.now() - startTime;
      res.json({
        targetUrl,
        statusCode: 0,
        statusText: 'Connection Failed',
        isHealthy: false,
        responseTimeMs,
        timestamp: new Date().toISOString(),
        error: err.message || 'Network request failed',
        message: `Failed to issue HTTP GET request to Collector API URL (${err.message}). Module is considered unhealthy.`,
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DB Sentinel server running on http://0.0.0.0:${PORT} [Storage: ${repo.getStorageType()}]`);
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
});
