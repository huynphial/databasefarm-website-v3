import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  FolderKanban,
  Server,
  Layers,
  Send,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  Shield,
  Activity,
  AlertOctagon,
  Search,
  BellRing,
  Radio,
  Database,
  Filter,
  ChevronDown,
  X,
  Download,
  Upload,
  FileText,
  Check,
  Loader2
} from 'lucide-react';
import { ActiveAlertEntity, DatabaseEntity, GroupEntity, TemplateEntity, AlertNotificationMethodEntity, UserRole, DatabaseEngineEntity } from '../../types';
import { DataTable, Column } from '../tables/DataTable';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { getDbEngineBadgeClass } from '../../config/dbEngines';
import { useTranslation } from '../../i18n/LanguageContext';

export function parseGroupSenderIds(senderIdsStr: string, activeMethodIds: string[]): { [key: string]: string } {
  const mapping: { [key: string]: string } = {};
  
  try {
    if (senderIdsStr && (senderIdsStr.trim().startsWith('[') || senderIdsStr.trim().startsWith('{'))) {
      const parsed = JSON.parse(senderIdsStr);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item && typeof item === 'object' && item.dispatcherId) {
            mapping[item.dispatcherId] = item.senderIds || '';
          }
        });
        return mapping;
      }
    }
  } catch (e) {
    // Treat as legacy text
  }

  if (senderIdsStr && senderIdsStr.trim()) {
    activeMethodIds.forEach((id) => {
      mapping[id] = senderIdsStr;
    });
  } else {
    activeMethodIds.forEach((id) => {
      mapping[id] = '';
    });
  }

  return mapping;
}

export function serializeGroupSenderIds(mapping: { [key: string]: string }): string {
  const list = Object.entries(mapping).map(([dispatcherId, senderIds]) => ({
    dispatcherId,
    senderIds: senderIds.trim(),
  }));
  return JSON.stringify(list);
}

export function extractGroupMappings(group: GroupEntity): { notificationMethodId: string; senderIds: string }[] {
  if (group.notificationMappings && group.notificationMappings.length > 0) {
    return group.notificationMappings.map((m) => ({
      notificationMethodId: m.notificationMethodId,
      senderIds: m.senderIds || '',
    }));
  }
  if (group.alertMethodIds && group.alertMethodIds.length > 0) {
    const parsed = parseGroupSenderIds(group.senderIds || '', group.alertMethodIds);
    return group.alertMethodIds.map((id) => ({
      notificationMethodId: id,
      senderIds: parsed[id] || '',
    }));
  }
  return [];
}

interface GroupsViewProps {
  groups: GroupEntity[];
  databases: DatabaseEntity[];
  templates: TemplateEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  alertMethods?: AlertNotificationMethodEntity[];
  activeAlerts?: ActiveAlertEntity[];
  userRole: UserRole;
  showInfoTips?: boolean;
  onSaveGroup: (group: Partial<GroupEntity>, assignedDbIds?: string[]) => Promise<any> | void;
  onDeleteGroup: (id: string) => void;
  onSaveDatabase?: (db: Partial<DatabaseEntity>) => Promise<any> | void;
  onRefresh?: () => Promise<void> | void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  groups,
  databases,
  templates,
  databaseEngines = [],
  alertMethods = [],
  activeAlerts = [],
  userRole,
  showInfoTips = true,
  onSaveGroup,
  onDeleteGroup,
  onSaveDatabase,
  onRefresh,
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEngineType, setSelectedEngineType] = useState<string>('ALL');
  const [selectedDbId, setSelectedDbId] = useState<string>('ALL');
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupEntity | null>(null);
  const [testingNotification, setTestingNotification] = useState<string | null>(null);

  // Import/Export Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importGenerateNewIds, setImportGenerateNewIds] = useState(false);
  const [importMatchExistingDbs, setImportMatchExistingDbs] = useState(true);
  const [importMatchChannels, setImportMatchChannels] = useState(true);
  const [importCreateMissingDbs, setImportCreateMissingDbs] = useState(true);
  const [importPreview, setImportPreview] = useState<{
    type: 'BUNDLE' | 'ARRAY' | 'SINGLE';
    groups: Array<{
      id?: string;
      name: string;
      description?: string;
      databaseIds?: string[];
      templateIds?: string[];
      linkedDatabases?: Array<{
        id?: string;
        name: string;
        dbType: string;
        host: string;
        port: number;
        databaseNameOrSid?: string;
        username?: string;
        password?: string;
        passwordEncrypted?: string;
        tags?: string[];
        pollIntervalMinutes?: number;
        note?: string;
        isEnabled?: boolean;
      }>;
      notificationMappings?: Array<{
        notificationMethodId: string;
        senderIds: string;
        methodName?: string;
        channelType?: string;
      }>;
      alertMethodIds?: string[];
      senderIds?: string;
    }>;
    bundledDatabases?: any[];
    bundledMethods?: any[];
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(event.target as Node)) {
        setIsDbDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDbDropdownOpen(false);
      }
    };
    if (isDbDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDbDropdownOpen]);

  const selectedDb = databases.find((d) => d.id === selectedDbId);

  const availableEngineCodes = useMemo(() => {
    return Array.from(
      new Set([
        ...databaseEngines.map((e) => e.dbCode.toUpperCase()),
        ...databases.map((d) => d.dbType.toUpperCase()),
      ])
    ).filter(Boolean);
  }, [databaseEngines, databases]);

  const filteredDatabasesForDropdown = useMemo(() => {
    return databases.filter((db) => {
      const matchEngine =
        selectedEngineType === 'ALL' || db.dbType.toUpperCase() === selectedEngineType.toUpperCase();
      const matchQuery =
        !dbSearchQuery.trim() ||
        db.name.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
        db.host.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
        db.dbType.toLowerCase().includes(dbSearchQuery.toLowerCase());
      return matchEngine && matchQuery;
    });
  }, [databases, selectedEngineType, dbSearchQuery]);

  // Form State with Dynamic Alert Dispatchers
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    description: string;
    databaseIds: string[];
    templateIds: string[];
    notificationMappings: { notificationMethodId: string; senderIds: string }[];
  }>({
    name: '',
    description: '',
    databaseIds: [],
    templateIds: [],
    notificationMappings: [],
  });

  const openCreateDialog = () => {
    setEditingGroup(null);
    const defaultMethodIds = alertMethods.filter(m => m.statusOnOff === 'ACTIVE').map(m => m.id);
    setFormData({
      name: '',
      description: '',
      databaseIds: [],
      templateIds: [],
      notificationMappings: defaultMethodIds.map(id => ({ notificationMethodId: id, senderIds: '' })),
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (group: GroupEntity) => {
    setEditingGroup(group);
    const initialMappings = extractGroupMappings(group);

    setFormData({
      id: group.id,
      name: group.name,
      description: group.description || '',
      databaseIds: group.databaseIds || [],
      templateIds: group.templateIds || [],
      notificationMappings: initialMappings,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Group name is required.', type: 'error' });
      return;
    }

    const cleanMappings = formData.notificationMappings.map((m) => ({
      notificationMethodId: m.notificationMethodId,
      senderIds: m.senderIds.trim(),
    }));

    onSaveGroup(
      {
        id: formData.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        databaseIds: formData.databaseIds,
        templateIds: formData.templateIds,
        notificationMappings: cleanMappings,
        alertMethodIds: cleanMappings.map((m) => m.notificationMethodId),
        senderIds: cleanMappings.map((m) => m.senderIds).filter(Boolean).join(', '),
      },
      formData.databaseIds
    );

    setIsDialogOpen(false);
    toast({
      title: formData.id ? 'Group Updated' : 'Group Created',
      description: `Database group "${formData.name}" saved with updated notification channel mappings.`,
      type: 'success',
    });
  };

  const handleTestAlertRouting = (group: GroupEntity) => {
    setTestingNotification(group.id);
    setTimeout(() => {
      setTestingNotification(null);
      const mappings = extractGroupMappings(group);
      const boundMethodIds = mappings.map((m) => m.notificationMethodId);
      const boundMethods = alertMethods.filter((m) => boundMethodIds.includes(m.id));
      
      if (boundMethods.length === 0) {
        toast({
          title: 'No Notification Channels Active',
          description: `Group "${group.name}" currently has no enabled channels or target IDs configured.`,
          type: 'info',
        });
      } else {
        const channelsWithTargets = boundMethods.map(m => {
          const mappingItem = mappings.find((item) => item.notificationMethodId === m.id);
          const target = mappingItem?.senderIds || 'None';
          return `${m.name} (${m.type}) -> [${target}]`;
        });

        toast({
          title: 'Notification Test Dispatched',
          description: `Dispatched synthetic test alert payload for "${group.name}" via: ${channelsWithTargets.join('; ')}.`,
          type: 'success',
        });
      }
    }, 850);
  };

  const handleExportAllGroups = () => {
    if (userRole !== 'ADMIN') {
      toast({
        title: t('activeAlerts.permissionDenied') || 'Permission Denied',
        description: 'Only administrators can export database group configurations.',
        type: 'error',
      });
      return;
    }

    if (groups.length === 0) {
      toast({
        title: t('groups.noGroupsToExport') || 'No Groups to Export',
        description: t('groups.noGroupsToExportDesc') || 'There are no database groups available to export.',
        type: 'warning',
      });
      return;
    }

    const exportedGroups = groups.map((g) => {
      // Find all databases that belong to this group
      const linkedDbs = databases.filter(
        (db) => (db.groupIds && db.groupIds.includes(g.id)) || (g.databaseIds && g.databaseIds.includes(db.id))
      );

      // Find all notification mappings for this group
      const rawMappings = extractGroupMappings(g);
      const enrichedMappings = rawMappings.map((m) => {
        const methodObj = alertMethods.find((am) => am.id === m.notificationMethodId);
        return {
          notificationMethodId: m.notificationMethodId,
          senderIds: m.senderIds || '',
          methodName: methodObj?.methodName || '',
          channelType: methodObj?.channelType || '',
          description: methodObj?.description || '',
        };
      });

      return {
        id: g.id,
        name: g.name,
        description: g.description || null,
        databaseIds: g.databaseIds || linkedDbs.map((d) => d.id),
        templateIds: g.templateIds || [],
        linkedDatabases: linkedDbs.map((db) => ({
          id: db.id,
          name: db.name,
          dbType: db.dbType,
          host: db.host,
          port: db.port,
          databaseNameOrSid: db.connectionConfig?.databaseName || db.connectionConfig?.serviceName || '',
          username: db.username || db.connectionConfig?.username || '',
          tags: db.tags || [],
          pollIntervalMinutes: db.pollIntervalMinutes ?? 5,
          note: db.note || '',
          isEnabled: db.isEnabled !== false,
          status: db.status || 'UP',
        })),
        notificationMappings: enrichedMappings,
        alertMethodIds: enrichedMappings.map((m) => m.notificationMethodId),
        senderIds: enrichedMappings.map((m) => m.senderIds).filter(Boolean).join(', '),
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      };
    });

    // Top-level unique referenced databases
    const referencedDbsMap = new Map<string, any>();
    databases.forEach((db) => {
      if (groups.some((g) => (db.groupIds && db.groupIds.includes(g.id)) || (g.databaseIds && g.databaseIds.includes(db.id)))) {
        referencedDbsMap.set(db.id, {
          id: db.id,
          name: db.name,
          dbType: db.dbType,
          host: db.host,
          port: db.port,
          databaseNameOrSid: db.connectionConfig?.databaseName || db.connectionConfig?.serviceName || '',
          username: db.username || db.connectionConfig?.username || '',
          tags: db.tags || [],
          pollIntervalMinutes: db.pollIntervalMinutes ?? 5,
          note: db.note || '',
          isEnabled: db.isEnabled !== false,
          status: db.status || 'UP',
        });
      }
    });

    // Top-level unique referenced alert notification methods
    const referencedMethodsMap = new Map<string, any>();
    alertMethods.forEach((am) => {
      if (
        groups.some(
          (g) =>
            (g.notificationMappings || []).some((m) => m.notificationMethodId === am.id) ||
            (g.alertMethodIds || []).includes(am.id)
        )
      ) {
        referencedMethodsMap.set(am.id, {
          id: am.id,
          methodName: am.methodName,
          channelType: am.channelType,
          statusOnOff: am.statusOnOff,
          description: am.description || '',
        });
      }
    });

    const exportBundle = {
      $schema: 'https://database-monitoring/schema/database-groups-bundle-v1.json',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'DATABASE_GROUPS_BUNDLE',
      groupsCount: exportedGroups.length,
      groups: exportedGroups,
      databases: Array.from(referencedDbsMap.values()),
      notificationMethods: Array.from(referencedMethodsMap.values()),
    };

    const jsonString = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_database_groups_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t('groups.groupsExported') || 'Database Groups Exported',
      description: t('groups.groupsExportedDesc', { count: groups.length }) || `Successfully exported ${groups.length} database group(s) with linked databases and notification methods to JSON.`,
      type: 'success',
    });
  };

  const parseJsonContent = (content: string) => {
    setImportFileError(null);
    if (!content || !content.trim()) {
      setImportPreview(null);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      if (!parsed) throw new Error('Empty or invalid JSON payload');

      let rawGroups: any[] = [];
      let bundledDbs: any[] = [];
      let bundledMethods: any[] = [];
      let bundleType: 'BUNDLE' | 'ARRAY' | 'SINGLE' = 'ARRAY';

      if (parsed.type === 'DATABASE_GROUPS_BUNDLE' && Array.isArray(parsed.groups)) {
        rawGroups = parsed.groups;
        bundledDbs = Array.isArray(parsed.databases) ? parsed.databases : [];
        bundledMethods = Array.isArray(parsed.notificationMethods) ? parsed.notificationMethods : [];
        bundleType = 'BUNDLE';
      } else if (Array.isArray(parsed.groups)) {
        rawGroups = parsed.groups;
        bundledDbs = Array.isArray(parsed.databases) ? parsed.databases : [];
        bundledMethods = Array.isArray(parsed.notificationMethods) ? parsed.notificationMethods : [];
        bundleType = 'BUNDLE';
      } else if (Array.isArray(parsed)) {
        rawGroups = parsed;
        bundleType = 'ARRAY';
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.name || parsed.groupName) {
          rawGroups = [parsed];
          bundleType = 'SINGLE';
        } else {
          throw new Error('JSON does not contain any recognizable database group definition.');
        }
      }

      if (rawGroups.length === 0) {
        throw new Error('No database group records found in payload.');
      }

      const normalizedGroups = rawGroups.map((g: any) => {
        const name = g.name || g.groupName || 'Imported Group';
        const description = g.description || '';
        const databaseIds: string[] = Array.isArray(g.databaseIds) ? g.databaseIds : [];
        const templateIds: string[] = Array.isArray(g.templateIds) ? g.templateIds : [];

        // Linked databases
        let linkedDatabases: any[] = [];
        if (Array.isArray(g.linkedDatabases)) {
          linkedDatabases = g.linkedDatabases;
        } else if (Array.isArray(g.databases)) {
          linkedDatabases = g.databases;
        }

        // Notification mappings
        let notificationMappings: any[] = [];
        if (Array.isArray(g.notificationMappings)) {
          notificationMappings = g.notificationMappings.map((m: any) => ({
            notificationMethodId: m.notificationMethodId || m.methodId || m.id || '',
            senderIds: typeof m.senderIds === 'string' ? m.senderIds : (m.senderId || ''),
            methodName: m.methodName || '',
            channelType: m.channelType || '',
          }));
        } else if (Array.isArray(g.alertMethodIds)) {
          const parsedSenders = parseGroupSenderIds(g.senderIds || '', g.alertMethodIds);
          notificationMappings = g.alertMethodIds.map((id: string) => ({
            notificationMethodId: id,
            senderIds: parsedSenders[id] || '',
          }));
        }

        return {
          id: g.id,
          name,
          description,
          databaseIds,
          templateIds,
          linkedDatabases,
          notificationMappings,
          alertMethodIds: g.alertMethodIds,
          senderIds: g.senderIds,
        };
      });

      setImportPreview({
        type: bundleType,
        groups: normalizedGroups,
        bundledDatabases: bundledDbs,
        bundledMethods: bundledMethods,
      });
    } catch (err: any) {
      setImportFileError(err.message || 'Failed to parse JSON file');
      setImportPreview(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      parseJsonContent(content);
    };
    reader.onerror = () => {
      setImportFileError('Failed to read file from disk.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteImport = async () => {
    if (userRole !== 'ADMIN') {
      toast({
        title: t('activeAlerts.permissionDenied') || 'Permission Denied',
        description: 'Only administrators can import database groups.',
        type: 'error',
      });
      return;
    }

    if (!importPreview || importPreview.groups.length === 0) return;

    setIsImporting(true);
    try {
      // Step 1: Auto-create any missing databases if enabled
      const knownDbs = [...databases];
      if (importCreateMissingDbs && onSaveDatabase) {
        const allPotentialDbs: any[] = [];
        (importPreview.bundledDatabases || []).forEach((db) => {
          if (db && db.name && !allPotentialDbs.some((x) => x.name?.toLowerCase() === db.name?.toLowerCase())) {
            allPotentialDbs.push(db);
          }
        });
        importPreview.groups.forEach((g) => {
          (g.linkedDatabases || []).forEach((db) => {
            if (db && db.name && !allPotentialDbs.some((x) => x.name?.toLowerCase() === db.name?.toLowerCase())) {
              allPotentialDbs.push(db);
            }
          });
        });

        for (const candidate of allPotentialDbs) {
          const alreadyExists = knownDbs.some(
            (d) =>
              (candidate.id && d.id === candidate.id) ||
              d.name.toLowerCase() === candidate.name?.toLowerCase() ||
              (candidate.host && d.host.toLowerCase() === candidate.host?.toLowerCase() && Number(d.port) === Number(candidate.port))
          );

          if (!alreadyExists && candidate.name && candidate.host) {
            try {
              const freshDbId = candidate.id || `db-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`;
              const createdDb = {
                id: freshDbId,
                name: candidate.name,
                dbType: candidate.dbType || 'ORACLE',
                host: candidate.host,
                port: Number(candidate.port) || 1521,
                tags: candidate.tags || ['PRODUCTION'],
                pollIntervalMinutes: candidate.pollIntervalMinutes || 5,
                note: candidate.note || '',
                username: candidate.username || '',
                password: candidate.password || '',
                passwordEncrypted: candidate.passwordEncrypted,
                isEnabled: candidate.isEnabled !== false,
                connectionConfig: {
                  username: candidate.username || '',
                  ...(candidate.dbType === 'ORACLE'
                    ? { serviceName: candidate.databaseNameOrSid || 'ORCLPDB1' }
                    : { databaseName: candidate.databaseNameOrSid || 'app' }),
                  sslMode: candidate.sslMode || 'require',
                },
                groupIds: [],
              };
              await onSaveDatabase(createdDb);
              knownDbs.push(createdDb as any);
            } catch (createErr) {
              console.warn('Failed to auto-create missing database during group import:', createErr);
            }
          }
        }
      }

      // Step 2: Import each group
      let importedCount = 0;
      for (const item of importPreview.groups) {
        // Resolve database IDs
        const assignedDbIds: string[] = [];
        const rawDbIdentifiers = [
          ...(item.databaseIds || []),
          ...(item.linkedDatabases || []).map((d) => d.id || d.name),
        ].filter(Boolean);

        const uniqueIdentifiers = Array.from(new Set(rawDbIdentifiers));

        uniqueIdentifiers.forEach((idOrName) => {
          let matchedDb: DatabaseEntity | undefined;
          if (importMatchExistingDbs) {
            matchedDb = knownDbs.find(
              (d) =>
                d.id === idOrName ||
                d.name.toLowerCase() === idOrName.toLowerCase()
            );
            if (!matchedDb && item.linkedDatabases) {
              const linkedObj = item.linkedDatabases.find((d) => d.id === idOrName || d.name === idOrName);
              if (linkedObj && linkedObj.host) {
                matchedDb = knownDbs.find(
                  (d) =>
                    d.host.toLowerCase() === linkedObj.host.toLowerCase() &&
                    Number(d.port) === Number(linkedObj.port)
                );
              }
            }
          } else {
            matchedDb = knownDbs.find((d) => d.id === idOrName);
          }

          if (matchedDb) {
            if (!assignedDbIds.includes(matchedDb.id)) {
              assignedDbIds.push(matchedDb.id);
            }
          } else if (typeof idOrName === 'string' && idOrName.startsWith('db-')) {
            if (!assignedDbIds.includes(idOrName)) {
              assignedDbIds.push(idOrName);
            }
          }
        });

        // Resolve notification mappings
        const resolvedMappings: { notificationMethodId: string; senderIds: string }[] = [];
        (item.notificationMappings || []).forEach((mapping) => {
          let targetMethodId = mapping.notificationMethodId;
          const exactMethod = alertMethods.find((m) => m.id === mapping.notificationMethodId);

          if (!exactMethod && importMatchChannels) {
            const matchByName = mapping.methodName
              ? alertMethods.find((m) => m.methodName.toLowerCase() === mapping.methodName?.toLowerCase())
              : undefined;

            const matchByType = mapping.channelType
              ? alertMethods.find((m) => m.channelType.toUpperCase() === mapping.channelType?.toUpperCase())
              : undefined;

            if (matchByName) {
              targetMethodId = matchByName.id;
            } else if (matchByType) {
              targetMethodId = matchByType.id;
            }
          }

          if (targetMethodId) {
            resolvedMappings.push({
              notificationMethodId: targetMethodId,
              senderIds: (mapping.senderIds || '').trim(),
            });
          }
        });

        // Resolve group ID
        const existingGroup = groups.find((g) => g.name.toLowerCase() === item.name.toLowerCase());
        const groupId = importGenerateNewIds
          ? `grp-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`
          : existingGroup?.id || item.id || `grp-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`;

        const groupPayload: Partial<GroupEntity> = {
          id: groupId,
          name: item.name.trim(),
          description: item.description?.trim() || null,
          databaseIds: assignedDbIds,
          templateIds: item.templateIds || [],
          notificationMappings: resolvedMappings,
          alertMethodIds: resolvedMappings.map((m) => m.notificationMethodId),
          senderIds: resolvedMappings.map((m) => m.senderIds).filter(Boolean).join(', '),
        };

        await onSaveGroup(groupPayload, assignedDbIds);
        importedCount++;
      }

      toast({
        title: t('groups.groupsImported') || 'Database Groups Imported',
        description: t('groups.groupsImportedDesc', { count: importedCount }) || `Successfully imported ${importedCount} database group(s).`,
        type: 'success',
      });

      setIsImportModalOpen(false);
      setImportJsonText('');
      setImportPreview(null);
      setImportFileError(null);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      toast({
        title: t('groups.importError') || 'Import Error',
        description: err.message || 'An error occurred during database group import.',
        type: 'error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = (group: GroupEntity) => {
    if (confirm(t('groups.deleteGroupConfirm'))) {
      onDeleteGroup(group.id);
      toast({ title: 'Group Deleted', description: `Group "${group.name}" was removed.`, type: 'info' });
    }
  };

  const columns: Column<GroupEntity>[] = [
    {
      header: t('groups.groupNameAndPurpose'),
      accessorKey: 'name',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
            {row.name}
          </div>
          {row.description && (
            <div className="text-xs text-slate-500 mt-0.5 max-w-sm line-clamp-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      header: t('groups.totalDbs'),
      width: '100px',
      cell: (row) => {
        const assignedDbs = databases.filter((db) => row.databaseIds?.includes(db.id));
        const total = assignedDbs.length;
        return (
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-slate-800 text-xs font-mono">{total}</span>
          </div>
        );
      },
    },
    {
      header: t('groups.up'),
      width: '90px',
      cell: (row) => {
        const assignedDbs = databases.filter((db) => row.databaseIds?.includes(db.id));
        let upCount = 0;
        assignedDbs.forEach((db) => {
          if (db.isEnabled === false) return;
          const isDown = (db.status || '').toUpperCase() === 'DOWN';
          if (!isDown) upCount++;
        });

        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {upCount}
          </span>
        );
      },
    },
    {
      header: t('groups.down'),
      width: '95px',
      cell: (row) => {
        const assignedDbs = databases.filter((db) => row.databaseIds?.includes(db.id));
        let downCount = 0;
        assignedDbs.forEach((db) => {
          if (db.isEnabled === false) return;
          const isDown = (db.status || '').toUpperCase() === 'DOWN';
          if (isDown) downCount++;
        });

        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
              downCount > 0
                ? 'bg-rose-50 border border-rose-200 text-rose-700 font-extrabold animate-pulse'
                : 'bg-slate-100 border border-slate-200 text-slate-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${downCount > 0 ? 'bg-rose-500' : 'bg-slate-400'}`} />
            {downCount}
          </span>
        );
      },
    },
    {
      header: t('groups.activeAlerts'),
      width: '150px',
      cell: (row) => {
        const assignedDbIds = row.databaseIds || [];
        const groupAlerts = activeAlerts.filter((a) => assignedDbIds.includes(a.dbId));

        const criticalCount = groupAlerts.filter((a) => a.alertLevel === 'CRITICAL' || a.alertLevel === 'DOWN').length;
        const highCount = groupAlerts.filter((a) => a.alertLevel === 'HIGH').length;
        const warningCount = groupAlerts.filter((a) => a.alertLevel === 'WARN').length;

        const labelText = `${criticalCount}/${highCount}/${warningCount}`;

        if (criticalCount > 0) {
          return (
            <span title="Critical / High / Warning (C/H/W)" className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2 py-0.5 rounded border border-rose-200 text-rose-700 bg-rose-50 font-mono animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              {labelText}
            </span>
          );
        }

        if (highCount > 0) {
          return (
            <span title="Critical / High / Warning (C/H/W)" className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded border border-orange-200 text-orange-700 bg-orange-50 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {labelText}
            </span>
          );
        }

        if (warningCount > 0) {
          return (
            <span title="Critical / High / Warning (C/H/W)" className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded border border-amber-200 text-amber-700 bg-amber-50 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {labelText}
            </span>
          );
        }

        return (
          <span title="Critical / High / Warning (C/H/W)" className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border border-emerald-200 text-emerald-700 bg-emerald-50/50 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            {labelText}
          </span>
        );
      },
    },
    {
      header: t('groups.appliedTemplates'),
      width: '180px',
      cell: (row) => {
        const appliedTpls = templates.filter((t) => row.templateIds?.includes(t.id));
        if (appliedTpls.length === 0) {
          return <span className="text-xs text-slate-400 italic">{t('groups.noTemplatesLinked')}</span>;
        }
        if (appliedTpls.length >= 1) {
          const templateNamesList = appliedTpls.map((tpl) => `${tpl.name}${tpl.targetDbType ? ` [${tpl.targetDbType}]` : ''}`).join('\n');
          return (
            <div className="group relative inline-block">
              <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold inline-flex items-center gap-1 cursor-help shadow-2xs">
                <Layers className="w-3 h-3 text-indigo-600" />
                {appliedTpls.length} {t('groups.templates')}
              </span>
              {/* Hover Tooltip showing template names */}
              <div className="hidden group-hover:block absolute left-0 bottom-full mb-1.5 z-50 min-w-[180px] max-w-xs p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none whitespace-pre-line leading-relaxed">
                <div className="font-bold text-indigo-300 pb-1 mb-1 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                  {t('groups.appliedTemplates')} ({appliedTpls.length})
                </div>
                {templateNamesList}
              </div>
            </div>
          );
        }
      },
    },
    {
      header: t('groups.notificationDispatchers'),
      width: '180px',
      cell: (row) => {
        const mappings = extractGroupMappings(row);
        const count = mappings.length;
        const text = count === 0 ? t('groups.noDispatchers') : count === 1 ? '1 Dispatcher' : `${count} Dispatchers`;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
            count > 0 
              ? 'bg-indigo-50/80 border-indigo-200 text-indigo-700 font-bold' 
              : 'bg-slate-100/80 border-slate-200 text-slate-500 italic'
          }`}>
            <Radio className="w-3.5 h-3.5 text-indigo-500" />
            {text}
          </span>
        );
      },
    },
    {
      header: t('groups.actions'),
      align: 'right',
      width: '90px',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {userRole === 'ADMIN' && (
            <>
              <button
                onClick={() => openEditDialog(row)}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                title="Edit group"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(row)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                title="Delete group"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // Filter groups by search term, engine type, and specific database
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // 1. Database Engine Filter
      if (selectedEngineType !== 'ALL') {
        const groupDbs = databases.filter((d) => g.databaseIds.includes(d.id));
        const hasMatchingEngine = groupDbs.some(
          (d) => d.dbType.toUpperCase() === selectedEngineType.toUpperCase()
        );
        if (!hasMatchingEngine) return false;
      }

      // 2. Specific Database Filter
      if (selectedDbId !== 'ALL') {
        if (!g.databaseIds.includes(selectedDbId)) return false;
      }

      // 3. Text Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const groupDbs = databases.filter((d) => g.databaseIds.includes(d.id));
        const matchesName = g.name.toLowerCase().includes(term);
        const matchesDesc = g.description && g.description.toLowerCase().includes(term);
        const matchesContainedDb = groupDbs.some(
          (d) => d.name.toLowerCase().includes(term) || d.host.toLowerCase().includes(term)
        );
        if (!matchesName && !matchesDesc && !matchesContainedDb) return false;
      }

      return true;
    });
  }, [groups, searchTerm, selectedEngineType, selectedDbId, databases]);

  const activeFiltersCount =
    (selectedEngineType !== 'ALL' ? 1 : 0) +
    (selectedDbId !== 'ALL' ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  const totalPages = Math.ceil(filteredGroups.length / pageSize) || 1;
  const paginatedGroups = filteredGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Information Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <div>
              <span className="font-bold text-slate-900">{t('groups.guidanceTitle')}</span> {t('groups.guidanceDesc')}
            </div>
            <div className="text-slate-500 text-[11px]">
              {t('groups.guidanceSub')}
            </div>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-indigo-600" />
              <span>{t('groups.databaseGroups')}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {t('groups.totalActiveGroups')}: {groups.length} {activeFiltersCount > 0 && `(Filtered: ${filteredGroups.length})`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {userRole === 'ADMIN' ? (
              <>
                <button
                  type="button"
                  onClick={handleExportAllGroups}
                  title={t('groups.exportAllTooltip') || 'Export all database groups with linked databases and notification methods to JSON'}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t('groups.exportAll') || 'Export Groups JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImportJsonText('');
                    setImportFileError(null);
                    setImportPreview(null);
                    setIsImportModalOpen(true);
                  }}
                  title={t('groups.importTooltip') || 'Import database groups from JSON file'}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t('groups.importJson') || 'Import Groups JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={openCreateDialog}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors shadow-2xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  {t('groups.newDatabaseGroup')}
                </button>
              </>
            ) : (
              <div className="text-xs text-slate-400 italic flex items-center gap-1.5 shrink-0">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                {t('common.readOnly')}
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar: Database Engine & Target Database Filter Header */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('common.filter')}:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex items-center gap-2.5 flex-1">
            {/* Database Engine Filter */}
            <div className="relative min-w-[170px]">
              <select
                value={selectedEngineType}
                onChange={(e) => {
                  setSelectedEngineType(e.target.value);
                  setSelectedDbId('ALL');
                  setCurrentPage(1);
                }}
                className="w-full appearance-none bg-slate-50 border border-slate-300 text-xs pl-3 pr-8 py-1.5 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
              >
                <option value="ALL">{t('common.allEngines')}</option>
                {availableEngineCodes.map((code) => {
                  const eng = databaseEngines.find((e) => e.dbCode.toUpperCase() === code.toUpperCase());
                  return (
                    <option key={code} value={code}>
                      {eng ? `${eng.dbName} (${eng.dbCode})` : `${code} Databases`}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Target Database Selector Dropdown */}
            <div className="relative flex-1 min-w-[220px]" ref={dbDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDbDropdownOpen(!isDbDropdownOpen)}
                className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 border border-slate-300 text-slate-900 text-xs font-medium rounded-lg px-3 py-1.5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    {selectedDb ? selectedDb.name : t('databases.allDatabases')}
                  </span>
                  {selectedDb && (
                    <span
                      className={`px-1.5 py-0.2 border rounded text-[9px] font-bold tracking-wider shrink-0 ${getDbEngineBadgeClass(
                        selectedDb.dbType
                      )}`}
                    >
                      {selectedDb.dbType}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isDbDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isDbDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-2 max-w-md">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={dbSearchQuery}
                      onChange={(e) => setDbSearchQuery(e.target.value)}
                      placeholder={t('databases.searchPlaceholder')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs pl-8 pr-3 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-900"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {/* All Databases Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDbId('ALL');
                        setIsDbDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                        selectedDbId === 'ALL'
                          ? 'bg-indigo-50 text-indigo-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t('databases.allDatabases')}</span>
                      </div>
                      {selectedDbId === 'ALL' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>

                    {filteredDatabasesForDropdown.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        {t('common.noDataFound')}
                      </div>
                    ) : (
                      filteredDatabasesForDropdown.map((db) => (
                        <button
                          key={db.id}
                          type="button"
                          onClick={() => {
                            setSelectedDbId(db.id);
                            setIsDbDropdownOpen(false);
                            setCurrentPage(1);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                            db.id === selectedDbId
                              ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                db.isEnabled === false
                                  ? 'bg-slate-400'
                                  : db.status === 'DOWN'
                                  ? 'bg-rose-500'
                                  : db.status === 'WARNING'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            <span className="truncate">{db.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({db.host}:{db.port})
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.2 border rounded text-[9px] font-bold ${getDbEngineBadgeClass(
                              db.dbType
                            )}`}
                          >
                            {db.dbType}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Search by Group Name */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={t('groups.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 text-xs pl-8 pr-3 py-1.5 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Reset Filters button if active */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setSelectedEngineType('ALL');
                  setSelectedDbId('ALL');
                  setDbSearchQuery('');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                title="Reset all active filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('common.reset')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1">
        <DataTable
          columns={columns}
          data={paginatedGroups}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filteredGroups.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          emptyMessage={
            searchTerm
              ? t('groups.noGroupsFound')
              : t('common.noDataFound')
          }
        />
      </div>

      {/* Dialog for Create/Edit Group */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingGroup ? `${t('groups.editGroupTitle')}: ${editingGroup.name}` : t('groups.createGroupTitle')}
        description={t('groups.dialogDesc')}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* General Metadata */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('groups.groupNameLabel')}</label>
              <input
                type="text"
                required
                placeholder={t('groups.groupNamePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('groups.description')}</label>
              <textarea
                rows={2}
                placeholder={t('groups.descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Database Mapping (Many-to-Many) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 font-bold flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-500" />
                {t('groups.managedDatabases')}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {formData.databaseIds.length} {t('groups.of')} {databases.length} {t('groups.selected')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {t('groups.managedDatabasesDesc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-white border border-slate-200 rounded-lg">
              {databases.map((db) => {
                const isSelected = formData.databaseIds.includes(db.id);
                return (
                  <label
                    key={db.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                        : 'border-transparent hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, databaseIds: [...formData.databaseIds, db.id] });
                        } else {
                          setFormData({
                            ...formData,
                            databaseIds: formData.databaseIds.filter((id) => id !== db.id),
                          });
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="truncate flex-1">
                      <span className="font-semibold">{db.name}</span>
                      <span className="ml-1.5 text-[10px] px-1 py-0.2 rounded bg-slate-200 font-mono">
                        {db.dbType}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Applied Templates (Template Compatibility) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                {t('groups.appliedMonitoringTemplates')}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {formData.templateIds.length} {t('groups.of')} {templates.length} {t('groups.selected')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {t('groups.appliedMonitoringTemplatesDesc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-white border border-slate-200 rounded-lg">
              {templates.map((tpl) => {
                const isSelected = formData.templateIds.includes(tpl.id);
                return (
                  <label
                    key={tpl.id}
                    className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                        : 'border-transparent hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, templateIds: [...formData.templateIds, tpl.id] });
                        } else {
                          setFormData({
                            ...formData,
                            templateIds: formData.templateIds.filter((id) => id !== tpl.id),
                          });
                        }
                      }}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="truncate flex-1">
                      <div className="font-semibold truncate">{tpl.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>{t('groups.compatibility')}:</span>
                        <span className="font-bold text-indigo-600 font-mono">
                          {tpl.targetDbType || t('groups.universal')}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Notification Rules: Dynamic Alert Dispatchers */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-slate-900 font-bold flex items-center gap-1.5 text-xs">
                <BellRing className="w-3.5 h-3.5 text-indigo-600" />
                {t('groups.alertNotificationDispatchers')}
              </h4>
              <span className="text-[10px] text-slate-500">
                {t('groups.boundFromSystemSettings')}
              </span>
            </div>

            {/* Dynamic Dispatchers Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-700">
                {t('groups.selectActiveDispatchChannels')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {alertMethods.map((method) => {
                  const isChecked = formData.notificationMappings.some((m) => m.notificationMethodId === method.id);
                  return (
                    <label
                      key={method.id}
                      className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-white border-indigo-400 shadow-2xs text-indigo-950 font-medium'
                          : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              notificationMappings: [
                                ...formData.notificationMappings,
                                { notificationMethodId: method.id, senderIds: '' },
                              ],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              notificationMappings: formData.notificationMappings.filter(
                                (m) => m.notificationMethodId !== method.id
                              ),
                            });
                          }
                        }}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">{method.name}</span>
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {method.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {method.configJson?.smtpHost || method.configJson?.endpoint || method.configJson?.botUsername || 'Active Routing'}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {alertMethods.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  {t('groups.noDispatchersConfigured')}
                </p>
              )}
            </div>

            {/* Sender IDs Input Field - PER DISPATCHER */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <label className="block text-[11px] text-slate-700 font-bold uppercase tracking-wider">
                {t('groups.targetSendersTitle')}
              </label>
              
              {formData.notificationMappings.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  {t('groups.selectAtLeastOneChannel')}
                </p>
              ) : (
                <div className="space-y-3 shadow-2xs">
                  {formData.notificationMappings.map((mapItem) => {
                    const method = alertMethods.find((m) => m.id === mapItem.notificationMethodId);
                    if (!method) return null;
                    
                    let placeholder = "e.g. dba-team@company.internal";
                    if (method.type === 'TELEGRAM') {
                      placeholder = "e.g. -1001234567890 (Telegram Chat ID)";
                    } else if (method.type === 'EMAIL') {
                      placeholder = "e.g. dba-team@company.internal, oncall@company.com";
                    } else if (method.type === 'WEBHOOK') {
                      placeholder = "e.g. https://api.company.internal/alerts";
                    }

                    return (
                      <div key={mapItem.notificationMethodId} className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <Radio className="w-3 h-3 text-indigo-500" />
                            {method.name} ({method.type})
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {mapItem.notificationMethodId}
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder={placeholder}
                          value={mapItem.senderIds}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            setFormData({
                              ...formData,
                              notificationMappings: formData.notificationMappings.map((m) =>
                                m.notificationMethodId === mapItem.notificationMethodId
                                  ? { ...m, senderIds: nextVal }
                                  : m
                              ),
                            });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-2xs cursor-pointer"
            >
              {editingGroup ? t('groups.saveGroupConfiguration') : t('groups.createGroup')}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Import Database Groups Modal */}
      <Dialog
        isOpen={isImportModalOpen}
        onClose={() => {
          if (!isImporting) {
            setIsImportModalOpen(false);
            setImportJsonText('');
            setImportFileError(null);
            setImportPreview(null);
          }
        }}
        title={t('groups.importModalTitle') || 'Import Database Groups from JSON'}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="text-xs text-slate-600">
            {t('groups.importModalDesc') || 'Upload a JSON file or paste raw JSON. Database groups, database relationships, and notification method mappings will be previewed and imported.'}
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json,application/json"
            className="hidden"
          />

          {/* File Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const content = event.target?.result as string;
                  setImportJsonText(content);
                  parseJsonContent(content);
                };
                reader.readAsText(file);
              }
            }}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/40 transition-colors rounded-xl p-5 text-center cursor-pointer flex flex-col items-center justify-center gap-2"
          >
            <div className="p-2.5 rounded-full bg-indigo-100 text-indigo-600">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-slate-800">
              {t('groups.uploadJsonTitle') || 'Upload JSON File'}
            </div>
            <div className="text-[11px] text-slate-500">
              {t('groups.uploadJsonDesc') || 'Drag and drop or browse for a .json file'}
            </div>
          </div>

          {/* Raw JSON Input / Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('groups.pasteJsonTitle') || 'Or Paste Raw JSON'}</span>
              </label>
              {importJsonText && (
                <button
                  type="button"
                  onClick={() => {
                    setImportJsonText('');
                    setImportPreview(null);
                    setImportFileError(null);
                  }}
                  className="text-[11px] text-slate-500 hover:text-red-600 transition-colors"
                >
                  {t('common.clear') || 'Clear'}
                </button>
              )}
            </div>
            <textarea
              rows={5}
              value={importJsonText}
              onChange={(e) => {
                const text = e.target.value;
                setImportJsonText(text);
                parseJsonContent(text);
              }}
              placeholder={t('groups.pasteJsonPlaceholder') || 'Paste database groups JSON here...'}
              className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Error Message */}
          {importFileError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">{t('groups.importError') || 'Import Error'}: </span>
                <span>{importFileError}</span>
              </div>
            </div>
          )}

          {/* Parsed Preview Section */}
          {importPreview && (
            <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    {t('groups.foundGroupsToImport', { count: importPreview.groups.length }) || `Found ${importPreview.groups.length} Group(s) to Import`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">
                    {importPreview.groups.reduce((acc, g) => acc + ((g.databaseIds?.length || 0) + (g.linkedDatabases?.length || 0)), 0)} {t('groups.totalDbs') || 'DBs'}
                  </span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">
                    {importPreview.groups.reduce((acc, g) => acc + (g.notificationMappings?.length || 0), 0)} Channels
                  </span>
                </div>
              </div>

              {/* Group items preview */}
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {importPreview.groups.map((group, idx) => {
                  const dbCount = (group.databaseIds?.length || 0) + (group.linkedDatabases?.length || 0);
                  const channelCount = group.notificationMappings?.length || 0;
                  return (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-xs shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                          {group.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                            {dbCount} {t('groups.totalDbs') || 'DBs'}
                          </span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                            {channelCount} Channels
                          </span>
                        </div>
                      </div>

                      {group.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">{group.description}</p>
                      )}

                      {/* Linked Databases tags */}
                      {group.linkedDatabases && group.linkedDatabases.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] text-slate-400 font-medium">{t('groups.attachedDatabases') || 'Databases'}:</span>
                          {group.linkedDatabases.map((db: any, dIdx: number) => (
                            <span key={dIdx} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                              {db.name || db.id}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Notification channels preview */}
                      {group.notificationMappings && group.notificationMappings.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-400 font-medium">{t('groups.notificationRouting') || 'Notifications'}:</span>
                          {group.notificationMappings.map((m: any, mIdx: number) => (
                            <span key={mIdx} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                              <Radio className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{m.methodName || m.channelType || m.notificationMethodId}</span>
                              {m.senderIds && <span className="font-mono text-slate-500">({m.senderIds})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Import Options Checkboxes */}
              <div className="pt-2 border-t border-slate-200 space-y-2 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={importMatchExistingDbs}
                    onChange={(e) => setImportMatchExistingDbs(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{t('groups.matchExistingDbs') || 'Match existing databases by name or host'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={importMatchChannels}
                    onChange={(e) => setImportMatchChannels(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{t('groups.matchExistingChannels') || 'Match notification channels by type if ID differs'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={importCreateMissingDbs}
                    onChange={(e) => setImportCreateMissingDbs(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Automatically create missing database connections if details are in the JSON</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={importGenerateNewIds}
                    onChange={(e) => setImportGenerateNewIds(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{t('groups.generateFreshGroupIds') || 'Generate fresh unique IDs for imported groups'}</span>
                </label>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isImporting}
              onClick={() => {
                setIsImportModalOpen(false);
                setImportJsonText('');
                setImportFileError(null);
                setImportPreview(null);
              }}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-xs font-medium cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!importPreview || importPreview.groups.length === 0 || isImporting}
              onClick={handleExecuteImport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {importPreview
                      ? t('groups.importGroupsCount', { count: importPreview.groups.length }) || `Import ${importPreview.groups.length} Group(s)`
                      : t('groups.importJson') || 'Import Groups JSON'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

