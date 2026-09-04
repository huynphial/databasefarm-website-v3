import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Search,
  X,
  Filter,
  CheckSquare,
  Square,
  Clock,
  Code2,
  Info,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import {
  TemplateEntity,
  MetricEntity,
  DatabaseEngineEntity,
} from '../../../types';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { getDbEngineBadgeClass } from '../../../config/dbEngines';

interface TemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTemplate: TemplateEntity | null;
  metrics: MetricEntity[];
  databaseEngines: DatabaseEngineEntity[];
  onSaveTemplate: (
    template: Partial<TemplateEntity>,
    selectedMetricIds?: string[]
  ) => Promise<any> | void;
  onSaveMetric?: (metric: Partial<MetricEntity>) => Promise<any> | void;
}

export const TemplateFormModal: React.FC<TemplateFormModalProps> = ({
  isOpen,
  onClose,
  editingTemplate,
  metrics,
  databaseEngines = [],
  onSaveTemplate,
  onSaveMetric,
}) => {
  const { toast } = useToast();

  // Form fields
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    databaseEngineId: string;
    targetDbType: string;
    description: string;
    selectedMetricIds: string[];
  }>({
    name: '',
    databaseEngineId: '',
    targetDbType: 'POSTGRES',
    description: '',
    selectedMetricIds: [],
  });

  // Metric selector states
  const [metricSearchQuery, setMetricSearchQuery] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [engineFilterOverride, setEngineFilterOverride] = useState<'AUTO' | 'ALL'>('AUTO');
  const [metricTypeFilter, setMetricTypeFilter] = useState<'ALL' | 1 | 2 | 3>('ALL');

  // Initialize form state when opening modal
  useEffect(() => {
    if (!isOpen) return;

    if (editingTemplate) {
      // Find all metrics currently assigned to this template
      const assignedMetricIds = metrics
        .filter(
          (m) =>
            m.templateIds?.includes(editingTemplate.id) ||
            m.templateId === editingTemplate.id
        )
        .map((m) => m.id);

      const eng = databaseEngines.find(
        (e) =>
          e.id === editingTemplate.databaseEngineId ||
          e.dbCode.toUpperCase() === editingTemplate.targetDbType?.toUpperCase()
      );

      setFormData({
        id: editingTemplate.id,
        name: editingTemplate.name || '',
        databaseEngineId: eng ? eng.id : (editingTemplate.databaseEngineId || 'ALL'),
        targetDbType: eng ? eng.dbCode : (editingTemplate.targetDbType || 'POSTGRES'),
        description: editingTemplate.description || '',
        selectedMetricIds: assignedMetricIds,
      });
    } else {
      // Default to first active database engine or POSTGRES
      const firstEng = databaseEngines.find((e) => e.statusOnOff === 'ACTIVE') || databaseEngines[0];
      setFormData({
        name: '',
        databaseEngineId: firstEng ? firstEng.id : '',
        targetDbType: firstEng ? firstEng.dbCode : 'POSTGRES',
        description: '',
        selectedMetricIds: [],
      });
    }

    setMetricSearchQuery('');
    setShowSelectedOnly(false);
    setEngineFilterOverride('AUTO');
    setMetricTypeFilter('ALL');
  }, [isOpen, editingTemplate, databaseEngines, metrics]);

  // Current selected engine object and code
  const currentEngine = useMemo(() => {
    return databaseEngines.find((e) => e.id === formData.databaseEngineId);
  }, [databaseEngines, formData.databaseEngineId]);

  const currentEngineCode = useMemo(() => {
    if (currentEngine) return currentEngine.dbCode.toUpperCase();
    if (formData.databaseEngineId === 'ALL' || formData.targetDbType === 'ALL') return 'ALL';
    return (formData.targetDbType || 'POSTGRES').toUpperCase();
  }, [currentEngine, formData.databaseEngineId, formData.targetDbType]);

  // Filtered metrics list: auto-filtered by selected DB engine!
  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => {
      const isSelected = formData.selectedMetricIds.includes(m.id);

      // If "Selected Only" is toggled
      if (showSelectedOnly && !isSelected) {
        return false;
      }

      // Auto-filter by DB engine of that template
      if (engineFilterOverride === 'AUTO') {
        if (currentEngineCode !== 'ALL') {
          const mEng =
            m.databaseEngine ||
            databaseEngines.find((e) => e.id === m.databaseEngineId);
          const mCode = mEng?.dbCode?.toUpperCase();

          // Compatible if universal or exact match
          const isUniversal = !m.databaseEngineId || !mCode || mCode === 'ALL';
          const isExactMatch = mCode === currentEngineCode;

          if (!isUniversal && !isExactMatch && !isSelected) {
            return false;
          }
        }
      }

      // Query Type filter
      if (metricTypeFilter !== 'ALL') {
        if ((m.metricQueryType || 1) !== metricTypeFilter) {
          return false;
        }
      }

      // Search Query
      if (metricSearchQuery.trim()) {
        const q = metricSearchQuery.toLowerCase().trim();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesQuery = m.sqlQuery.toLowerCase().includes(q);
        const matchesEngine = m.databaseEngine?.dbCode?.toLowerCase().includes(q);
        if (!matchesName && !matchesQuery && !matchesEngine) {
          return false;
        }
      }

      return true;
    });
  }, [
    metrics,
    formData.selectedMetricIds,
    showSelectedOnly,
    engineFilterOverride,
    currentEngineCode,
    databaseEngines,
    metricTypeFilter,
    metricSearchQuery,
  ]);

  // Toggle single metric selection
  const handleToggleMetric = (metricId: string) => {
    setFormData((prev) => {
      const isSelected = prev.selectedMetricIds.includes(metricId);
      const nextIds = isSelected
        ? prev.selectedMetricIds.filter((id) => id !== metricId)
        : [...prev.selectedMetricIds, metricId];
      return { ...prev, selectedMetricIds: nextIds };
    });
  };

  // Bulk select all filtered metrics
  const handleSelectFiltered = () => {
    const nextIds = new Set(formData.selectedMetricIds);
    filteredMetrics.forEach((m) => nextIds.add(m.id));
    setFormData((prev) => ({ ...prev, selectedMetricIds: Array.from(nextIds) }));
  };

  // Bulk deselect all filtered metrics
  const handleDeselectFiltered = () => {
    const filterIds = new Set(filteredMetrics.map((m) => m.id));
    setFormData((prev) => ({
      ...prev,
      selectedMetricIds: prev.selectedMetricIds.filter((id) => !filterIds.has(id)),
    }));
  };

  // Clear all selected metrics
  const handleClearAll = () => {
    setFormData((prev) => ({ ...prev, selectedMetricIds: [] }));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Template Name is required.', type: 'error' });
      return;
    }

    const resolvedDbType = currentEngine
      ? currentEngine.dbCode
      : formData.databaseEngineId === 'ALL'
      ? 'ALL'
      : formData.targetDbType || 'ALL';

    const templatePayload: Partial<TemplateEntity> = {
      id: formData.id,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      databaseEngineId:
        currentEngine
          ? currentEngine.id
          : formData.databaseEngineId !== 'ALL'
          ? formData.databaseEngineId || null
          : null,
      targetDbType: resolvedDbType,
      metricIds: formData.selectedMetricIds,
    };

    try {
      await onSaveTemplate(templatePayload, formData.selectedMetricIds);

      // Sync metric elements
      if (onSaveMetric) {
        const targetTplId = formData.id || templatePayload.id;
        if (targetTplId) {
          const selectedSet = new Set(formData.selectedMetricIds);

          metrics.forEach((m) => {
            const currentIds = m.templateIds || (m.templateId ? [m.templateId] : []);
            const isAssigned = currentIds.includes(targetTplId);
            const shouldBeAssigned = selectedSet.has(m.id);

            if (shouldBeAssigned && !isAssigned) {
              const nextIds = [...currentIds, targetTplId];
              onSaveMetric({
                ...m,
                templateIds: nextIds,
                templateId: nextIds[0] || null,
                templateName: formData.name.trim(),
                isEnabled: true,
              });
            } else if (!shouldBeAssigned && isAssigned) {
              const nextIds = currentIds.filter((id) => id !== targetTplId);
              onSaveMetric({
                ...m,
                templateIds: nextIds,
                templateId: nextIds[0] || null,
                templateName: nextIds.length > 0 ? m.templateName : null,
              });
            }
          });
        }
      }

      toast({
        title: formData.id ? 'Template Updated' : 'Template Created',
        description: `Template "${formData.name}" saved with ${formData.selectedMetricIds.length} metric elements.`,
        type: 'success',
      });
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error Saving Template',
        description: err.message || 'Failed to save template.',
        type: 'error',
      });
    }
  };

  const dbColor = currentEngine?.dbColor || '#6366F1';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'Create Monitoring Template'}
      description="Configure template engine compatibility, metadata, and attached probe metric elements."
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Template Basic Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Template Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. PostgreSQL High-Load Health"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-bold">Target Database Engine *</label>
              {currentEngine && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shadow-2xs"
                  style={{
                    backgroundColor: dbColor + '15',
                    color: dbColor,
                    border: `1px solid ${dbColor}40`,
                  }}
                >
                  {currentEngine.dbCode}
                </span>
              )}
            </div>
            <select
              value={formData.databaseEngineId}
              onChange={(e) => {
                const val = e.target.value;
                const eng = databaseEngines.find((item) => item.id === val);
                setFormData((prev) => ({
                  ...prev,
                  databaseEngineId: val,
                  targetDbType: eng ? eng.dbCode : val === 'ALL' ? 'ALL' : 'POSTGRES',
                }));
              }}
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="" disabled>-- Select Database Engine --</option>
              {databaseEngines.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.dbName} ({eng.dbCode}) {eng.statusOnOff === 'INACTIVE' ? '— [Inactive]' : ''}
                </option>
              ))}
              <option value="ALL">Universal (Compatible with all engines)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Description</label>
          <textarea
            rows={2}
            placeholder="Summary of monitoring probes and thresholds bundled in this template..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* ============================================================== */}
        {/* Metric Elements Selector with Auto-Filter by DB Engine */}
        {/* ============================================================== */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-slate-800 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                Bundled Metric Elements
              </label>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-[10px]">
                {formData.selectedMetricIds.length} selected
              </span>
            </div>

            {/* Auto-Filter Notice / Mode Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium px-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setEngineFilterOverride('AUTO')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  engineFilterOverride === 'AUTO'
                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Auto-filter metrics for engine ${currentEngineCode}`}
              >
                Auto ({currentEngineCode})
              </button>
              <button
                type="button"
                onClick={() => setEngineFilterOverride('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  engineFilterOverride === 'ALL'
                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Engines
              </button>
            </div>
          </div>

          {/* Search, Type Filter, and Bulk Quick Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={metricSearchQuery}
                onChange={(e) => setMetricSearchQuery(e.target.value)}
                placeholder={`Search ${currentEngineCode} metrics by name, query...`}
                className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              {metricSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMetricSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={metricTypeFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setMetricTypeFilter(v === 'ALL' ? 'ALL' : (Number(v) as 1 | 2 | 3));
                }}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-medium"
              >
                <option value="ALL">All Types</option>
                <option value="1">Type 1</option>
                <option value="2">Type 2</option>
                <option value="3">Type 3</option>
              </select>

              <button
                type="button"
                onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  showSelectedOnly
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CheckSquare className="w-3 h-3" />
                <span>Selected Only</span>
              </button>

              <button
                type="button"
                onClick={handleSelectFiltered}
                disabled={filteredMetrics.length === 0}
                className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer disabled:opacity-40 shrink-0"
              >
                Select Filtered
              </button>
              <button
                type="button"
                onClick={handleDeselectFiltered}
                disabled={formData.selectedMetricIds.length === 0}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer disabled:opacity-40 shrink-0"
              >
                Deselect Filtered
              </button>
              {formData.selectedMetricIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer shrink-0"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Metrics Checklist Cards Container */}
          <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/70 max-h-72 overflow-y-auto space-y-1.5">
            {filteredMetrics.length > 0 ? (
              filteredMetrics.map((m) => {
                const isChecked = formData.selectedMetricIds.includes(m.id);
                const mEngine =
                  m.databaseEngine ||
                  databaseEngines.find((e) => e.id === m.databaseEngineId);
                const engineCode = mEngine?.dbCode || 'Universal';
                const badgeStyle = getDbEngineBadgeClass(engineCode);

                return (
                  <div
                    key={m.id}
                    onClick={() => handleToggleMetric(m.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isChecked
                        ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="pt-0.5">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs truncate">{m.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase border ${badgeStyle}`}
                        >
                          {engineCode}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Cycle {m.cycle || 60}s
                        </span>
                        {m.metricQueryType && (
                          <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded">
                            T{m.metricQueryType}
                          </span>
                        )}
                        {m.templateName && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({m.templateName})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
                        {m.sqlQuery}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                <Info className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                <p className="font-semibold text-slate-600">No metric elements match your search / filter.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Try switching the filter to &quot;All Engines&quot; or clearing your search term.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{editingTemplate ? 'Save Template & Metrics' : 'Create Template'}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
};
