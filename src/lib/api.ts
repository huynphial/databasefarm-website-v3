import {
  User,
  DatabaseEntity,
  DatabaseEngineEntity,
  AlertNotificationMethodEntity,
  RawMeasurementEntity,
  MetricEntity,
  TemplateEntity,
  GroupEntity,
  ActiveAlertEntity,
  AlertHistoryEntity,
  AlertNotificationLogEntity,
  MetricHistoryEntity,
  SystemSettingsEntity,
  AuditLogEntity,
} from '../types';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const currentUserJson = localStorage.getItem('dbm_current_user');
  let currentUsername = 'admin';
  if (currentUserJson) {
    try {
      const u = JSON.parse(currentUserJson);
      if (u && u.username) currentUsername = u.username;
    } catch {}
  }

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Username': currentUsername,
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error [${res.status}]: ${errorText || res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Config & Storage Provider
  async getStorageInfo(): Promise<{ storageType: 'prisma' | 'memory'; isPrismaActive: boolean }> {
    return fetchJson('/api/config/storage-type');
  },

  // Databases
  async getDatabases(): Promise<DatabaseEntity[]> {
    return fetchJson('/api/databases');
  },
  async createDatabase(data: Partial<DatabaseEntity>): Promise<DatabaseEntity> {
    return fetchJson('/api/databases', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateDatabase(id: string, data: Partial<DatabaseEntity>): Promise<DatabaseEntity> {
    return fetchJson(`/api/databases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteDatabase(id: string): Promise<boolean> {
    await fetchJson(`/api/databases/${id}`, { method: 'DELETE' });
    return true;
  },

  // Metrics
  async getMetrics(): Promise<MetricEntity[]> {
    return fetchJson('/api/metrics');
  },
  async createMetric(data: Partial<MetricEntity>): Promise<MetricEntity> {
    return fetchJson('/api/metrics', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateMetric(id: string, data: Partial<MetricEntity>): Promise<MetricEntity> {
    return fetchJson(`/api/metrics/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteMetric(id: string): Promise<boolean> {
    await fetchJson(`/api/metrics/${id}`, { method: 'DELETE' });
    return true;
  },

  // Templates
  async getTemplates(): Promise<TemplateEntity[]> {
    return fetchJson('/api/templates');
  },
  async createTemplate(data: Partial<TemplateEntity>): Promise<TemplateEntity> {
    return fetchJson('/api/templates', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateTemplate(id: string, data: Partial<TemplateEntity>): Promise<TemplateEntity> {
    return fetchJson(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteTemplate(id: string): Promise<boolean> {
    await fetchJson(`/api/templates/${id}`, { method: 'DELETE' });
    return true;
  },

  // Groups
  async getGroups(): Promise<GroupEntity[]> {
    return fetchJson('/api/groups');
  },
  async createGroup(data: Partial<GroupEntity>, assignedDbIds?: string[]): Promise<GroupEntity> {
    return fetchJson('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ ...data, assignedDbIds }),
    });
  },
  async updateGroup(id: string, data: Partial<GroupEntity>, assignedDbIds?: string[]): Promise<GroupEntity> {
    return fetchJson(`/api/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, assignedDbIds }),
    });
  },
  async deleteGroup(id: string): Promise<boolean> {
    await fetchJson(`/api/groups/${id}`, { method: 'DELETE' });
    return true;
  },

  // Active Alerts
  async getActiveAlerts(): Promise<ActiveAlertEntity[]> {
    return fetchJson('/api/active-alerts');
  },
  async acknowledgeActiveAlert(alertId: string, acknowledgedById?: string | null, acknowledgedByName?: string): Promise<boolean> {
    try {
      await fetchJson(`/api/active-alerts/${alertId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ acknowledgedById, acknowledgedByName }),
      });
    } catch {}
    return true;
  },
  async clearActiveAlert(alertId: string, clearedById?: string | null, clearedByName?: string): Promise<boolean> {
    await fetchJson(`/api/active-alerts/${alertId}/clear`, {
      method: 'POST',
      body: JSON.stringify({ clearedById, clearedByName }),
    });
    return true;
  },

  // Alert History
  async getAlertHistory(): Promise<AlertHistoryEntity[]> {
    return fetchJson('/api/alert-history');
  },

  // Alert Notification Logs
  async getAlertNotificationLogs(): Promise<AlertNotificationLogEntity[]> {
    try {
      return await fetchJson('/api/alert-notification-logs');
    } catch {
      return [];
    }
  },

  // Metric History
  async getMetricHistory(dbId?: string, metricId?: string): Promise<MetricHistoryEntity[]> {
    const params = new URLSearchParams();
    if (dbId) params.append('dbId', dbId);
    if (metricId) params.append('metricId', metricId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchJson(`/api/metric-history${query}`);
  },

  // System Settings
  async getSystemSettings(): Promise<SystemSettingsEntity> {
    return fetchJson('/api/system-settings');
  },
  async updateSystemSettings(settings: Partial<SystemSettingsEntity>): Promise<SystemSettingsEntity> {
    return fetchJson('/api/system-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
  async resetData(): Promise<{ status: string; message: string }> {
    return fetchJson('/api/system-settings/reset-data', {
      method: 'POST',
    });
  },

  // Health Check
  async checkCollectorHealth(url?: string): Promise<{
    targetUrl: string;
    statusCode: number;
    statusText: string;
    isHealthy: boolean;
    responseTimeMs: number;
    timestamp: string;
    responseData?: any;
    message: string;
    error?: string;
  }> {
    return fetchJson('/api/collector/health-check', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLogEntity[]> {
    return fetchJson('/api/audit-logs');
  },
  async logAudit(data: Partial<AuditLogEntity>): Promise<AuditLogEntity> {
    return fetchJson('/api/audit-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Dynamic Database Engines Registry
  async getDatabaseEngines(): Promise<DatabaseEngineEntity[]> {
    return fetchJson('/api/database-engines');
  },
  async saveDatabaseEngine(engine: Partial<DatabaseEngineEntity>): Promise<DatabaseEngineEntity> {
    if (engine.id) {
      return fetchJson(`/api/database-engines/${engine.id}`, {
        method: 'PUT',
        body: JSON.stringify(engine),
      });
    }
    return fetchJson('/api/database-engines', {
      method: 'POST',
      body: JSON.stringify(engine),
    });
  },
  async deleteDatabaseEngine(id: string): Promise<{ success: boolean; id: string }> {
    return fetchJson(`/api/database-engines/${id}`, {
      method: 'DELETE',
    });
  },

  // Dynamic Alert Notification Methods
  async getAlertNotificationMethods(): Promise<AlertNotificationMethodEntity[]> {
    return fetchJson('/api/alert-methods');
  },
  async saveAlertNotificationMethod(method: Partial<AlertNotificationMethodEntity>): Promise<AlertNotificationMethodEntity> {
    if (method.id) {
      return fetchJson(`/api/alert-methods/${method.id}`, {
        method: 'PUT',
        body: JSON.stringify(method),
      });
    }
    return fetchJson('/api/alert-methods', {
      method: 'POST',
      body: JSON.stringify(method),
    });
  },
  async deleteAlertNotificationMethod(id: string): Promise<{ success: boolean; id: string }> {
    return fetchJson(`/api/alert-methods/${id}`, {
      method: 'DELETE',
    });
  },

  // Raw Query Measurements & Telemetry
  async getRawMeasurements(limit = 100): Promise<RawMeasurementEntity[]> {
    return fetchJson(`/api/raw-measurements?limit=${limit}`);
  },
  async addRawMeasurement(data: Partial<RawMeasurementEntity>): Promise<RawMeasurementEntity> {
    return fetchJson('/api/raw-measurements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

