import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Gauge,
  Code2,
  ShieldCheck,
  AlertCircle,
  Clock,
  Layers,
  Shield,
  CheckCircle2,
  XCircle,
  Sliders,
  Search,
  Info,
  FolderPlus,
  BellOff,
} from 'lucide-react';
import { MetricEntity, MetricValueType, RelationalOperator, TemplateEntity, UserRole, DatabaseEngineEntity } from '../../types';
import { DataTable, Column } from '../tables/DataTable';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { validateMetricSqlQuery } from '../../lib/sqlValidator';

interface MetricsViewProps {
  metrics: MetricEntity[];
  templates: TemplateEntity[];
  databaseEngines: DatabaseEngineEntity[];
  userRole: UserRole;
  showInfoTips?: boolean;
  onSaveMetric: (metric: Partial<MetricEntity>) => void;
  onDeleteMetric: (id: string) => void;
}

export const MetricsView: React.FC<MetricsViewProps> = ({
  metrics,
  templates,
  databaseEngines = [],
  userRole,
  showInfoTips = true,
  onSaveMetric,
  onDeleteMetric,
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricEntity | null>(null);
  const [sqlValidationError, setSqlValidationError] = useState<string | null>(null);

  // Quick Assign Template Modal State
  const [assignMetricModal, setAssignMetricModal] = useState<MetricEntity | null>(null);
  const [selectedAssignTemplateIds, setSelectedAssignTemplateIds] = useState<Set<string>>(new Set());
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');

  // Top 3 Recently Updated Templates
  const top3Templates = useMemo(() => {
    return [...templates]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 3);
  }, [templates]);

  // Filtered Templates for Modal Dropdown
  const filteredAssignTemplates = useMemo(() => {
    if (!templateSearchQuery.trim()) return templates;
    const q = templateSearchQuery.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q) || (t.targetDbType && t.targetDbType.toLowerCase().includes(q)));
  }, [templates, templateSearchQuery]);

  // Form State
  const [type3Attributes, setType3Attributes] = useState<Array<{
    attributeName: string;
    valueType: MetricValueType;
    operator?: RelationalOperator;
    warn: string;
    high: string;
    critical: string;
  }>>([]);

  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    sqlQuery: string;
    valueType: MetricValueType;
    databaseEngineId: string;
    thresholdOperator: RelationalOperator;
    thresholdWarn: string;
    thresholdHigh: string;
    thresholdCritical: string;
    cycle: number;
    templateId: string;
    templateIds: string[];
    isEnabled: boolean;
    noAlertRequired: boolean;
    metricQueryType: 1 | 2 | 3;
    thresholdsConfig: any;
  }>({
    name: '',
    sqlQuery: 'SELECT username AS name, COUNT(*) AS value FROM v$session WHERE status = \'ACTIVE\' GROUP BY username',
    valueType: 'NUMBER',
    databaseEngineId: '',
    thresholdOperator: '>=',
    thresholdWarn: '80',
    thresholdHigh: '90',
    thresholdCritical: '95',
    cycle: 1,
    templateId: '',
    templateIds: [],
    isEnabled: true,
    noAlertRequired: false,
    metricQueryType: 1,
    thresholdsConfig: null,
  });

  const openCreateDialog = () => {
    setEditingMetric(null);
    setSqlValidationError(null);
    setType3Attributes([
      { attributeName: 'value', valueType: 'NUMBER', operator: '>=', warn: '80', high: '90', critical: '95' },
    ]);
    setFormData({
      name: '',
      sqlQuery: 'SELECT count(*) AS value FROM pg_stat_activity WHERE state = \'active\'',
      valueType: 'NUMBER',
      databaseEngineId: '',
      thresholdOperator: '>=',
      thresholdWarn: '80',
      thresholdHigh: '90',
      thresholdCritical: '95',
      cycle: 1,
      templateId: '',
      templateIds: [],
      isEnabled: true,
      noAlertRequired: false,
      metricQueryType: 1,
      thresholdsConfig: null,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (metric: MetricEntity) => {
    setEditingMetric(metric);
    setSqlValidationError(null);
    const queryType = metric.metricQueryType || 1;
    const threshConfig = metric.thresholdsConfig || null;

    let t3Attrs: Array<{
      attributeName: string;
      valueType: MetricValueType;
      operator?: RelationalOperator;
      warn: string;
      high: string;
      critical: string;
    }> = [];
    if (threshConfig && Array.isArray(threshConfig.perAttribute) && threshConfig.perAttribute.length > 0) {
      t3Attrs = threshConfig.perAttribute.map((attr: any) => ({
        attributeName: attr.attributeName || '',
        valueType: (attr.valueType as MetricValueType) || metric.valueType || 'NUMBER',
        operator: attr.operator || metric.thresholdOperator || '>=',
        warn: attr.warn || '',
        high: attr.high || '',
        critical: attr.critical || '',
      }));
    } else {
      t3Attrs = [
        {
          attributeName: 'value',
          valueType: metric.valueType || 'NUMBER',
          operator: metric.thresholdOperator || '>=',
          warn: metric.thresholdWarn || '',
          high: metric.thresholdHigh || '',
          critical: metric.thresholdCritical || '',
        },
      ];
    }
    setType3Attributes(t3Attrs);

    setFormData({
      id: metric.id,
      name: metric.name,
      sqlQuery: metric.sqlQuery,
      valueType: metric.valueType,
      databaseEngineId: metric.databaseEngineId || '',
      thresholdOperator: metric.relationalOperator || metric.thresholdOperator || '>=',
      thresholdWarn: metric.thresholdWarn || '',
      thresholdHigh: metric.thresholdHigh || '',
      thresholdCritical: metric.thresholdCritical || '',
      cycle: metric.cycle ?? 1,
      templateId: metric.templateId || '',
      templateIds: metric.templateIds || (metric.templateId ? [metric.templateId] : []),
      isEnabled: metric.isEnabled !== false,
      noAlertRequired: metric.noAlertRequired === true,
      metricQueryType: queryType as 1 | 2 | 3,
      thresholdsConfig: threshConfig,
    });
    setIsDialogOpen(true);
  };

  const handleToggleState = (metric: MetricEntity) => {
    const nextState = !metric.isEnabled;
    onSaveMetric({
      ...metric,
      isEnabled: nextState,
    });
    toast({
      title: nextState ? 'Metric Monitoring Activated' : 'Metric Monitoring Paused',
      description: `"${metric.name}" active state is now ${nextState ? 'ON' : 'OFF'}.`,
      type: 'info',
    });
  };

  const handleValueTypeChange = (newType: MetricValueType) => {
    let defaultOp: RelationalOperator = '>=';
    if (newType === 'NUMBER') {
      defaultOp = '>=';
    } else if (newType === 'BOOLEAN') {
      defaultOp = '=';
    } else if (newType === 'STRING') {
      defaultOp = 'CONTAINS';
    }
    setFormData((prev) => ({
      ...prev,
      valueType: newType,
      thresholdOperator: defaultOp,
    }));
  };

  const handleSqlQueryChange = (query: string, qType?: 1 | 2 | 3) => {
    setFormData((prev) => ({ ...prev, sqlQuery: query }));
    const targetType = qType !== undefined ? qType : formData.metricQueryType;
    if (query.trim().length > 0) {
      const validation = validateMetricSqlQuery(query, targetType);
      setSqlValidationError(validation.isValid ? null : validation.error || 'Invalid query');
    } else {
      setSqlValidationError('SQL Query cannot be empty.');
    }
  };

  const handleAssignToTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignMetricModal) return;
    const tplIds = Array.from(selectedAssignTemplateIds);
    const firstTpl = templates.find((t) => t.id === tplIds[0]);
    onSaveMetric({
      ...assignMetricModal,
      templateId: tplIds[0] || null,
      templateName: firstTpl?.name || null,
      templateIds: tplIds,
    });
    setAssignMetricModal(null);
    toast({
      title: 'Template Associations Updated',
      description: `Metric "${assignMetricModal.name}" updated with ${tplIds.length} template assignment(s).`,
      type: 'success',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Metric name is required.', type: 'error' });
      return;
    }

    // Strict SQL validation
    const validation = validateMetricSqlQuery(formData.sqlQuery);
    if (!validation.isValid) {
      setSqlValidationError(validation.error || 'Invalid SQL query');
      toast({
        title: 'Security Validation Failed',
        description: validation.error || 'Query contains forbidden statements or chaining.',
        type: 'error',
      });
      return;
    }

    const firstTemplateId = formData.templateIds?.[0] || null;
    const selectedTemplate = templates.find((t) => t.id === firstTemplateId);

    let thresholdsConfig: any = null;
    if (formData.metricQueryType === 3) {
      thresholdsConfig = {
        type: 'PER_ATTRIBUTE',
        perAttribute: type3Attributes.filter(a => a.attributeName.trim()).map(a => {
          if (a.valueType === 'BOOLEAN') {
            let severity: 'critical' | 'high' | 'warn' = 'critical';
            let val = 'TRUE';
            if (a.critical === 'TRUE' || a.critical === 'FALSE') {
              severity = 'critical';
              val = a.critical;
            } else if (a.high === 'TRUE' || a.high === 'FALSE') {
              severity = 'high';
              val = a.high;
            } else if (a.warn === 'TRUE' || a.warn === 'FALSE') {
              severity = 'warn';
              val = a.warn;
            }

            return {
              attributeName: a.attributeName.trim(),
              valueType: 'BOOLEAN',
              operator: '=',
              warn: severity === 'warn' ? val : undefined,
              high: severity === 'high' ? val : undefined,
              critical: severity === 'critical' ? val : undefined,
            };
          }

          let warnVal = a.warn ? a.warn.trim() : '';
          let highVal = a.high ? a.high.trim() : '';
          let critVal = a.critical ? a.critical.trim() : '';

          return {
            attributeName: a.attributeName.trim(),
            valueType: a.valueType || 'NUMBER',
            operator: a.operator || '>=',
            warn: warnVal || undefined,
            high: highVal || undefined,
            critical: critVal || undefined,
          };
        }),
      };
    } else {
      thresholdsConfig = {
        type: 'GLOBAL',
        global: {
          warn: formData.thresholdWarn ? formData.thresholdWarn.trim() : undefined,
          high: formData.thresholdHigh ? formData.thresholdHigh.trim() : undefined,
          critical: formData.thresholdCritical ? formData.thresholdCritical.trim() : undefined,
        }
      };
    }

    const payload: Partial<MetricEntity> = {
      id: formData.id,
      name: formData.name.trim(),
      sqlQuery: formData.sqlQuery.trim(),
      valueType: formData.valueType,
      databaseEngineId: formData.databaseEngineId || null,
      relationalOperator: formData.thresholdOperator,
      thresholdOperator: formData.thresholdOperator,
      thresholdWarn: formData.metricQueryType === 3 ? null : (formData.thresholdWarn ? formData.thresholdWarn.trim() : null),
      thresholdHigh: formData.metricQueryType === 3 ? null : (formData.thresholdHigh ? formData.thresholdHigh.trim() : null),
      thresholdCritical: formData.metricQueryType === 3 ? null : (formData.thresholdCritical ? formData.thresholdCritical.trim() : null),
      cycle: Math.max(1, Number(formData.cycle) || 1),
      templateId: firstTemplateId,
      templateName: selectedTemplate?.name || null,
      templateIds: formData.templateIds || [],
      isEnabled: formData.isEnabled,
      noAlertRequired: formData.noAlertRequired,
      metricQueryType: formData.metricQueryType,
      thresholdsConfig,
    };

    onSaveMetric(payload);
    setIsDialogOpen(false);
    toast({
      title: formData.id ? 'Metric Updated' : 'Metric Created',
      description: `Metric "${formData.name}" saved as Type ${formData.metricQueryType} with dynamic threshold architecture.`,
      type: 'success',
    });
  };

  const handleDelete = (metric: MetricEntity) => {
    if (confirm(`Are you sure you want to delete metric "${metric.name}"? This will cascade remove all associated active alerts.`)) {
      onDeleteMetric(metric.id);
      toast({ title: 'Metric Deleted', description: `Metric "${metric.name}" was removed.`, type: 'info' });
    }
  };

  const columns: Column<MetricEntity>[] = [
    {
      header: 'Metric Name & Query',
      accessorKey: 'name',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
            <Gauge className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>{row.name}</span>
            {row.noAlertRequired && (
              <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                <BellOff className="w-2.5 h-2.5" />
                No Alert
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-mono truncate max-w-sm mt-0.5" title={row.sqlQuery}>
            {row.sqlQuery}
          </div>
        </div>
      ),
    },
    {
      header: 'Database Engine',
      accessorKey: 'databaseEngineId',
      width: '140px',
      cell: (row) => {
        const engine = row.databaseEngine || (row.databaseEngineId ? databaseEngines.find((e) => e.id === row.databaseEngineId) : null);
        const engineCode = engine ? engine.dbCode : 'ALL';
        const dbColor = engine?.dbColor || '#64748B';

        return (
          <span
            className="text-xs font-bold font-mono px-2.5 py-1 rounded-md flex items-center gap-1.5 self-start max-w-fit uppercase shadow-2xs"
            title={engine ? `${engine.dbName} (${engine.dbCode})` : 'ALL (Universal / All Engines)'}
            style={{
              backgroundColor: dbColor + '15',
              color: dbColor,
              border: `1px solid ${dbColor}35`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dbColor }} />
            {engineCode}
          </span>
        );
      },
    },
    {
      header: 'Monitoring State',
      accessorKey: 'isEnabled',
      width: '130px',
      cell: (row) => {
        const isActive = row.isEnabled !== false;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleState(row)}
              disabled={userRole !== 'ADMIN'}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              } ${userRole !== 'ADMIN' ? 'cursor-not-allowed opacity-60' : ''}`}
              title={isActive ? 'Click to disable' : 'Click to enable'}
            >
              <span className="w-3.5 h-3.5 bg-white rounded-full shadow-xs transform transition-transform" />
            </button>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isActive ? 'Active' : 'Off'}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Thresholds (Operator & Warn/High/Crit)',
      width: '260px',
      cell: (row) => {
        const op = row.thresholdOperator || '>=';
        const isType3 = row.metricQueryType === 3;
        
        if (isType3 && row.thresholdsConfig && Array.isArray(row.thresholdsConfig.perAttribute)) {
          return (
            <div className="flex flex-col gap-1 text-[11px] max-w-[240px]">
              <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded self-start mb-1 text-[9px] uppercase tracking-wider">
                Type 3 (Multi-Attr)
              </span>
              {row.thresholdsConfig.perAttribute.map((attr: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-0.5 last:border-0 gap-2">
                  <span className="font-mono text-slate-600 font-semibold truncate max-w-[90px]" title={attr.attributeName}>
                    {attr.attributeName}:
                  </span>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <span className="text-amber-700 font-bold">{attr.warn || '—'}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-orange-700 font-bold">{attr.high || '—'}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-rose-700 font-bold">{attr.critical || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        }

        const queryTypeLabel = row.metricQueryType === 2 ? 'Type 2 (Multi-Obj)' : 'Type 1 (Single)';

        return (
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              {queryTypeLabel}
            </span>
            <div className="flex items-center gap-1.5">
              {row.valueType === 'NUMBER' && (
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[11px]">
                  {op}
                </span>
              )}
              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono text-[11px]">
                {row.thresholdWarn ?? '—'}
              </span>
              <span className="text-slate-400">/</span>
              <span className="text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 font-mono text-[11px]">
                {row.thresholdHigh ?? '—'}
              </span>
              <span className="text-slate-400">/</span>
              <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-mono text-[11px]">
                {row.thresholdCritical ?? '—'}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      header: (
        <span
          className="flex items-center justify-center gap-1 cursor-help"
          title="Execution frequency per database polling run. E.g., Cycle = 1 executes every query run, Cycle = 3 executes every 3rd query run."
        >
          Cycle
          <Info className="w-3 h-3 text-slate-400" />
        </span>
      ),
      accessorKey: 'cycle',
      width: '75px',
      align: 'center',
      cell: (row) => (
        <span
          className="text-xs text-slate-700 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block"
          title={`Cycle ${row.cycle ?? 1}: Executed every ${row.cycle ?? 1} database polling run(s).`}
        >
          {row.cycle ?? 1}
        </span>
      ),
    },
    {
      header: 'Template Bundle',
      width: '110px',
      cell: (row) => {
        const templateCount = row.templateIds?.length || (row.templateId ? 1 : 0);
        return (
          <button
            type="button"
            onClick={() => {
              setAssignMetricModal(row);
              setSelectedAssignTemplateIds(new Set(row.templateIds || (row.templateId ? [row.templateId] : [])));
              setTemplateSearchQuery('');
            }}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            title="Click to manage template association"
          >
            {templateCount}
          </button>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      width: '150px',
      cell: (row) => (
        userRole === 'ADMIN' ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => {
                setAssignMetricModal(row);
                setSelectedAssignTemplateIds(new Set(row.templateIds || (row.templateId ? [row.templateId] : [])));
                setTemplateSearchQuery('');
              }}
              className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer"
              title="Add Metric to Template"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => openEditDialog(row)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="Edit metric"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(row)}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="Delete metric"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-slate-400 text-xs italic">Read-only</span>
        )
      ),
    },
  ];

  // Filter metrics by search term
  const filteredMetrics = useMemo(() => {
    if (!searchTerm.trim()) return metrics;
    const term = searchTerm.toLowerCase().trim();
    return metrics.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.sqlQuery.toLowerCase().includes(term) ||
        (m.templateId && templates.find((t) => t.id === m.templateId)?.name.toLowerCase().includes(term))
    );
  }, [metrics, searchTerm, templates]);

  const totalPages = Math.ceil(filteredMetrics.length / pageSize) || 1;
  const paginatedMetrics = filteredMetrics.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Information Banner */}
      {showInfoTips && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <div>
              <span className="font-bold text-slate-900">Standardized Multi-Object Metric Architecture:</span> Metric SQL queries can yield <span className="text-indigo-700 font-semibold">multiple rows</span>, where each row represents an individual sub-entity/target object (<code className="text-indigo-600 font-mono font-bold">name</code>) and its corresponding measured reading (<code className="text-indigo-600 font-mono font-bold">value</code>).
            </div>
            <div className="text-slate-500 text-[11px]">
              Standardized Pattern: <code className="text-indigo-600 font-mono bg-indigo-50/70 px-1 py-0.5 rounded font-bold">SELECT &lt;object_identifier&gt; AS name, &lt;measured_attribute&gt; AS value FROM ...</code>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Metrics Management</h2>
          <p className="text-xs text-slate-500">
            Configured health check queries and alerting thresholds ({metrics.length}) {searchTerm && `(Filtered: ${filteredMetrics.length})`}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search by Metric Name */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Metric Name..."
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
              New Metric Check
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
          data={paginatedMetrics}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filteredMetrics.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          emptyMessage={
            searchTerm
              ? `No metric definitions found matching "${searchTerm}".`
              : 'No metric definitions configured.'
          }
        />
      </div>

      {/* Dialog for Create/Edit Metric */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingMetric ? `Edit Metric: ${editingMetric.name}` : 'Create Metric Check'}
        description="Write the SQL health probe query and configure threshold breach boundaries."
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Metric Query Type */}
          <div className="space-y-2">
            <label className="block text-slate-700 font-bold text-xs uppercase tracking-wider">Metric Query Type *</label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { type: 1, label: 'Type 1', desc: 'Single Attr of Single Obj' },
                { type: 2, label: 'Type 2', desc: 'Single Attr of Multi Objs' },
                { type: 3, label: 'Type 3', desc: 'Multi Attrs of Multi Objs' },
              ].map((item) => {
                const isActive = formData.metricQueryType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, metricQueryType: item.type as 1 | 2 | 3 }));
                      handleSqlQueryChange(formData.sqlQuery, item.type as 1 | 2 | 3);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50/80 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs">{item.label}</span>
                    <span className="text-[9px] text-slate-500 mt-0.5 leading-tight">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Metric Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tablespace Usage %"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Database Engine *</label>
              <select
                value={formData.databaseEngineId}
                onChange={(e) => setFormData({ ...formData, databaseEngineId: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">ALL (All Database Engines)</option>
                {databaseEngines.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.dbName} ({eng.dbCode})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Specify which database engine type this metric query belongs to, or choose ALL.
              </p>
            </div>
          </div>

          {/* Applied Templates Multi-Select */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Associated Templates (Multi-Template Selection)
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {formData.templateIds?.length || 0} of {templates.length} selected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Select the templates this metric should be assigned to. It will be evaluated on all databases inside groups with these templates applied.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-white border border-slate-200 rounded-lg">
              {templates.map((tpl) => {
                const isSelected = formData.templateIds?.includes(tpl.id) || false;
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
                        const currentIds = formData.templateIds || [];
                        if (e.target.checked) {
                          setFormData({ ...formData, templateIds: [...currentIds, tpl.id] });
                        } else {
                          setFormData({
                            ...formData,
                            templateIds: currentIds.filter((id) => id !== tpl.id),
                          });
                        }
                      }}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="truncate flex-1">
                      <div className="font-semibold truncate text-[11px]">{tpl.name}</div>
                      <div className="text-[9px] text-slate-500 font-mono font-bold">
                        {tpl.targetDbType || 'ALL'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Active State Toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 block text-xs">Active Monitoring State</span>
              <span className="text-[10px] text-slate-500">Whether the collector worker executes this query during polling cycles</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  formData.isEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <span className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" />
              </button>
              <span className="text-xs font-bold text-slate-700">
                {formData.isEnabled ? 'ACTIVE (ON)' : 'PAUSED (OFF)'}
              </span>
            </div>
          </div>

          {/* Query Command Field with Validator & Dynamic Schema Guidance */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 font-semibold flex items-center gap-1.5 text-xs">
                <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                Query Command *
              </label>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200">
                {formData.metricQueryType === 1
                  ? 'Type 1 Schema: [value] (1 column)'
                  : formData.metricQueryType === 2
                  ? 'Type 2 Schema: [name, value] (2 columns)'
                  : 'Type 3 Schema: [name, attribute, value] (3 columns)'}
              </span>
            </div>
            <textarea
              rows={3}
              required
              value={formData.sqlQuery}
              onChange={(e) => handleSqlQueryChange(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-3 text-emerald-800 font-mono text-xs focus:outline-none focus:border-indigo-500"
              placeholder={
                formData.metricQueryType === 1
                  ? "SELECT count(*) AS value FROM pg_stat_activity"
                  : formData.metricQueryType === 2
                  ? "SELECT datname AS name, numbackends AS value FROM pg_stat_database"
                  : "SELECT tablespace_name AS name, 'used_percent' AS attribute, used_percent AS value FROM dba_tablespace_usage_metrics"
              }
            />
            {sqlValidationError && (
              <div className="flex items-center gap-1.5 text-rose-600 text-[11px] bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{sqlValidationError}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Expected Return Value Type *</label>
              <select
                value={formData.valueType}
                onChange={(e) => handleValueTypeChange(e.target.value as MetricValueType)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                <option value="NUMBER">Numeric (Continuous / Gauge / Counter)</option>
                <option value="BOOLEAN">Boolean Flag (1/0, TRUE/FALSE, ON/OFF)</option>
                <option value="STRING">Text / Status Code</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  Cycle (Default: 1)
                  <span
                    className="cursor-help text-slate-400 hover:text-slate-600 transition-colors"
                    title="Execution frequency multiplier per database poll run. Cycle = 1 queries on every poll run; Cycle = 3 queries every 3rd poll run."
                  >
                    <Info className="w-3.5 h-3.5 inline" />
                  </span>
                </span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={formData.cycle}
                onChange={(e) => setFormData({ ...formData, cycle: Math.max(1, Number(e.target.value)) })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Execution frequency per database polling run (e.g., Cycle = 1 queries every run, Cycle = 3 queries every 3rd run).
              </p>
            </div>
          </div>

          {/* No Alert Required Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="space-y-0.5 pr-3">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <BellOff className="w-3.5 h-3.5 text-amber-600" />
                <span>No Alert Required</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Collect and graph telemetry measurements without triggering threshold breaches or dispatching incident alerts.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={formData.noAlertRequired}
                onChange={(e) => setFormData({ ...formData, noAlertRequired: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Conditional Dynamic Thresholds based on valueType and query type - Hidden when No Alert Required */}
          {!formData.noAlertRequired && (
            <>
              {formData.metricQueryType === 3 ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  Type 3 Multi-Attribute Threshold Topology
                </span>
                <button
                  type="button"
                  onClick={() => setType3Attributes(prev => [...prev, { attributeName: '', valueType: 'NUMBER', operator: '>=', warn: '', high: '', critical: '' }])}
                  className="px-2.5 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Attribute
                </button>
              </div>

              {type3Attributes.length === 0 ? (
                <div className="text-center py-6 bg-white border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
                  No attributes configured yet. Click "Add Attribute" above to define monitored metrics.
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {type3Attributes.map((attr, idx) => (
                    <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5 relative shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setType3Attributes(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-2.5 right-2.5 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                        title="Remove Attribute"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] text-slate-600 font-bold mb-0.5">Attribute Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. used_pct"
                            value={attr.attributeName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setType3Attributes(prev => prev.map((item, i) => i === idx ? { ...item, attributeName: val } : item));
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-indigo-700 font-bold mb-0.5">Return Value Type *</label>
                          <select
                            value={attr.valueType}
                            onChange={(e) => {
                              const vt = e.target.value as MetricValueType;
                              setType3Attributes(prev => prev.map((item, i) => {
                                if (i === idx) {
                                  let op: RelationalOperator = '>=';
                                  let crit = item.critical;
                                  let wrn = item.warn;
                                  let hgh = item.high;
                                  if (vt === 'BOOLEAN') {
                                    op = '=';
                                    crit = 'TRUE';
                                    wrn = '';
                                    hgh = '';
                                  } else if (vt === 'STRING') {
                                    op = 'CONTAINS';
                                  }
                                  return { ...item, valueType: vt, operator: op, critical: crit, warn: wrn, high: hgh };
                                }
                                return item;
                              }));
                            }}
                            className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs font-bold text-indigo-800 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="NUMBER">Numeric (Integer/Float)</option>
                            <option value="BOOLEAN">Boolean (True/False)</option>
                            <option value="STRING">String / Text</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Relational Operator</label>
                          <select
                            value={attr.operator || '>='}
                            onChange={(e) => {
                              const op = e.target.value as RelationalOperator;
                              setType3Attributes(prev => prev.map((item, i) => i === idx ? { ...item, operator: op } : item));
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-semibold text-slate-700 focus:outline-none focus:border-indigo-500"
                          >
                            <option value=">=">&gt;= (Greater or Equal)</option>
                            <option value="<=">&lt;= (Less or Equal)</option>
                            <option value="=">= (Equal)</option>
                            <option value="!=">!= (Not Equal)</option>
                            <option value="CONTAINS">CONTAINS (Substring)</option>
                            <option value="REGEX">REGEX (Pattern)</option>
                          </select>
                        </div>
                      </div>

                      {/* Threshold inputs based on attribute valueType */}
                      {attr.valueType === 'NUMBER' ? (
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <label className="block text-[10px] text-amber-700 font-semibold mb-0.5">Warning Threshold</label>
                            <input
                              type="text"
                              placeholder="e.g. 80"
                              value={attr.warn}
                              onChange={(e) => {
                                const val = e.target.value;
                                setType3Attributes(prev => prev.map((item, i) => i === idx ? { ...item, warn: val } : item));
                              }}
                              className="w-full bg-white border border-amber-300 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-orange-700 font-semibold mb-0.5">High Threshold</label>
                            <input
                              type="text"
                              placeholder="e.g. 90"
                              value={attr.high}
                              onChange={(e) => {
                                const val = e.target.value;
                                setType3Attributes(prev => prev.map((item, i) => i === idx ? { ...item, high: val } : item));
                              }}
                              className="w-full bg-white border border-orange-300 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-rose-700 font-semibold mb-0.5">Critical Threshold</label>
                            <input
                              type="text"
                              placeholder="e.g. 95"
                              value={attr.critical}
                              onChange={(e) => {
                                const val = e.target.value;
                                setType3Attributes(prev => prev.map((item, i) => i === idx ? { ...item, critical: val } : item));
                              }}
                              className="w-full bg-white border border-rose-300 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-rose-500"
                            />
                          </div>
                        </div>
                      ) : attr.valueType === 'BOOLEAN' ? (() => {
                        let severity: 'CRITICAL' | 'HIGH' | 'WARN' = 'CRITICAL';
                        let triggerVal = 'TRUE';
                        if (attr.critical === 'TRUE' || attr.critical === 'FALSE') {
                          severity = 'CRITICAL';
                          triggerVal = attr.critical;
                        } else if (attr.high === 'TRUE' || attr.high === 'FALSE') {
                          severity = 'HIGH';
                          triggerVal = attr.high;
                        } else if (attr.warn === 'TRUE' || attr.warn === 'FALSE') {
                          severity = 'WARN';
                          triggerVal = attr.warn;
                        }

                        return (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                            <div>
                              <label className="block text-[10px] text-indigo-700 font-semibold mb-0.5">Alert Level (Severity)</label>
                              <select
                                value={severity}
                                onChange={(e) => {
                                  const sev = e.target.value as 'CRITICAL' | 'HIGH' | 'WARN';
                                  setType3Attributes(prev => prev.map((item, i) => {
                                    if (i === idx) {
                                      return {
                                        ...item,
                                        critical: sev === 'CRITICAL' ? triggerVal : '',
                                        high: sev === 'HIGH' ? triggerVal : '',
                                        warn: sev === 'WARN' ? triggerVal : '',
                                      };
                                    }
                                    return item;
                                  }));
                                }}
                                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs font-bold text-indigo-800 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="CRITICAL">Critical</option>
                                <option value="HIGH">High</option>
                                <option value="WARN">Warning</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-rose-700 font-semibold mb-0.5">Alert When (Value)</label>
                              <select
                                value={triggerVal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setType3Attributes(prev => prev.map((item, i) => {
                                    if (i === idx) {
                                      return {
                                        ...item,
                                        critical: severity === 'CRITICAL' ? val : '',
                                        high: severity === 'HIGH' ? val : '',
                                        warn: severity === 'WARN' ? val : '',
                                      };
                                    }
                                    return item;
                                  }));
                                }}
                                className="w-full bg-white border border-rose-300 rounded px-2 py-1 text-xs font-bold text-rose-800 focus:outline-none focus:border-rose-500"
                              >
                                <option value="TRUE">TRUE</option>
                                <option value="FALSE">FALSE</option>
                              </select>
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <label className="block text-[10px] text-amber-700 font-semibold mb-0.5">Warn Pattern / Substring</label>
                            <input
                              type="text"
                              placeholder="e.g. DEGRADED"
                              value={attr.warn}
                              onChange={(e) => {
                                const val = e.target.value;
                                setType3Attributes(prev => prev.map((item, i) => i === idx ? { ...item, warn: val } : item));
                              }}
                              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-rose-700 font-semibold mb-0.5">Critical Pattern / Substring</label>
                            <input
                              type="text"
                              placeholder="e.g. ERROR|DOWN|FAILED"
                              value={attr.critical}
                              onChange={(e) => {
                                const val = e.target.value;
                                setType3Attributes(prev => prev.map((item, i) => i === idx ? { ...item, critical: val } : item));
                              }}
                              className="w-full bg-white border border-rose-300 rounded px-2.5 py-1 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`p-4 rounded-xl border space-y-3.5 transition-all ${
              formData.noAlertRequired ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Threshold Trigger Boundaries ({formData.valueType})
                  </span>
                  {formData.noAlertRequired && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                      Alerts Bypassed (Telemetry Mode)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Relational Operator:</span>
                  <select
                    value={formData.thresholdOperator}
                    onChange={(e) => setFormData({ ...formData, thresholdOperator: e.target.value as RelationalOperator })}
                    className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  >
                    {formData.valueType === 'NUMBER' ? (
                      <>
                        <option value=">=">&gt;= (Breach when value &gt;= threshold)</option>
                        <option value="<=">&lt;= (Breach when value &lt;= threshold)</option>
                      </>
                    ) : formData.valueType === 'BOOLEAN' ? (
                      <>
                        <option value="=">= (Equals - Breach when value equals threshold)</option>
                        <option value="!=">!= (Not Equals - Breach when value not equal threshold)</option>
                      </>
                    ) : (
                      <>
                        <option value="CONTAINS">CONTAINS (Substring Match)</option>
                        <option value="DOES_NOT_CONTAIN">DOES_NOT_CONTAIN (Substring Absence)</option>
                        <option value="=">= (Exact String Match)</option>
                        <option value="!=">!= (Not Equals)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

            {formData.valueType === 'NUMBER' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-2.5 rounded-lg border border-amber-200/80 shadow-2xs">
                  <label className="block text-amber-800 text-[11px] font-bold mb-1">
                    Warning ({formData.thresholdOperator})
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 80"
                    value={formData.thresholdWarn}
                    onChange={(e) => setFormData({ ...formData, thresholdWarn: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-orange-200/80 shadow-2xs">
                  <label className="block text-orange-800 text-[11px] font-bold mb-1">
                    High ({formData.thresholdOperator})
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 90"
                    value={formData.thresholdHigh}
                    onChange={(e) => setFormData({ ...formData, thresholdHigh: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-rose-200/80 shadow-2xs">
                  <label className="block text-rose-800 text-[11px] font-bold mb-1">
                    Critical ({formData.thresholdOperator})
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 95"
                    value={formData.thresholdCritical}
                    onChange={(e) => setFormData({ ...formData, thresholdCritical: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            ) : formData.valueType === 'BOOLEAN' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-2.5 rounded-lg border border-amber-200/80 shadow-2xs">
                  <label className="block text-amber-800 text-[11px] font-bold mb-1">Warn if Value Equals</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 or ON"
                    value={formData.thresholdWarn}
                    onChange={(e) => setFormData({ ...formData, thresholdWarn: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-rose-200/80 shadow-2xs">
                  <label className="block text-rose-800 text-[11px] font-bold mb-1">Critical if Value Equals</label>
                  <input
                    type="text"
                    placeholder="e.g. 0 or OFF"
                    value={formData.thresholdCritical}
                    onChange={(e) => setFormData({ ...formData, thresholdCritical: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white p-3 rounded-lg border border-rose-200/80 shadow-2xs">
                <label className="block text-rose-800 text-[11px] font-bold mb-1">Critical if Output Matches (Regex or substring)</label>
                <input
                  type="text"
                  placeholder="e.g. DOWN or ERROR"
                  value={formData.thresholdCritical}
                  onChange={(e) => setFormData({ ...formData, thresholdCritical: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:border-rose-500"
                />
              </div>
            )}
          </div>
        )}
            </>
          )}

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
              disabled={!!sqlValidationError}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors shadow-2xs cursor-pointer"
            >
              {editingMetric ? 'Save Metric' : 'Create Metric'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Quick Action Dialog: Add Metric to Template */}
      <Dialog
        isOpen={!!assignMetricModal}
        onClose={() => setAssignMetricModal(null)}
        title="Add Metric to Template Bundle"
        description={assignMetricModal ? `Link metric probe "${assignMetricModal.name}" to a target template.` : ''}
        maxWidth="md"
      >
        <form onSubmit={handleAssignToTemplateSubmit} className="space-y-4 text-xs">
          {/* Top 3 Recently Updated Templates */}
          {top3Templates.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                Top 3 Recently Updated Templates
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {top3Templates.map((t) => {
                  const isSelected = selectedAssignTemplateIds.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const nextSet = new Set(selectedAssignTemplateIds);
                        if (nextSet.has(t.id)) {
                          nextSet.delete(t.id);
                        } else {
                          nextSet.add(t.id);
                        }
                        setSelectedAssignTemplateIds(nextSet);
                      }}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs truncate flex items-center justify-between gap-1">
                        <span className="truncate">{t.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
                        <span className="font-semibold text-slate-600">{t.targetDbType || 'Universal'}</span>
                        <span className="text-[9px] text-slate-400">
                          {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Bar & Multi-Select Checkbox List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-slate-700 font-semibold mb-1">
                Select Target Templates (Multi-Select) *
              </label>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {selectedAssignTemplateIds.size} Selected
              </span>
            </div>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates by name or database engine..."
                value={templateSearchQuery}
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
              {filteredAssignTemplates.map((t) => {
                const isChecked = selectedAssignTemplateIds.has(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                      isChecked ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const nextSet = new Set(selectedAssignTemplateIds);
                          if (e.target.checked) {
                            nextSet.add(t.id);
                          } else {
                            nextSet.delete(t.id);
                          }
                          setSelectedAssignTemplateIds(nextSet);
                        }}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Engine: {t.targetDbType || 'Universal'}</div>
                      </div>
                    </div>
                    {isChecked && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                        Assigned
                      </span>
                    )}
                  </label>
                );
              })}
              {filteredAssignTemplates.length === 0 && (
                <div className="p-4 text-center text-slate-500 italic">
                  No templates match search query "{templateSearchQuery}".
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed bg-indigo-50/60 p-3 rounded-lg border border-indigo-100">
            Databases assigned to groups referencing this template bundle will automatically inherit and monitor this metric probe.
          </p>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAssignMetricModal(null)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              Save Template Link
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
