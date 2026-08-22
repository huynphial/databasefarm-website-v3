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
import { DbEngine, MetricEntity, TemplateEntity, UserRole } from '../../types';
import { DataTable, Column } from '../tables/DataTable';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';

interface TemplatesViewProps {
  templates: TemplateEntity[];
  metrics: MetricEntity[];
  userRole: UserRole;
  showInfoTips?: boolean;
  onSaveTemplate: (template: Partial<TemplateEntity>) => void;
  onDeleteTemplate: (id: string) => void;
  onSaveMetric: (metric: Partial<MetricEntity>) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  templates,
  metrics,
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
  const [selectedMetricToAdd, setSelectedMetricToAdd] = useState<string>('');

  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    description: string;
    targetDbType: DbEngine | 'ALL';
  }>({
    name: '',
    description: '',
    targetDbType: 'POSTGRES',
  });

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      targetDbType: 'POSTGRES',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (tpl: TemplateEntity) => {
    setEditingTemplate(tpl);
    setFormData({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description || '',
      targetDbType: tpl.targetDbType || 'ALL',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Template name is required.', type: 'error' });
      return;
    }

    onSaveTemplate({
      id: formData.id,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      targetDbType: formData.targetDbType,
    });
    setIsDialogOpen(false);
    toast({
      title: formData.id ? 'Template Updated' : 'Template Created',
      description: `Monitoring template "${formData.name}" [${formData.targetDbType}] saved successfully.`,
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
    onSaveMetric({
      ...metric,
      templateId: null,
      templateName: null,
    });
    toast({
      title: 'Metric Removed from Template',
      description: `Metric "${metric.name}" has been unbundled from template.`,
      type: 'info',
    });
  };

  // Add metric to template
  const handleAddMetricToTemplate = () => {
    if (!selectedMetricToAdd || !metricManagerTemplate) return;
    const targetMetric = metrics.find((m) => m.id === selectedMetricToAdd);
    if (!targetMetric) return;

    onSaveMetric({
      ...targetMetric,
      templateId: metricManagerTemplate.id,
      templateName: metricManagerTemplate.name,
      isEnabled: true,
    });

    setSelectedMetricToAdd('');
    toast({
      title: 'Metric Attached',
      description: `Metric "${targetMetric.name}" attached to "${metricManagerTemplate.name}".`,
      type: 'success',
    });
  };

  const engineColors: Record<string, string> = {
    ORACLE: 'text-red-700 bg-red-50 border-red-200',
    POSTGRES: 'text-blue-700 bg-blue-50 border-blue-200',
    MYSQL: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    MSSQL: 'text-purple-700 bg-purple-50 border-purple-200',
    ALL: 'text-slate-700 bg-slate-100 border-slate-200',
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
      header: 'Engine Compatibility',
      accessorKey: 'targetDbType',
      width: '160px',
      cell: (row) => {
        const engine = row.targetDbType || 'ALL';
        return (
          <span className={`px-2 py-0.5 border rounded text-[10px] font-bold tracking-wider ${engineColors[engine] || engineColors.ALL}`}>
            {engine === 'ALL' ? 'UNIVERSAL' : `${engine} ONLY`}
          </span>
        );
      },
    },
    {
      header: 'Bundled Metrics Status',
      width: '240px',
      cell: (row) => {
        const templateMetrics = metrics.filter((m) => m.templateId === row.id);
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
    ? metrics.filter((m) => m.templateId === metricManagerTemplate.id)
    : [];

  const availableMetricsToAdd = metricManagerTemplate
    ? metrics.filter((m) => m.templateId !== metricManagerTemplate.id)
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
              <span className={`px-2 py-0.5 border rounded text-[10px] font-bold tracking-wider ${engineColors[metricManagerTemplate.targetDbType || 'ALL']}`}>
                {metricManagerTemplate.targetDbType || 'UNIVERSAL'}
              </span>
            </div>

            {/* Add Metric to Template Bar */}
            {userRole === 'ADMIN' && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-200/70 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 block text-xs">Attach Metric to This Template</span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMetricToAdd}
                    onChange={(e) => setSelectedMetricToAdd(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Select an existing metric to add --</option>
                    {availableMetricsToAdd.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.templateName ? `Currently in: ${m.templateName}` : 'Standalone'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddMetricToTemplate}
                    disabled={!selectedMetricToAdd}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    Add to Template
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
                              every {m.frequencyMinutes}m
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
              Target Database Engine Compatibility *
            </label>
            <select
              value={formData.targetDbType}
              onChange={(e) => setFormData({ ...formData, targetDbType: e.target.value as DbEngine | 'ALL' })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="POSTGRES">PostgreSQL (Compatible with Postgres instances)</option>
              <option value="ORACLE">Oracle Database (Compatible with Oracle instances)</option>
              <option value="MYSQL">MySQL Server (Compatible with MySQL instances)</option>
              <option value="MSSQL">Microsoft SQL Server (Compatible with SQL Server instances)</option>
              <option value="ALL">Universal (Compatible with all engines)</option>
            </select>
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
