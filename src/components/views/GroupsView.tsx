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
  X
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
  onSaveGroup: (group: Partial<GroupEntity>, assignedDbIds?: string[]) => void;
  onDeleteGroup: (id: string) => void;
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

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupEntity | null>(null);
  const [testingNotification, setTestingNotification] = useState<string | null>(null);

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

          <div className="flex items-center gap-3">
            {userRole === 'ADMIN' ? (
              <button
                onClick={openCreateDialog}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                {t('groups.newDatabaseGroup')}
              </button>
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
    </div>
  );
};

