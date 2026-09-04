import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Plus,
  Trash2,
  Edit2,
  Code2,
  Clock,
  CheckCircle2,
  X,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  SlidersHorizontal,
  Info,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  MetricEntity,
  TemplateEntity,
  DatabaseEngineEntity,
  UserRole,
} from '../../../types';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { getDbEngineBadgeClass } from '../../../config/dbEngines';
import { MetricFormModal } from './MetricFormModal';

interface TemplateMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: TemplateEntity | null;
  metrics: MetricEntity[];
  databaseEngines: DatabaseEngineEntity[];
  userRole: UserRole;
  onSaveMetric: (metric: Partial<MetricEntity>) => Promise<any> | void;
}

export const TemplateMetricsModal: React.FC<TemplateMetricsModalProps> = ({
  isOpen,
  onClose,
  template,
  metrics,
  databaseEngines,
  userRole,
  onSaveMetric,
}) => {
  const { toast } = useToast();

  // Active view tab: 'bundled' (already attached) vs 'available' (to attach)
  const [activeTab, setActiveTab] = useState<'bundled' | 'available'>('bundled');

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Engine filter mode: 'TEMPLATE_ENGINE' (auto-filtered) | 'UNIVERSAL_ONLY' | 'ALL_ENGINES'
  const [engineFilterMode, setEngineFilterMode] = useState<'TEMPLATE_ENGINE' | 'UNIVERSAL_ONLY' | 'ALL_ENGINES'>('TEMPLATE_ENGINE');

  // Query type filter: 'ALL' | 1 | 2 | 3
  const [queryTypeFilter, setQueryTypeFilter] = useState<'ALL' | 1 | 2 | 3>('ALL');

  // Multi-select for adding metrics in batch
  const [selectedMetricIdsToAdd, setSelectedMetricIdsToAdd] = useState<Set<string>>(new Set());

  // Add/Update Metric sub-modal state
  const [isMetricFormOpen, setIsMetricFormOpen] = useState(false);
  const [metricToEdit, setMetricToEdit] = useState<MetricEntity | null>(null);

  // Template engine resolution
  const resolvedTemplateEngine = useMemo(() => {
    if (!template) return null;
    return (
      template.databaseEngine ||
      databaseEngines.find(
        (e) =>
          e.id === template.databaseEngineId ||
          e.dbCode.toUpperCase() === template.targetDbType?.toUpperCase()
      ) ||
      null
    );
  }, [template, databaseEngines]);

  const templateDbCode = (
    resolvedTemplateEngine?.dbCode ||
    template?.targetDbType ||
    'ALL'
  ).toUpperCase();

  // 1. All metrics bundled with this template
  const bundledMetrics = useMemo(() => {
    if (!template) return [];
    return metrics.filter(
      (m) =>
        m.templateIds?.includes(template.id) ||
        m.templateId === template.id
    );
  }, [metrics, template]);

  // 2. All unbundled metrics compatible with or available for this template
  const availableMetrics = useMemo(() => {
    if (!template) return [];
    return metrics.filter(
      (m) =>
        !(
          m.templateIds?.includes(template.id) ||
          m.templateId === template.id
        )
    );
  }, [metrics, template]);

  // Filtered bundled metrics based on search and filters
  const filteredBundledMetrics = useMemo(() => {
    let list = bundledMetrics;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.sqlQuery.toLowerCase().includes(q) ||
          (m.thresholdWarn && m.thresholdWarn.toLowerCase().includes(q))
      );
    }

    // Query type filter
    if (queryTypeFilter !== 'ALL') {
      list = list.filter((m) => (m.metricQueryType || 1) === queryTypeFilter);
    }

    return list;
  }, [bundledMetrics, searchQuery, queryTypeFilter]);

  // Filtered available metrics with Auto-Filter by DB engine
  const filteredAvailableMetrics = useMemo(() => {
    let list = availableMetrics;

    // Engine filter
    if (engineFilterMode === 'TEMPLATE_ENGINE') {
      // If template is ALL or universal, include everything
      if (templateDbCode !== 'ALL') {
        list = list.filter((m) => {
          const mEngine =
            m.databaseEngine ||
            databaseEngines.find((e) => e.id === m.databaseEngineId);
          const mCode = mEngine?.dbCode?.toUpperCase();

          // Matches exact engine or is universal
          if (!m.databaseEngineId || !mCode || mCode === 'ALL') return true;
          return mCode === templateDbCode;
        });
      }
    } else if (engineFilterMode === 'UNIVERSAL_ONLY') {
      list = list.filter((m) => {
        const mEngine =
          m.databaseEngine ||
          databaseEngines.find((e) => e.id === m.databaseEngineId);
        const mCode = mEngine?.dbCode?.toUpperCase();
        return !m.databaseEngineId || !mCode || mCode === 'ALL';
      });
    }

    // Query type filter
    if (queryTypeFilter !== 'ALL') {
      list = list.filter((m) => (m.metricQueryType || 1) === queryTypeFilter);
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.sqlQuery.toLowerCase().includes(q) ||
          (m.databaseEngine?.dbCode && m.databaseEngine.dbCode.toLowerCase().includes(q))
      );
    }

    return list;
  }, [
    availableMetrics,
    engineFilterMode,
    templateDbCode,
    databaseEngines,
    queryTypeFilter,
    searchQuery,
  ]);

  // Single-click Add Metric to template
  const handleAddSingleMetric = (metric: MetricEntity) => {
    if (!template) return;
    const currentIds = metric.templateIds || (metric.templateId ? [metric.templateId] : []);
    const nextIds = Array.from(new Set([...currentIds, template.id]));

    onSaveMetric({
      ...metric,
      templateIds: nextIds,
      templateId: nextIds[0] || null,
      templateName: template.name,
      isEnabled: true,
    });

    toast({
      title: 'Metric Attached',
      description: `"${metric.name}" added to template "${template.name}".`,
      type: 'success',
    });
  };

  // Single-click Remove Metric from template
  const handleRemoveMetric = (metric: MetricEntity) => {
    if (!template) return;
    const currentIds = metric.templateIds || (metric.templateId ? [metric.templateId] : []);
    const nextIds = currentIds.filter((id) => id !== template.id);

    onSaveMetric({
      ...metric,
      templateIds: nextIds,
      templateId: nextIds[0] || null,
      templateName: nextIds.length > 0 ? metric.templateName : null,
    });

    toast({
      title: 'Metric Removed',
      description: `"${metric.name}" unbundled from template "${template.name}".`,
      type: 'info',
    });
  };

  // Bulk add selected metrics to template
  const handleAddSelectedMetrics = () => {
    if (!template || selectedMetricIdsToAdd.size === 0) return;

    selectedMetricIdsToAdd.forEach((metricId) => {
      const targetMetric = metrics.find((m) => m.id === metricId);
      if (targetMetric) {
        const currentIds =
          targetMetric.templateIds ||
          (targetMetric.templateId ? [targetMetric.templateId] : []);
        const nextIds = Array.from(new Set([...currentIds, template.id]));
        onSaveMetric({
          ...targetMetric,
          templateIds: nextIds,
          templateId: nextIds[0] || null,
          templateName: template.name,
          isEnabled: true,
        });
      }
    });

    const count = selectedMetricIdsToAdd.size;
    setSelectedMetricIdsToAdd(new Set());
    toast({
      title: 'Metrics Attached',
      description: `${count} metric(s) attached to template "${template.name}".`,
      type: 'success',
    });
    setActiveTab('bundled');
  };

  // Toggle metric active monitoring status (ON/OFF)
  const handleToggleActiveState = (metric: MetricEntity) => {
    const nextState = metric.isEnabled === false ? true : false;
    onSaveMetric({
      ...metric,
      isEnabled: nextState,
    });

    toast({
      title: nextState ? 'Metric Monitoring Activated' : 'Metric Monitoring Paused',
      description: `"${metric.name}" active monitoring state set to ${
        nextState ? 'ON' : 'OFF'
      }.`,
      type: 'info',
    });
  };

  // Bulk select filtered available metrics
  const handleSelectAllFiltered = () => {
    const next = new Set(selectedMetricIdsToAdd);
    filteredAvailableMetrics.forEach((m) => next.add(m.id));
    setSelectedMetricIdsToAdd(next);
  };

  // Bulk deselect filtered available metrics
  const handleDeselectAllFiltered = () => {
    const next = new Set(selectedMetricIdsToAdd);
    filteredAvailableMetrics.forEach((m) => next.delete(m.id));
    setSelectedMetricIdsToAdd(next);
  };

  if (!template) return null;

  const dbColor = resolvedTemplateEngine?.dbColor || '#6366F1';

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={`Template Metrics: ${template.name}`}
        description="Search, auto-filter by template DB engine, and easily add or remove probe metric elements."
        maxWidth="4xl"
      >
        <div className="space-y-4 text-xs">
          {/* Top Info Banner: Template Context & Engine Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs font-bold text-white text-xs"
                style={{ backgroundColor: dbColor }}
              >
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{template.name}</span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shadow-2xs"
                    style={{
                      backgroundColor: dbColor + '15',
                      color: dbColor,
                      border: `1px solid ${dbColor}40`,
                    }}
                  >
                    {resolvedTemplateEngine ? resolvedTemplateEngine.dbName : templateDbCode}
                  </span>
                </div>
                {template.description && (
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {template.description}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Action: Create New Metric for this template */}
            {userRole === 'ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  setMetricToEdit(null);
                  setIsMetricFormOpen(true);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Metric for Template</span>
              </button>
            )}
          </div>

          {/* Navigation Tabs + Counters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('bundled')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'bundled'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Bundled in Template</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === 'bundled'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {bundledMetrics.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('available')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'available'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Compatible Metrics</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === 'available'
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}
                >
                  {availableMetrics.length}
                </span>
              </button>
            </div>

            {/* Auto-Filter Engine Pills (in Add Mode) */}
            {activeTab === 'available' && (
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold px-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-500" />
                  Engine:
                </span>
                <button
                  type="button"
                  onClick={() => setEngineFilterMode('TEMPLATE_ENGINE')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    engineFilterMode === 'TEMPLATE_ENGINE'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={`Show metrics matching ${templateDbCode} + Universal`}
                >
                  Auto ({templateDbCode})
                </button>
                <button
                  type="button"
                  onClick={() => setEngineFilterMode('UNIVERSAL_ONLY')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    engineFilterMode === 'UNIVERSAL_ONLY'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Show only Universal metrics (ALL)"
                >
                  Universal Only
                </button>
                <button
                  type="button"
                  onClick={() => setEngineFilterMode('ALL_ENGINES')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    engineFilterMode === 'ALL_ENGINES'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Show all metrics from any engine"
                >
                  All Engines
                </button>
              </div>
            )}
          </div>

          {/* Search & Query Type Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-8 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'bundled'
                    ? 'Search bundled metrics by name, SQL query...'
                    : `Search available ${templateDbCode} metrics to attach...`
                }
                className="w-full pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="sm:col-span-4 flex items-center gap-1.5">
              <select
                value={queryTypeFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setQueryTypeFilter(v === 'ALL' ? 'ALL' : (Number(v) as 1 | 2 | 3));
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="ALL">All Query Types (1, 2, 3)</option>
                <option value="1">Type 1: Single Value</option>
                <option value="2">Type 2: Multi-Row List</option>
                <option value="3">Type 3: Object-Attribute</option>
              </select>
            </div>
          </div>

          {/* TAB 1: BUNDLED IN TEMPLATE */}
          {activeTab === 'bundled' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-700 font-semibold text-xs">
                <span>
                  Showing {filteredBundledMetrics.length} of {bundledMetrics.length} bundled metrics
                </span>
                <span className="text-[11px] text-slate-400">
                  Toggle switch controls active monitoring polling
                </span>
              </div>

              {filteredBundledMetrics.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredBundledMetrics.map((m) => {
                    const isActive = m.isEnabled !== false;
                    const mEngine =
                      m.databaseEngine ||
                      databaseEngines.find((e) => e.id === m.databaseEngineId);
                    const engineCode = mEngine?.dbCode || 'Universal';
                    const engineBadge = getDbEngineBadgeClass(engineCode);

                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                            : 'bg-slate-50 border-slate-200/70 opacity-70'
                        }`}
                      >
                        {/* Metric Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{m.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-200 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {isActive ? 'ACTIVE' : 'PAUSED'}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase border ${engineBadge}`}
                            >
                              {engineCode}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              Cycle {m.cycle || 60}s
                            </span>
                            {m.metricQueryType && (
                              <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                T{m.metricQueryType}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-600 truncate mt-1 max-w-xl">
                            {m.sqlQuery}
                          </div>
                        </div>

                        {/* Controls: Edit, Toggle Switch, Remove */}
                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                          {/* Edit Button */}
                          {userRole === 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => {
                                setMetricToEdit(m);
                                setIsMetricFormOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit metric query and thresholds"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Monitoring On/Off Toggle */}
                          <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleToggleActiveState(m)}
                              disabled={userRole !== 'ADMIN'}
                              className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                                isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                              } ${userRole !== 'ADMIN' ? 'cursor-not-allowed opacity-60' : ''}`}
                              title={isActive ? 'Click to pause metric' : 'Click to activate metric'}
                            >
                              <span className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform" />
                            </button>
                            <span className="text-[10px] font-bold text-slate-600 w-6">
                              {isActive ? 'ON' : 'OFF'}
                            </span>
                          </div>

                          {/* 1-Click Remove from Template */}
                          {userRole === 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMetric(m)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
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
                <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="font-bold text-slate-700 text-xs">
                    {searchQuery
                      ? 'No bundled metrics match your search.'
                      : 'No metrics are bundled in this template yet.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Switch to the &quot;Add Compatible Metrics&quot; tab above to easily attach metrics.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('available')}
                    className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Browse Available Metrics</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD COMPATIBLE METRICS */}
          {activeTab === 'available' && (
            <div className="space-y-3">
              {/* Batch Actions Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-indigo-50/60 border border-indigo-200/70 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-950 text-xs">
                    Compatible Metrics ({filteredAvailableMetrics.length} found)
                  </span>
                  {selectedMetricIdsToAdd.size > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono font-bold text-[10px]">
                      {selectedMetricIdsToAdd.size} selected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    disabled={filteredAvailableMetrics.length === 0}
                    className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Select All Filtered
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    disabled={selectedMetricIdsToAdd.size === 0}
                    className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Deselect All
                  </button>
                  {selectedMetricIdsToAdd.size > 0 && (
                    <button
                      type="button"
                      onClick={handleAddSelectedMetrics}
                      className="ml-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Attach Selected ({selectedMetricIdsToAdd.size})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Metrics Grid / List */}
              {filteredAvailableMetrics.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredAvailableMetrics.map((m) => {
                    const isChecked = selectedMetricIdsToAdd.has(m.id);
                    const mEngine =
                      m.databaseEngine ||
                      databaseEngines.find((e) => e.id === m.databaseEngineId);
                    const engineCode = mEngine?.dbCode || 'Universal';
                    const engineBadge = getDbEngineBadgeClass(engineCode);

                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Checkbox + Details */}
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedMetricIdsToAdd);
                              if (e.target.checked) next.add(m.id);
                              else next.delete(m.id);
                              setSelectedMetricIdsToAdd(next);
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{m.name}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase border ${engineBadge}`}
                              >
                                {engineCode}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Cycle {m.cycle || 60}s
                              </span>
                              {m.metricQueryType && (
                                <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                  T{m.metricQueryType}
                                </span>
                              )}
                              {m.templateName && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  (Also in: {m.templateName})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-600 truncate mt-1 max-w-xl">
                              {m.sqlQuery}
                            </div>
                          </div>
                        </div>

                        {/* 1-Click Quick Add Button */}
                        <div className="shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleAddSingleMetric(m)}
                            className="px-3 py-1.5 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-300 hover:border-indigo-600 rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                            title="Add directly to this template"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                  <Filter className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="font-bold text-slate-700 text-xs">
                    No compatible metrics found for this filter.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try switching the engine filter to &quot;All Engines&quot; or clear your search term.
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setEngineFilterMode('ALL_ENGINES');
                        setQueryTypeFilter('ALL');
                      }}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Filters</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMetricToEdit(null);
                        setIsMetricFormOpen(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Metric</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Total {bundledMetrics.length} probe(s) configured in this template
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>

      {/* Sub-modal: Create or Edit Metric directly within template */}
      {isMetricFormOpen && (
        <MetricFormModal
          isOpen={isMetricFormOpen}
          onClose={() => setIsMetricFormOpen(false)}
          editingMetric={metricToEdit}
          targetTemplate={template}
          databaseEngines={databaseEngines}
          onSaveMetric={onSaveMetric}
        />
      )}
    </>
  );
};
