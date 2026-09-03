import React, { useState, useMemo, useRef } from 'react';
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
  Search,
  Download,
  Upload,
  FileJson,
  Filter,
  ChevronDown,
  AlertTriangle,
  FileText,
  Cog
} from 'lucide-react';
import { DbEngine, MetricEntity, TemplateEntity, UserRole, DatabaseEngineEntity } from '../../types';
import { DataTable, Column } from '../tables/DataTable';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n';

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
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEngineFilter, setSelectedEngineFilter] = useState<string>('ALL');
  const [selectedMonitorTypeFilter, setSelectedMonitorTypeFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateEntity | null>(null);

  // Import JSON Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    type: 'SINGLE' | 'BUNDLE';
    templates: Array<{
      name: string;
      description?: string | null;
      targetDbType?: string;
      databaseEngineCode?: string;
      metrics: Array<{
        name: string;
        sqlQuery: string;
        valueType?: string;
        relationalOperator?: string;
        thresholdWarn?: string | null;
        thresholdHigh?: string | null;
        thresholdCritical?: string | null;
        cycle?: number;
        isEnabled?: boolean;
        noAlertRequired?: boolean;
        metricQueryType?: 1 | 2 | 3;
        thresholdsConfig?: any;
      }>;
    }>;
  } | null>(null);
  const [importEngineId, setImportEngineId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ----------------------------------------------------
  // EXPORT TEMPLATE TO JSON
  // ----------------------------------------------------
  const handleExportTemplate = (tpl: TemplateEntity) => {
    if (userRole !== 'ADMIN') {
      toast({
        title: 'Permission Denied',
        description: 'Only administrators can export monitoring templates.',
        type: 'error',
      });
      return;
    }

    const linkedMetrics = metrics.filter(
      (m) => m.templateIds?.includes(tpl.id) || m.templateId === tpl.id
    );

    const matchedEngine = tpl.databaseEngine || databaseEngines.find((e) => e.id === tpl.databaseEngineId || e.dbCode.toUpperCase() === tpl.targetDbType?.toUpperCase());
    const engineCode = matchedEngine ? matchedEngine.dbCode : (tpl.targetDbType || 'ALL');

    const exportPayload = {
      $schema: 'https://database-monitoring/schema/template-v1.json',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'MONITORING_TEMPLATE',
      template: {
        id: tpl.id,
        name: tpl.name,
        description: tpl.description || null,
        targetDbType: engineCode,
        databaseEngineCode: engineCode,
      },
      metrics: linkedMetrics.map((m) => ({
        name: m.name,
        sqlQuery: m.sqlQuery,
        valueType: m.valueType || 'NUMBER',
        relationalOperator: m.relationalOperator || m.thresholdOperator || '>=',
        thresholdWarn: m.thresholdWarn || null,
        thresholdHigh: m.thresholdHigh || null,
        thresholdCritical: m.thresholdCritical || null,
        cycle: m.cycle ?? 1,
        isEnabled: m.isEnabled !== false,
        noAlertRequired: m.noAlertRequired || false,
        metricQueryType: m.metricQueryType || 1,
        thresholdsConfig: m.thresholdsConfig || null,
      })),
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = tpl.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    a.href = url;
    a.download = `template_${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Template Exported',
      description: `Exported "${tpl.name}" with ${linkedMetrics.length} linked metrics to JSON.`,
      type: 'success',
    });
  };

  const handleExportAllTemplates = () => {
    if (userRole !== 'ADMIN') {
      toast({
        title: 'Permission Denied',
        description: 'Only administrators can export monitoring templates.',
        type: 'error',
      });
      return;
    }

    const exportBundle = {
      $schema: 'https://database-monitoring/schema/template-bundle-v1.json',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'MONITORING_TEMPLATE_BUNDLE',
      templates: templates.map((tpl) => {
        const linkedMetrics = metrics.filter(
          (m) => m.templateIds?.includes(tpl.id) || m.templateId === tpl.id
        );
        const matchedEngine = tpl.databaseEngine || databaseEngines.find((e) => e.id === tpl.databaseEngineId || e.dbCode.toUpperCase() === tpl.targetDbType?.toUpperCase());
        const engineCode = matchedEngine ? matchedEngine.dbCode : (tpl.targetDbType || 'ALL');

        return {
          template: {
            id: tpl.id,
            name: tpl.name,
            description: tpl.description || null,
            targetDbType: engineCode,
            databaseEngineCode: engineCode,
          },
          metrics: linkedMetrics.map((m) => ({
            name: m.name,
            sqlQuery: m.sqlQuery,
            valueType: m.valueType || 'NUMBER',
            relationalOperator: m.relationalOperator || m.thresholdOperator || '>=',
            thresholdWarn: m.thresholdWarn || null,
            thresholdHigh: m.thresholdHigh || null,
            thresholdCritical: m.thresholdCritical || null,
            cycle: m.cycle ?? 1,
            isEnabled: m.isEnabled !== false,
            noAlertRequired: m.noAlertRequired || false,
            metricQueryType: m.metricQueryType || 1,
            thresholdsConfig: m.thresholdsConfig || null,
          })),
        };
      }),
    };

    const jsonString = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_monitoring_templates_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Templates Exported',
      description: `Exported bundle with ${templates.length} templates to JSON.`,
      type: 'success',
    });
  };

  // ----------------------------------------------------
  // IMPORT TEMPLATE FROM JSON
  // ----------------------------------------------------
  const parseJsonContent = (content: string) => {
    setImportFileError(null);
    setImportPreview(null);

    try {
      const parsed = JSON.parse(content);
      if (!parsed) throw new Error('Empty or invalid JSON payload');

      // Case 1: Template Bundle
      if (parsed.type === 'MONITORING_TEMPLATE_BUNDLE' && Array.isArray(parsed.templates)) {
        const tpls = parsed.templates.map((item: any) => ({
          name: item.template?.name || item.name || 'Imported Template',
          description: item.template?.description || item.description || null,
          targetDbType: item.template?.targetDbType || item.targetDbType || 'ALL',
          databaseEngineCode: item.template?.databaseEngineCode || item.targetDbType || 'ALL',
          metrics: Array.isArray(item.metrics) ? item.metrics : [],
        }));
        setImportPreview({ type: 'BUNDLE', templates: tpls });
        return;
      }

      // Case 2: Array of templates or items
      if (Array.isArray(parsed)) {
        const tpls = parsed.map((item: any) => ({
          name: item.template?.name || item.name || 'Imported Template',
          description: item.template?.description || item.description || null,
          targetDbType: item.template?.targetDbType || item.targetDbType || 'ALL',
          databaseEngineCode: item.template?.databaseEngineCode || item.targetDbType || 'ALL',
          metrics: Array.isArray(item.metrics) ? item.metrics : [],
        }));
        setImportPreview({ type: 'BUNDLE', templates: tpls });
        return;
      }

      // Case 3: Single Template object
      const tplObj = parsed.template || parsed;
      const templateName = tplObj.name;
      if (!templateName || typeof templateName !== 'string') {
        throw new Error('JSON is missing required template "name" property.');
      }

      const metricsList = Array.isArray(parsed.metrics)
        ? parsed.metrics
        : Array.isArray(tplObj.metrics)
        ? tplObj.metrics
        : [];

      setImportPreview({
        type: 'SINGLE',
        templates: [
          {
            name: templateName,
            description: tplObj.description || null,
            targetDbType: tplObj.targetDbType || tplObj.databaseEngineCode || 'ALL',
            databaseEngineCode: tplObj.databaseEngineCode || tplObj.targetDbType || 'ALL',
            metrics: metricsList,
          },
        ],
      });
    } catch (err: any) {
      setImportFileError(`Failed to parse JSON: ${err.message || 'Invalid format'}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
      parseJsonContent(text);
    };
    reader.onerror = () => {
      setImportFileError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (userRole !== 'ADMIN') {
      toast({
        title: 'Permission Denied',
        description: 'Only administrators can import monitoring templates.',
        type: 'error',
      });
      return;
    }

    if (!importPreview || importPreview.templates.length === 0) {
      toast({ title: 'Validation Error', description: 'No valid template data to import.', type: 'error' });
      return;
    }

    let totalTemplatesImported = 0;
    let totalMetricsImported = 0;

    for (const item of importPreview.templates) {
      const dbCode = item.targetDbType || item.databaseEngineCode || 'ALL';
      let matchedEngine = databaseEngines.find(
        (e) => e.dbCode.toUpperCase() === dbCode.toUpperCase() || e.id === importEngineId
      );
      if (importEngineId && importEngineId !== 'AUTO') {
        matchedEngine = databaseEngines.find((e) => e.id === importEngineId);
      }

      const resolvedEngineId = matchedEngine ? matchedEngine.id : null;
      const resolvedDbType = matchedEngine ? matchedEngine.dbCode : (dbCode || 'ALL');

      // 1. Create or Save Template
      const newTemplateId = `tpl-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      onSaveTemplate({
        id: newTemplateId,
        name: item.name.trim(),
        description: item.description || null,
        databaseEngineId: resolvedEngineId,
        targetDbType: resolvedDbType,
      });
      totalTemplatesImported++;

      // 2. Create/attach all metrics
      if (Array.isArray(item.metrics) && item.metrics.length > 0) {
        for (const m of item.metrics) {
          if (!m.name || !m.sqlQuery) continue;
          const metricId = `met-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          onSaveMetric({
            id: metricId,
            name: m.name.trim(),
            sqlQuery: m.sqlQuery,
            valueType: (m.valueType as any) || 'NUMBER',
            relationalOperator: (m.relationalOperator as any) || '>=',
            thresholdWarn: m.thresholdWarn || null,
            thresholdHigh: m.thresholdHigh || null,
            thresholdCritical: m.thresholdCritical || null,
            cycle: m.cycle ?? 1,
            templateIds: [newTemplateId],
            templateId: newTemplateId,
            templateName: item.name.trim(),
            isEnabled: m.isEnabled !== false,
            noAlertRequired: !!m.noAlertRequired,
            metricQueryType: m.metricQueryType || 1,
            thresholdsConfig: m.thresholdsConfig || null,
            databaseEngineId: resolvedEngineId,
          });
          totalMetricsImported++;
        }
      }
    }

    setIsImportModalOpen(false);
    setImportJsonText('');
    setImportPreview(null);
    setImportFileError(null);

    toast({
      title: 'Import Completed',
      description: `Successfully imported ${totalTemplatesImported} template(s) and ${totalMetricsImported} probe metric(s).`,
      type: 'success',
    });
  };

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
      header: t('templates.templateName'),
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
      header: t('templates.targetEngine'),
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
      header: t('templates.metricCount'),
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
      header: t('templates.actions'),
      align: 'right',
      width: '190px',
      cell: (row) => (
        userRole === 'ADMIN' ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setMetricManagerTemplate(row)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
              title="Manage bundled metrics"
            >
              <Cog className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleExportTemplate(row)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
              title="Export template & metrics to JSON"
            >
              <Download className="w-3.5 h-3.5" />
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
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setMetricManagerTemplate(row)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
            >
              View Metrics
            </button>
          </div>
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

  // Filter templates by search term, database engine, and monitor type
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // 1. Text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch =
          t.name.toLowerCase().includes(term) ||
          (t.description && t.description.toLowerCase().includes(term)) ||
          (t.targetDbType && t.targetDbType.toLowerCase().includes(term));
        if (!matchesSearch) return false;
      }

      // 2. Database Engine Filter
      if (selectedEngineFilter !== 'ALL') {
        const engine = t.databaseEngine || databaseEngines.find((e) => e.id === t.databaseEngineId || e.dbCode.toUpperCase() === t.targetDbType?.toUpperCase());
        const tplEngineCode = engine ? engine.dbCode.toUpperCase() : (t.targetDbType?.toUpperCase() || 'ALL');
        if (tplEngineCode !== selectedEngineFilter.toUpperCase() && tplEngineCode !== 'ALL') {
          return false;
        }
      }

      // 3. Monitor Type Filter
      if (selectedMonitorTypeFilter !== 'ALL') {
        const targetType = parseInt(selectedMonitorTypeFilter, 10);
        const linkedMetrics = metrics.filter((m) => m.templateIds?.includes(t.id) || m.templateId === t.id);
        const hasMatchingType = linkedMetrics.some((m) => (m.metricQueryType || 1) === targetType);
        if (!hasMatchingType) return false;
      }

      return true;
    });
  }, [templates, searchTerm, selectedEngineFilter, selectedMonitorTypeFilter, databaseEngines, metrics]);

  const totalPages = Math.ceil(filteredTemplates.length / pageSize) || 1;
  const paginatedTemplates = filteredTemplates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Available unique engine codes for the filter dropdown
  const availableEngineFilterOptions = useMemo(() => {
    const codes = new Set<string>();
    databaseEngines.forEach((e) => {
      if (e.dbCode) codes.add(e.dbCode.toUpperCase());
    });
    templates.forEach((t) => {
      if (t.targetDbType) codes.add(t.targetDbType.toUpperCase());
    });
    return Array.from(codes).filter((c) => c !== 'ALL');
  }, [databaseEngines, templates]);

  const activeFiltersCount = (selectedEngineFilter !== 'ALL' ? 1 : 0) + (selectedMonitorTypeFilter !== 'ALL' ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Information Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900">{t('templates.guidanceTitle')}</span> {t('templates.guidanceDesc')}
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>{t('templates.title')}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {t('templates.subtitle')} ({t('templates.totalActiveTemplates')}: {templates.length} {activeFiltersCount > 0 && `| Filtered: ${filteredTemplates.length}`})
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Export All Templates */}
            {userRole === 'ADMIN' && (
              <button
                onClick={handleExportAllTemplates}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs px-3 py-2 rounded-lg font-medium transition-colors shadow-2xs cursor-pointer shrink-0"
                title="Export all templates and metrics to JSON"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('templates.exportAll')}</span>
              </button>
            )}

            {/* Import Template Button */}
            {userRole === 'ADMIN' && (
              <button
                onClick={() => {
                  setImportJsonText('');
                  setImportPreview(null);
                  setImportFileError(null);
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs px-3 py-2 rounded-lg font-medium transition-colors shadow-2xs cursor-pointer shrink-0"
                title="Import template and metrics from JSON file"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('templates.importJson')}</span>
              </button>
            )}

            {userRole === 'ADMIN' ? (
              <button
                onClick={openCreateDialog}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                {t('templates.newTemplate')}
              </button>
            ) : (
              <div className="text-xs text-slate-400 italic flex items-center gap-1.5 shrink-0">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                View-Only Mode
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar: Database Engine, Monitor Type, Search Term */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filters:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex items-center gap-2.5 flex-1">
            {/* Filter by Database Engine */}
            <div className="relative min-w-[170px]">
              <select
                value={selectedEngineFilter}
                onChange={(e) => {
                  setSelectedEngineFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none bg-slate-50 border border-slate-300 text-xs pl-3 pr-8 py-1.5 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
              >
                <option value="ALL">All Database Engines</option>
                {availableEngineFilterOptions.map((code) => {
                  const eng = databaseEngines.find((e) => e.dbCode.toUpperCase() === code.toUpperCase());
                  return (
                    <option key={code} value={code}>
                      {eng ? `${eng.dbName} (${eng.dbCode})` : code}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Filter by Monitor Type */}
            <div className="relative min-w-[180px]">
              <select
                value={selectedMonitorTypeFilter}
                onChange={(e) => {
                  setSelectedMonitorTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none bg-slate-50 border border-slate-300 text-xs pl-3 pr-8 py-1.5 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
              >
                <option value="ALL">All Monitor Types</option>
                <option value="1">Type 1 (Single Metric)</option>
                <option value="2">Type 2 (Multi-Object)</option>
                <option value="3">Type 3 (JSON Attribute Matrix)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Search by Template Name / Description */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates..."
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
                  setSelectedEngineFilter('ALL');
                  setSelectedMonitorTypeFilter('ALL');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                title="Reset all active filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
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

      {/* Dialog for Import Template from JSON */}
      <Dialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Template from JSON"
        description="Import template definitions and bundled probe metrics from a JSON file or raw JSON content."
      >
        <div className="space-y-4 text-xs">
          {/* File Upload Dropzone */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Upload JSON File</label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 rounded-xl p-5 text-center cursor-pointer transition-colors"
            >
              <FileJson className="w-8 h-8 mx-auto text-indigo-600 mb-2" />
              <p className="font-semibold text-slate-800">
                Click to browse or drop a template .json file
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Supports single template JSON or template bundle format</p>
            </div>
          </div>

          {/* Or Paste Raw JSON */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-semibold">Or Paste JSON Payload</label>
              {importJsonText && (
                <button
                  type="button"
                  onClick={() => {
                    setImportJsonText('');
                    setImportPreview(null);
                    setImportFileError(null);
                  }}
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Text
                </button>
              )}
            </div>
            <textarea
              rows={4}
              placeholder='{ "template": { "name": "PostgreSQL Probes", ... }, "metrics": [ ... ] }'
              value={importJsonText}
              onChange={(e) => {
                const txt = e.target.value;
                setImportJsonText(txt);
                if (txt.trim()) {
                  parseJsonContent(txt);
                } else {
                  setImportPreview(null);
                  setImportFileError(null);
                }
              }}
              className="w-full font-mono text-[11px] bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Error Banner */}
          {importFileError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Invalid JSON Template</p>
                <p className="text-[11px] mt-0.5 text-rose-600">{importFileError}</p>
              </div>
            </div>
          )}

          {/* Parsed Preview Section */}
          {importPreview && importPreview.templates.length > 0 && (
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Found {importPreview.templates.length} Template(s) to Import
                </span>
                <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                  Total Metrics: {importPreview.templates.reduce((acc, t) => acc + t.metrics.length, 0)}
                </span>
              </div>

              {/* Template Previews List */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {importPreview.templates.map((tpl, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{tpl.name}</span>
                        </div>
                        {tpl.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{tpl.description}</p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300 uppercase shrink-0">
                        {tpl.targetDbType || tpl.databaseEngineCode || 'ALL'}
                      </span>
                    </div>

                    {/* Metrics sample */}
                    <div className="pt-1.5 border-t border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-600 mb-1">
                        Bundled Metrics ({tpl.metrics.length}):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tpl.metrics.map((m, mIdx) => (
                          <span
                            key={mIdx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded text-[10px] font-medium"
                            title={m.sqlQuery}
                          >
                            <Gauge className="w-2.5 h-2.5 text-indigo-500" />
                            <span className="truncate max-w-[150px]">{m.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Optional Target Engine Assignment Override */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Assign Database Engine Catalog Target
                </label>
                <select
                  value={importEngineId}
                  onChange={(e) => setImportEngineId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="">Auto-detect from template file</option>
                  {databaseEngines.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.dbName} ({eng.dbCode})
                    </option>
                  ))}
                  <option value="ALL">Universal (All Engines)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Leave as auto-detect or choose a specific registered database engine to assign all imported metrics and templates.
                </p>
              </div>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={!importPreview || importPreview.templates.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                Import {importPreview?.templates.length ? `(${importPreview.templates.length}) Template(s)` : 'Template'}
              </span>
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
