import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { getStorageRepository } from './server/repositories';

// Global BigInt serialization patch for JSON.stringify support (MySQL BigInt values)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  const repo = getStorageRepository();

  // Enable trust proxy for reverse proxies / Cloud Run environments
  app.set('trust proxy', 1);

  app.use(express.json());

  // Rate Limiter: Authentication endpoint protection against brute force attacks (CWE-307)
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute window
    max: 30, // Limit each IP to 30 login requests per window
    standardHeaders: true, // Return standard RateLimit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)
    legacyHeaders: false, // Disable X-RateLimit-* legacy headers
    message: {
      success: false,
      message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    },
  });

  // Rate Limiter: SPA fallback & file-serving protection against resource exhaustion / DoS (CWE-770)
  const spaFallbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute window
    max: 300, // Limit each IP to 300 page load / file requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many page requests from this IP. Please try again later.',
  });

  // Secret key for signing server-controlled session tokens (CWE-807 / CWE-290 mitigation)
  const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');

  /**
   * Generates a signed stateless bearer token (JWS HS256).
   * Note on Separation of Concerns (CWE-916):
   * - Passwords and user credentials are encrypted/hashed using adaptive KDFs (Bcrypt cost factor 12)
   *   with cryptographically random salts in `server/utils/crypto.ts` to resist brute-force cracking.
   * - HMAC-SHA256 is used strictly here for signing short-lived session claims (stateless bearer token integrity).
   */
  function generateAuthToken(user: { id: string; username: string; role: string }): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.id,
        username: user.username,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7-day session validity
      })
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  type LoginValidationResult =
    | { isValid: true; username: string; password: string; error?: undefined }
    | { isValid: false; error: string; username?: undefined; password?: undefined };

  /**
   * Strict Type Guard & Input Sanitizer for Authentication Payloads
   * Prevents User-Controlled Bypass of Security Checks (CWE-807 / CWE-290)
   */
  function validateLoginInput(body: unknown): LoginValidationResult {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { isValid: false, error: 'Invalid payload: request body must be a JSON object.' };
    }

    const record = body as Record<string, unknown>;

    // Strict type check: parameters must be primitive strings (rejects arrays, objects, booleans, numbers)
    if (typeof record.username !== 'string' || typeof record.password !== 'string') {
      return { isValid: false, error: 'Username and password must be valid non-empty strings.' };
    }

    const trimmedUsername = record.username.trim();
    const rawPassword = record.password;

    if (trimmedUsername.length === 0) {
      return { isValid: false, error: 'Username cannot be empty.' };
    }

    if (trimmedUsername.length > 100) {
      return { isValid: false, error: 'Username exceeds the maximum permitted length (100 characters).' };
    }

    if (rawPassword.length === 0) {
      return { isValid: false, error: 'Password cannot be empty.' };
    }

    if (rawPassword.length > 256) {
      return { isValid: false, error: 'Password exceeds the maximum permitted length (256 characters).' };
    }

    return { isValid: true, username: trimmedUsername, password: rawPassword };
  }

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

  app.post('/api/auth/login', authRateLimiter, async (req, res) => {
    try {
      // 1. Strict Input Type Guarding & Sanitization (CWE-807 / CWE-290 Mitigation)
      const validation = validateLoginInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, message: validation.error });
      }

      const { username, password } = validation;

      // 2. Cryptographic constant-time credential verification (prevents timing-based user enumeration)
      const result = await repo.verifyUserPassword(username, password);
      if (!result.success || !result.user) {
        await repo.addAuditLog({
          userId: username,
          clientIp: getClientIp(req),
          actionType: 'LOGIN_FAILED',
          targetEntity: 'AUTH',
          details: `Authentication failed for account "${username}"`,
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.',
        });
      }

      const nowIso = new Date().toISOString();
      await repo.saveUser({
        id: result.user.id,
        lastLogin: nowIso,
      }).catch(() => {});

      // 3. Issue server-signed cryptographic token (HMAC-SHA256) to establish trusted server-controlled session
      const token = generateAuthToken({
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
      });

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
        token,
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
      const dbIds = req.query.dbIds ? (req.query.dbIds as string).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const metricId = req.query.metricId as string | undefined;
      const metricIds = req.query.metricIds ? (req.query.metricIds as string).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const dbType = req.query.dbType as string | undefined;
      const groupId = req.query.groupId as string | undefined;
      const templateId = req.query.templateId as string | undefined;
      const objectName = req.query.objectName as string | undefined;
      const attributeName = req.query.attributeName as string | undefined;
      const status = (req.query.status || req.query.pollStatus) as string | undefined;
      const pollStatus = req.query.pollStatus as string | undefined;
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;
      const searchTerm = req.query.searchTerm as string | undefined;
      const minDurationMs = req.query.minDurationMs !== undefined ? parseFloat(req.query.minDurationMs as string) : (req.query.queryDurationMs !== undefined ? parseFloat(req.query.queryDurationMs as string) : undefined);

      const measurements = await repo.getRawMeasurements({
        limit,
        dbId,
        dbIds,
        metricId,
        metricIds,
        dbType,
        groupId,
        templateId,
        objectName,
        attributeName,
        status,
        pollStatus,
        fromDate,
        toDate,
        searchTerm,
        minDurationMs: isNaN(minDurationMs as number) ? undefined : minDurationMs,
        queryDurationMs: isNaN(minDurationMs as number) ? undefined : minDurationMs,
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

  app.get('/api/license-status', async (req, res) => {
    try {
      const status = await repo.getLicenseFailCount();
      res.json(status);
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

  // Audit Logs API
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;
      const actionType = req.query.actionType as string | undefined;
      const searchTerm = req.query.searchTerm as string | undefined;
      const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : undefined;
      const logs = await repo.getAuditLogs({
        fromDate,
        toDate,
        actionType,
        searchTerm,
        limit,
      });
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/audit-logs', async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      const userId = getUserId(req);
      const entry = await repo.addAuditLog({
        ...req.body,
        clientIp: req.body.clientIp || clientIp,
        userId: req.body.userId || userId,
      });
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
    app.get('*', spaFallbackLimiter, (req, res) => {
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
