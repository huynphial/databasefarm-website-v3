import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Layers,
  Gauge,
  Info,
  Shield,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Settings2,
  Code2,
  Check,
  X,
  Sparkles,
  Search
} from 'lucide-react';
import { DbEngine, MetricEntity, TemplateEntity, UserRole, DatabaseEngineEntity } from '../../types';
import { DataTable, Column } from '../tables/DataTable';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';

interface TemplatesViewProps {
  templates: TemplateEntity[];
  metrics: MetricEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  userRole: UserRole;
  showInfoTips?: boolean;
  onSaveTemplate: (template: Partial<TemplateEntity>) => void;
  onDeleteTemplate: (id: string) => void;
  onSaveMetric: (metric: Partial<MetricEntity>) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  templates,
  metrics,
  databaseEngines = [],
  userRole,
  showInfoTips = true,
  onSaveTemplate,
  onDeleteTemplate,
  onSaveMetric,
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateEntity | null>(null);

  // Manage Metrics Modal State
  const [metricManagerTemplate, setMetricManagerTemplate] = useState<TemplateEntity | null>(null);
  const [metricSearchQuery, setMetricSearchQuery] = useState('');
  const [selectedMetricIdsToAdd, setSelectedMetricIdsToAdd] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    description: string;
    databaseEngineId: string;
    targetDbType: DbEngine | 'ALL' | string;
  }>({
    name: '',
    description: '',
    databaseEngineId: '',
    targetDbType: 'POSTGRES',
  });

  const openCreateDialog = () => {
    setEditingTemplate(null);
    const activeEngine = databaseEngines.find((e) => e.statusOnOff === 'ACTIVE') || databaseEngines[0];
    setFormData({
      name: '',
      description: '',
      databaseEngineId: activeEngine ? activeEngine.id : '',
      targetDbType: activeEngine ? (activeEngine.dbCode as any) : 'POSTGRES',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (tpl: TemplateEntity) => {
    setEditingTemplate(tpl);
    const matchedEngine = tpl.databaseEngineId
      ? databaseEngines.find((e) => e.id === tpl.databaseEngineId)
      : (tpl.targetDbType ? databaseEngines.find((e) => e.dbCode.toUpperCase() === tpl.targetDbType?.toUpperCase()) : null);

    setFormData({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description || '',
      databaseEngineId: matchedEngine ? matchedEngine.id : (tpl.databaseEngineId || (tpl.targetDbType === 'ALL' ? 'ALL' : '')),
      targetDbType: matchedEngine ? (matchedEngine.dbCode as any) : (tpl.targetDbType || 'ALL'),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Template name is required.', type: 'error' });
      return;
    }

    const selectedEng = databaseEngines.find((e) => e.id === formData.databaseEngineId);
    const resolvedDbType = selectedEng ? selectedEng.dbCode : (formData.databaseEngineId === 'ALL' ? 'ALL' : (formData.targetDbType || 'ALL'));

    onSaveTemplate({
      id: formData.id,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      databaseEngineId: selectedEng ? selectedEng.id : (formData.databaseEngineId !== 'ALL' ? formData.databaseEngineId || null : null),
      targetDbType: resolvedDbType,
    });
    setIsDialogOpen(false);
    toast({
      title: formData.id ? 'Template Updated' : 'Template Created',
      description: `Monitoring template "${formData.name}" [${selectedEng ? selectedEng.dbName : resolvedDbType}] saved successfully.`,
      type: 'success',
    });
  };

  const handleDelete = (tpl: TemplateEntity) => {
    if (confirm(`Are you sure you want to delete template "${tpl.name}"? Metrics associated with this template will be unbundled.`)) {
      onDeleteTemplate(tpl.id);
      toast({ title: 'Template Deleted', description: `Template "${tpl.name}" was removed.`, type: 'info' });
    }
  };

  // Toggle metric active state within template
  const handleToggleMetricState = (metric: MetricEntity) => {
    const nextState = !metric.isEnabled;
    onSaveMetric({
      ...metric,
      isEnabled: nextState,
    });
    toast({
      title: nextState ? 'Metric Monitoring Activated' : 'Metric Monitoring Paused',
      description: `"${metric.name}" active monitoring state set to ${nextState ? 'ON' : 'OFF'}.`,
      type: 'info',
    });
  };

  // Remove metric from template
  const handleRemoveMetricFromTemplate = (metric: MetricEntity) => {
    const nextIds = (metric.templateIds || (metric.templateId ? [metric.templateId] : [])).filter((id) => id !== metricManagerTemplate?.id);
    onSaveMetric({
      ...metric,
      templateIds: nextIds,
      templateId: nextIds[0] || null,
      templateName: nextIds.length > 0 ? metric.templateName : null,
    });
    toast({
      title: 'Metric Removed from Template',
      description: `Metric "${metric.name}" has been unbundled from template.`,
      type: 'info',
    });
  };

  // Filter available metrics for multi-select
  const filteredAvailableMetrics = useMemo(() => {
    if (!metricManagerTemplate) return [];
    const templateDbType = metricManagerTemplate.targetDbType; // e.g. "POSTGRES", "MYSQL", "ALL", etc.
    const templateEngineId = metricManagerTemplate.databaseEngineId;

    const unassignedAndCompatible = metrics.filter((m) => {
      // 1. Must not be already assigned to this template
      const isAssigned = m.templateIds?.includes(metricManagerTemplate.id) || m.templateId === metricManagerTemplate.id;
      if (isAssigned) return false;

      // 2. Compatibility check:
      // If template is universal ('ALL' or empty)
      if (!templateDbType || templateDbType === 'ALL') return true;

      // If metric matches exact databaseEngineId
      if (templateEngineId && m.databaseEngineId && templateEngineId === m.databaseEngineId) {
        return true;
      }

      // If metric is universal (no engine assigned, or engine id is null, or engine code is universal)
      const metricDbCode = m.databaseEngine?.dbCode || (databaseEngines.find((e) => e.id === m.databaseEngineId)?.dbCode);
      if (!m.databaseEngineId || !metricDbCode || metricDbCode === 'ALL') return true;

      // Otherwise, database engine codes must match
      return metricDbCode.toUpperCase() === templateDbType.toUpperCase();
    });

    if (!metricSearchQuery.trim()) return unassignedAndCompatible;
    const q = metricSearchQuery.toLowerCase().trim();
    return unassignedAndCompatible.filter((m) => m.name.toLowerCase().includes(q) || m.sqlQuery.toLowerCase().includes(q));
  }, [metrics, metricManagerTemplate, metricSearchQuery, databaseEngines]);

  // Add selected metrics to template
  const handleAddSelectedMetricsToTemplate = () => {
    if (!metricManagerTemplate || selectedMetricIdsToAdd.size === 0) return;
    selectedMetricIdsToAdd.forEach((metricId) => {
      const targetMetric = metrics.find((m) => m.id === metricId);
      if (targetMetric) {
        const currentIds = targetMetric.templateIds || (targetMetric.templateId ? [targetMetric.templateId] : []);
        const nextIds = Array.from(new Set([...currentIds, metricManagerTemplate.id]));
        onSaveMetric({
          ...targetMetric,
          templateIds: nextIds,
          templateId: nextIds[0] || null,
          templateName: metricManagerTemplate.name,
          isEnabled: true,
        });
      }
    });

    const count = selectedMetricIdsToAdd.size;
    setSelectedMetricIdsToAdd(new Set());
    setMetricSearchQuery('');
    toast({
      title: 'Metrics Attached',
      description: `${count} metrics attached to template "${metricManagerTemplate.name}".`,
      type: 'success',
    });
  };

  const columns: Column<TemplateEntity>[] = [
    {
      header: 'Template Name & Scope',
      accessorKey: 'name',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            {row.name}
          </div>
          {row.description && (
            <div className="text-xs text-slate-500 mt-0.5 max-w-md line-clamp-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Database Engine',
      accessorKey: 'targetDbType',
      width: '150px',
      cell: (row) => {
        const engine = row.databaseEngine || databaseEngines.find((e) => e.id === row.databaseEngineId || e.dbCode.toUpperCase() === row.targetDbType?.toUpperCase());
        const dbCode = engine ? engine.dbCode : (row.targetDbType || 'ALL');
        const dbColor = engine?.dbColor || '#64748B';

        return (
          <span
            className="px-2.5 py-1 rounded-md text-xs font-bold font-mono flex items-center gap-1.5 max-w-fit uppercase shadow-2xs"
            title={engine ? `${engine.dbName} (${engine.dbCode})` : dbCode}
            style={{
              backgroundColor: dbColor + '15',
              color: dbColor,
              border: `1px solid ${dbColor}35`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dbColor }} />
            {dbCode}
          </span>
        );
      },
    },
    {
      header: 'Bundled Metrics Status',
      width: '240px',
      cell: (row) => {
        const templateMetrics = metrics.filter((m) => m.templateIds?.includes(row.id) || m.templateId === row.id);
        const activeCount = templateMetrics.filter((m) => m.isEnabled !== false).length;
        const pausedCount = templateMetrics.length - activeCount;

        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMetricManagerTemplate(row)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{templateMetrics.length} Probes</span>
              <span className="text-[10px] text-emerald-600 font-mono">({activeCount} ON)</span>
            </button>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      width: '160px',
      cell: (row) => (
        userRole === 'ADMIN' ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setMetricManagerTemplate(row)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              title="Manage bundled metrics"
            >
              Metrics
            </button>
            <button
              onClick={() => openEditDialog(row)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="Edit template details"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(row)}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="Delete template"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMetricManagerTemplate(row)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
          >
            View Metrics
          </button>
        )
      ),
    },
  ];

  // For the active manager template, get its metrics and available unassigned metrics
  const activeTemplateMetrics = metricManagerTemplate
    ? metrics.filter((m) => m.templateIds?.includes(metricManagerTemplate.id) || m.templateId === metricManagerTemplate.id)
    : [];

  const availableMetricsToAdd = metricManagerTemplate
    ? metrics.filter((m) => !(m.templateIds?.includes(metricManagerTemplate.id) || m.templateId === metricManagerTemplate.id))
    : [];

  // Filter templates by search term
  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates;
    const term = searchTerm.toLowerCase().trim();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        (t.description && t.description.toLowerCase().includes(term)) ||
        (t.targetDbType && t.targetDbType.toLowerCase().includes(term))
    );
  }, [templates, searchTerm]);

  const totalPages = Math.ceil(filteredTemplates.length / pageSize) || 1;
  const paginatedTemplates = filteredTemplates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Information Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900">Granular Metric Management:</span> Add or remove specific SQL metrics inside each monitoring template. Use the On/Off toggle switch to activate or pause individual metrics within a template at any time.
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Monitoring Templates</h2>
          <p className="text-xs text-slate-500">
            Engine-compatible blueprints defining standard monitoring metrics: {templates.length} {searchTerm && `(Filtered: ${filteredTemplates.length})`}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search by Template Name */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Template Name..."
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
              New Template
            </button>
          ) : (
            <div className="text-xs text-slate-400 italic flex items-center gap-1.5 shrink-0">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              View-Only Mode
            </div>
          )}
        </div>
      </div>

      <div className="flex-1">
        <DataTable
          columns={columns}
          data={paginatedTemplates}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filteredTemplates.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          emptyMessage={
            searchTerm
              ? `No templates found matching "${searchTerm}".`
              : 'No templates created yet.'
          }
        />
      </div>

      {/* Metric Management Dialog */}
      <Dialog
        isOpen={!!metricManagerTemplate}
        onClose={() => setMetricManagerTemplate(null)}
        title={metricManagerTemplate ? `Template Metrics: ${metricManagerTemplate.name}` : 'Manage Template Metrics'}
        description="Add/remove metrics and toggle active monitoring state (On/Off) for each metric."
        maxWidth="2xl"
      >
        {metricManagerTemplate && (
          <div className="space-y-5 text-xs">
            {/* Header info */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-900">{metricManagerTemplate.name}</span>
              </div>
              {(() => {
                const engine = metricManagerTemplate.databaseEngine || databaseEngines.find((e) => e.id === metricManagerTemplate.databaseEngineId || e.dbCode.toUpperCase() === metricManagerTemplate.targetDbType?.toUpperCase());
                const dbName = engine ? engine.dbName : (metricManagerTemplate.targetDbType === 'ALL' ? 'Universal / All' : (metricManagerTemplate.targetDbType || 'Universal / All'));
                const dbColor = engine?.dbColor || '#64748B';

                return (
                  <span
                    className="px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5"
                    style={{
                      backgroundColor: dbColor + '15',
                      color: dbColor,
                      border: `1px solid ${dbColor}30`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dbColor }} />
                    {dbName}
                  </span>
                );
              })()}
            </div>

            {/* Searchable Multi-Select Checkbox Attach Section */}
            {userRole === 'ADMIN' && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-200/70 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Attach Metrics to This Template</span>
                  <span className="text-[10px] text-indigo-700 font-mono font-bold">
                    {selectedMetricIdsToAdd.size} selected
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search available metrics to attach..."
                    value={metricSearchQuery}
                    onChange={(e) => setMetricSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-xs pl-8 pr-3 py-2 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-white border border-slate-200 rounded-lg p-2">
                  {filteredAvailableMetrics.length > 0 ? (
                    filteredAvailableMetrics.map((m) => {
                      const isChecked = selectedMetricIdsToAdd.has(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-md hover:bg-slate-50 transition-colors cursor-pointer text-xs ${
                            isChecked ? 'bg-indigo-50/70 border border-indigo-200' : 'border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = new Set(selectedMetricIdsToAdd);
                                if (e.target.checked) {
                                  next.add(m.id);
                                } else {
                                  next.delete(m.id);
                                }
                                setSelectedMetricIdsToAdd(next);
                              }}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="truncate">
                              <div className="font-bold text-slate-900 truncate">{m.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">{m.sqlQuery}</div>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                            {m.templateName ? `In: ${m.templateName}` : 'Standalone'}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-slate-400 text-xs italic">
                      No available metrics match your search.
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddSelectedMetricsToTemplate}
                    disabled={selectedMetricIdsToAdd.size === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Attach Selected ({selectedMetricIdsToAdd.size}) Metrics</span>
                  </button>
                </div>
              </div>
            )}

            {/* List of Bundled Metrics with Toggle Switches */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700 font-bold text-xs">
                <span>Bundled Metrics ({activeTemplateMetrics.length})</span>
                <span className="text-[11px] text-slate-500 font-normal">Active monitoring state controls execution</span>
              </div>

              {activeTemplateMetrics.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {activeTemplateMetrics.map((m) => {
                    const isActive = m.isEnabled !== false;
                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                          isActive
                            ? 'bg-white border-slate-200 shadow-2xs'
                            : 'bg-slate-50 border-slate-200/60 opacity-75'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{m.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-200 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {isActive ? 'Active' : 'Disabled'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Cycle {m.cycle ?? 1}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5 max-w-md">
                            {m.sqlQuery}
                          </div>
                        </div>

                        {/* Controls: On/Off Toggle and Remove button */}
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Toggle Switch */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-600">
                              {isActive ? 'ON' : 'OFF'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleMetricState(m)}
                              disabled={userRole !== 'ADMIN'}
                              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                                isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                              } ${userRole !== 'ADMIN' ? 'cursor-not-allowed opacity-60' : ''}`}
                              title={isActive ? 'Click to disable metric' : 'Click to enable metric'}
                            >
                              <span className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" />
                            </button>
                          </div>

                          {/* Remove from template button */}
                          {userRole === 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMetricFromTemplate(m)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove metric from template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                  <Gauge className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="font-semibold text-slate-700">No metrics bundled in this template yet.</p>
                  <p className="text-[11px] mt-0.5">Use the selector above to attach existing metrics.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setMetricManagerTemplate(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Dialog for Create/Edit Template */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'Create Monitoring Template'}
        description="Configure template engine compatibility and metadata."
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Template Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. PostgreSQL Core Health"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Database Engine (from Database Engines Table) *
            </label>
            <select
              value={formData.databaseEngineId || (formData.targetDbType === 'ALL' ? 'ALL' : '')}
              onChange={(e) => {
                const val = e.target.value;
                const eng = databaseEngines.find((item) => item.id === val);
                setFormData({
                  ...formData,
                  databaseEngineId: val,
                  targetDbType: eng ? eng.dbCode : (val === 'ALL' ? 'ALL' : 'POSTGRES'),
                });
              }}
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="" disabled>-- Select Database Engine from database_engine --</option>
              {databaseEngines.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.dbName} ({eng.dbCode}) {eng.statusOnOff === 'INACTIVE' ? '— [Inactive]' : ''}
                </option>
              ))}
              <option value="ALL">Universal (Compatible with all engines)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Selected engine is bound to the registered database engine in the database_engine catalog.
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Summary of monitoring probes bundled in this template..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

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
              {editingTemplate ? 'Save Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
