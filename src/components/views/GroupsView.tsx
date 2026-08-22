import React, { useState, useMemo } from 'react';
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
  Radio
} from 'lucide-react';
import { ActiveAlertEntity, DatabaseEntity, GroupEntity, TemplateEntity, AlertNotificationMethodEntity, UserRole } from '../../types';
import { DataTable, Column } from '../tables/DataTable';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';

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

interface GroupsViewProps {
  groups: GroupEntity[];
  databases: DatabaseEntity[];
  templates: TemplateEntity[];
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
  alertMethods = [],
  activeAlerts = [],
  userRole,
  showInfoTips = true,
  onSaveGroup,
  onDeleteGroup,
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupEntity | null>(null);
  const [testingNotification, setTestingNotification] = useState<string | null>(null);

  // Form State with Dynamic Alert Dispatchers
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    description: string;
    databaseIds: string[];
    templateIds: string[];
    alertMethodIds: string[];
    senderIds: string;
  }>({
    name: '',
    description: '',
    databaseIds: [],
    templateIds: [],
    alertMethodIds: [],
    senderIds: '',
  });

  const openCreateDialog = () => {
    setEditingGroup(null);
    const defaultMethodIds = alertMethods.filter(m => m.statusOnOff === 'ACTIVE').map(m => m.id);
    setFormData({
      name: '',
      description: '',
      databaseIds: [],
      templateIds: [],
      alertMethodIds: defaultMethodIds,
      senderIds: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (group: GroupEntity) => {
    setEditingGroup(group);
    
    // Resolve initial alertMethodIds
    const initialMethods = group.alertMethodIds || [];
    const initialSenderIds = group.senderIds || '';

    setFormData({
      id: group.id,
      name: group.name,
      description: group.description || '',
      databaseIds: group.databaseIds || [],
      templateIds: group.templateIds || [],
      alertMethodIds: initialMethods,
      senderIds: initialSenderIds,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Group name is required.', type: 'error' });
      return;
    }

    onSaveGroup(
      {
        id: formData.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        databaseIds: formData.databaseIds,
        templateIds: formData.templateIds,
        alertMethodIds: formData.alertMethodIds,
        senderIds: formData.senderIds.trim(),
      },
      formData.databaseIds
    );

    setIsDialogOpen(false);
    toast({
      title: formData.id ? 'Group Updated' : 'Group Created',
      description: `Database group "${formData.name}" saved with updated mappings and alert dispatcher routing.`,
      type: 'success',
    });
  };

  const handleTestAlertRouting = (group: GroupEntity) => {
    setTestingNotification(group.id);
    setTimeout(() => {
      setTestingNotification(null);
      const rowMethodIds = group.alertMethodIds || [];
      const boundMethods = alertMethods.filter((m) => rowMethodIds.includes(m.id));
      
      if (boundMethods.length === 0) {
        toast({
          title: 'No Notification Channels Active',
          description: `Group "${group.name}" currently has no enabled channels or target IDs configured.`,
          type: 'info',
        });
      } else {
        const mapping = parseGroupSenderIds(group.senderIds || '', rowMethodIds);
        const channelsWithTargets = boundMethods.map(m => {
          const target = mapping[m.id] || 'None';
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
    if (confirm(`Are you sure you want to delete group "${group.name}"? Databases assigned to this group will remain in storage but will be unmapped from this group.`)) {
      onDeleteGroup(group.id);
      toast({ title: 'Group Deleted', description: `Group "${group.name}" was removed.`, type: 'info' });
    }
  };

  const columns: Column<GroupEntity>[] = [
    {
      header: 'Group Name & Purpose',
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
      header: 'Total DBs',
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
      header: 'UP',
      width: '90px',
      cell: (row) => {
        const assignedDbs = databases.filter((db) => row.databaseIds?.includes(db.id));
        let upCount = 0;
        assignedDbs.forEach((db) => {
          if (db.isEnabled === false) return;
          const dbAlerts = activeAlerts.filter((a) => a.dbId === db.id);
          const isDown = dbAlerts.some((a) => a.alertLevel === 'DOWN' || a.alertLevel === 'CRITICAL');
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
      header: 'DOWN',
      width: '95px',
      cell: (row) => {
        const assignedDbs = databases.filter((db) => row.databaseIds?.includes(db.id));
        let downCount = 0;
        assignedDbs.forEach((db) => {
          if (db.isEnabled === false) return;
          const dbAlerts = activeAlerts.filter((a) => a.dbId === db.id);
          const isDown = dbAlerts.some((a) => a.alertLevel === 'DOWN' || a.alertLevel === 'CRITICAL');
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
      header: 'Active Alerts',
      width: '160px',
      cell: (row) => {
        const assignedDbIds = row.databaseIds || [];
        const groupAlerts = activeAlerts.filter((a) => assignedDbIds.includes(a.dbId));

        const downCount = groupAlerts.filter((a) => a.alertLevel === 'DOWN').length;
        const criticalCount = groupAlerts.filter((a) => a.alertLevel === 'CRITICAL').length;
        const highCount = groupAlerts.filter((a) => a.alertLevel === 'HIGH').length;
        const warningCount = groupAlerts.filter((a) => a.alertLevel === 'WARN').length;

        const labelText = `D/C/H/W ${downCount}/${criticalCount}/${highCount}/${warningCount}`;

        if (downCount > 0) {
          return (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2 py-0.5 rounded border border-purple-200 text-purple-700 bg-purple-50 font-mono animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {labelText}
            </span>
          );
        }

        if (criticalCount > 0) {
          return (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2 py-0.5 rounded border border-rose-200 text-rose-700 bg-rose-50 font-mono animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              {labelText}
            </span>
          );
        }

        if (highCount > 0) {
          return (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded border border-orange-200 text-orange-700 bg-orange-50 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {labelText}
            </span>
          );
        }

        if (warningCount > 0) {
          return (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded border border-amber-200 text-amber-700 bg-amber-50 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {labelText}
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border border-emerald-200 text-emerald-700 bg-emerald-50/50 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            {labelText}
          </span>
        );
      },
    },
    {
      header: 'Applied Templates',
      width: '180px',
      cell: (row) => {
        const appliedTpls = templates.filter((t) => row.templateIds?.includes(t.id));
        if (appliedTpls.length === 0) {
          return <span className="text-xs text-slate-400 italic">No templates linked</span>;
        }
        if (appliedTpls.length >= 2) {
          const templateNamesList = appliedTpls.map((t) => `${t.name}${t.targetDbType ? ` [${t.targetDbType}]` : ''}`).join('\n');
          return (
            <div className="group relative inline-block">
              <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold inline-flex items-center gap-1 cursor-help shadow-2xs">
                <Layers className="w-3 h-3 text-indigo-600" />
                {appliedTpls.length} Templates
              </span>
              {/* Hover Tooltip showing template names */}
              <div className="hidden group-hover:block absolute left-0 bottom-full mb-1.5 z-50 min-w-[180px] max-w-xs p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 pointer-events-none whitespace-pre-line leading-relaxed">
                <div className="font-bold text-indigo-300 pb-1 mb-1 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                  Linked Templates ({appliedTpls.length})
                </div>
                {templateNamesList}
              </div>
            </div>
          );
        }
        const t = appliedTpls[0];
        return (
          <span
            title={`Target Engine: ${t.targetDbType || 'Universal'}`}
            className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 inline-flex items-center gap-1 font-medium"
          >
            {t.name}
            {t.targetDbType && (
              <span className="font-bold opacity-75">[{t.targetDbType}]</span>
            )}
          </span>
        );
      },
    },
    {
      header: 'Notification Dispatchers',
      width: '180px',
      cell: (row) => {
        const count = (row.alertMethodIds || []).length;
        const text = count === 0 ? 'No Dispatchers' : count === 1 ? '1 Dispatcher' : `${count} Dispatchers`;
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
      header: 'Actions',
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

  // Filter groups by search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const term = searchTerm.toLowerCase().trim();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        (g.description && g.description.toLowerCase().includes(term))
    );
  }, [groups, searchTerm]);

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
              <span className="font-bold text-slate-900">Database Group Mappings & Real-Time Aggregates:</span> Groups establish a <strong>Many-to-Many relationship</strong> with databases and provide live rollups of total databases, UP/DOWN operational state, and active triggered alerts.
            </div>
            <div className="text-slate-500 text-[11px]">
              Alerts triggered on any database in a group are automatically routed to the group's configured Telegram Chat IDs (via base URL <code className="text-indigo-600 font-mono">https://api.telegram.org</code>) and Email distribution lists.
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Database Groups</h2>
          <p className="text-xs text-slate-500">
            Total active groups: {groups.length} {searchTerm && `(Filtered: ${filteredGroups.length})`}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search by Group Name */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Group Name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white border border-slate-300 text-xs pl-8 pr-3 py-2 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {userRole === 'ADMIN' ? (
            <button
              onClick={openCreateDialog}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors shadow-2xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Database Group
            </button>
          ) : (
            <div className="text-xs text-slate-400 italic flex items-center gap-1.5 shrink-0">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              View-Only Mode (Read Only)
            </div>
          )}
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
              ? `No database groups found matching "${searchTerm}".`
              : 'No database groups created.'
          }
        />
      </div>

      {/* Dialog for Create/Edit Group */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingGroup ? `Edit Group: ${editingGroup.name}` : 'Create Database Group'}
        description="Configure database mapping, applied monitoring templates, and notification rules."
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* General Metadata */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Group Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Production Core Tier"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Environment SLA tier, purpose, or operational notes..."
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
                Managed Databases (Many-to-Many Mapping)
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {formData.databaseIds.length} of {databases.length} selected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Select databases belonging to this group. A database instance can belong to multiple groups simultaneously.
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
                Applied Monitoring Templates (Engine Compatibility Enforced)
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {formData.templateIds.length} of {templates.length} selected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Templates strictly apply only to compatible database types within the group (e.g. PostgreSQL templates only evaluate on PostgreSQL instances).
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
                        <span>Compatibility:</span>
                        <span className="font-bold text-indigo-600 font-mono">
                          {tpl.targetDbType || 'Universal'}
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
                Alert Notification Dispatchers
              </h4>
              <span className="text-[10px] text-slate-500">
                Bound from System Settings
              </span>
            </div>

            {/* Dynamic Dispatchers Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-700">
                Select Active Dispatch Channels:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {alertMethods.map((method) => {
                  const isChecked = formData.alertMethodIds.includes(method.id);
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
                          let nextMethods;
                          if (e.target.checked) {
                            nextMethods = [...formData.alertMethodIds, method.id];
                          } else {
                            nextMethods = formData.alertMethodIds.filter((id) => id !== method.id);
                          }
                          
                          // Sync mapping
                          const currentMapping = parseGroupSenderIds(formData.senderIds, formData.alertMethodIds);
                          const cleanedMapping: { [key: string]: string } = {};
                          nextMethods.forEach((id) => {
                            cleanedMapping[id] = currentMapping[id] || '';
                          });
                          
                          setFormData({
                            ...formData,
                            alertMethodIds: nextMethods,
                            senderIds: serializeGroupSenderIds(cleanedMapping),
                          });
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
                  No alert dispatchers configured in System Settings.
                </p>
              )}
            </div>

            {/* Sender IDs Input Field - PER DISPATCHER */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <label className="block text-[11px] text-slate-700 font-bold uppercase tracking-wider">
                Target Senders / Destinations per Channel:
              </label>
              
              {formData.alertMethodIds.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Select at least one active dispatch channel above to configure target destinations.
                </p>
              ) : (
                <div className="space-y-3 shadow-2xs">
                  {formData.alertMethodIds.map((methodId) => {
                    const method = alertMethods.find((m) => m.id === methodId);
                    if (!method) return null;
                    
                    const currentMapping = parseGroupSenderIds(formData.senderIds, formData.alertMethodIds);
                    const value = currentMapping[methodId] || '';
                    
                    let placeholder = "e.g. dba-team@company.internal";
                    if (method.type === 'TELEGRAM') {
                      placeholder = "e.g. -1001234567890 (Telegram Chat ID)";
                    } else if (method.type === 'EMAIL') {
                      placeholder = "e.g. dba-team@company.internal, oncall@company.com";
                    } else if (method.type === 'SLACK') {
                      placeholder = "e.g. #alerts-channel";
                    } else if (method.type === 'SMS') {
                      placeholder = "e.g. +1234567890";
                    } else if (method.type === 'WEBHOOK') {
                      placeholder = "e.g. https://api.company.internal/alerts";
                    }

                    return (
                      <div key={methodId} className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <Radio className="w-3 h-3 text-indigo-500" />
                            {method.name} ({method.type})
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {methodId}
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder={placeholder}
                          value={value}
                          onChange={(e) => {
                            const newMapping = { ...currentMapping, [methodId]: e.target.value };
                            const cleanedMapping: { [key: string]: string } = {};
                            formData.alertMethodIds.forEach((id) => {
                              cleanedMapping[id] = newMapping[id] || '';
                            });
                            setFormData({
                              ...formData,
                              senderIds: serializeGroupSenderIds(cleanedMapping),
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
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-2xs cursor-pointer"
            >
              {editingGroup ? 'Save Group Configuration' : 'Create Group'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

