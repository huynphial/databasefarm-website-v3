import React, { useState, useEffect } from 'react';
import {
  Code2,
  AlertCircle,
  Clock,
  Sliders,
  BellOff,
  Layers,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  MetricEntity,
  MetricValueType,
  RelationalOperator,
  TemplateEntity,
  DatabaseEngineEntity,
} from '../../../types';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { validateMetricSqlQuery } from '../../../lib/sqlValidator';
import { useTranslation } from '../../../i18n/LanguageContext';

interface MetricFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMetric: MetricEntity | null;
  targetTemplate?: TemplateEntity | null;
  databaseEngines: DatabaseEngineEntity[];
  onSaveMetric: (metric: Partial<MetricEntity>) => Promise<any> | void;
}

export const MetricFormModal: React.FC<MetricFormModalProps> = ({
  isOpen,
  onClose,
  editingMetric,
  targetTemplate,
  databaseEngines,
  onSaveMetric,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    sqlQuery: string;
    valueType: MetricValueType;
    databaseEngineId: string;
    relationalOperator: RelationalOperator;
    thresholdWarn: string;
    thresholdHigh: string;
    thresholdCritical: string;
    cycle: number;
    isEnabled: boolean;
    noAlertRequired: boolean;
    metricQueryType: 1 | 2 | 3;
  }>({
    name: '',
    sqlQuery: '',
    valueType: 'NUMBER',
    databaseEngineId: '',
    relationalOperator: '>',
    thresholdWarn: '80',
    thresholdHigh: '90',
    thresholdCritical: '95',
    cycle: 60,
    isEnabled: true,
    noAlertRequired: false,
    metricQueryType: 1,
  });

  const [sqlValidationError, setSqlValidationError] = useState<string | null>(null);

  // Initialize or reset form data
  useEffect(() => {
    if (!isOpen) return;

    if (editingMetric) {
      setFormData({
        id: editingMetric.id,
        name: editingMetric.name || '',
        sqlQuery: editingMetric.sqlQuery || '',
        valueType: editingMetric.valueType || 'NUMBER',
        databaseEngineId: editingMetric.databaseEngineId || '',
        relationalOperator: editingMetric.relationalOperator || editingMetric.thresholdOperator || '>',
        thresholdWarn: editingMetric.thresholdWarn || '',
        thresholdHigh: editingMetric.thresholdHigh || '',
        thresholdCritical: editingMetric.thresholdCritical || '',
        cycle: editingMetric.cycle || 60,
        isEnabled: editingMetric.isEnabled !== false,
        noAlertRequired: editingMetric.noAlertRequired === true,
        metricQueryType: editingMetric.metricQueryType || 1,
      });
      setSqlValidationError(null);
    } else {
      // Create new metric for target template
      // Auto-assign template's engine
      let engineId = '';
      if (targetTemplate) {
        if (targetTemplate.databaseEngineId && targetTemplate.databaseEngineId !== 'ALL') {
          engineId = targetTemplate.databaseEngineId;
        } else if (targetTemplate.targetDbType && targetTemplate.targetDbType !== 'ALL') {
          const matchedEng = databaseEngines.find(
            (e) => e.dbCode.toUpperCase() === targetTemplate.targetDbType?.toUpperCase()
          );
          if (matchedEng) engineId = matchedEng.id;
        }
      }

      setFormData({
        name: '',
        sqlQuery: '',
        valueType: 'NUMBER',
        databaseEngineId: engineId,
        relationalOperator: '>',
        thresholdWarn: '80',
        thresholdHigh: '90',
        thresholdCritical: '95',
        cycle: 60,
        isEnabled: true,
        noAlertRequired: false,
        metricQueryType: 1,
      });
      setSqlValidationError(null);
    }
  }, [isOpen, editingMetric, targetTemplate, databaseEngines]);

  const handleSqlQueryChange = (query: string, typeOverride?: 1 | 2 | 3) => {
    setFormData((prev) => ({ ...prev, sqlQuery: query }));
    if (!query.trim()) {
      setSqlValidationError(null);
      return;
    }
    const currentType = typeOverride ?? formData.metricQueryType;
    const result = validateMetricSqlQuery(query, currentType);
    if (!result.isValid) {
      setSqlValidationError(result.error || 'SQL query does not match selected metric type schema');
    } else {
      setSqlValidationError(null);
    }
  };

  const handleValueTypeChange = (type: MetricValueType) => {
    let defaultOp: RelationalOperator = '>';
    let defaultWarn = '80';
    let defaultHigh = '90';
    let defaultCrit = '95';

    if (type === 'STRING') {
      defaultOp = 'CONTAINS';
      defaultWarn = 'WARNING';
      defaultHigh = 'ERROR';
      defaultCrit = 'CRITICAL';
    } else if (type === 'BOOLEAN') {
      defaultOp = '=';
      defaultWarn = 'false';
      defaultHigh = 'false';
      defaultCrit = 'false';
    }

    setFormData((prev) => ({
      ...prev,
      valueType: type,
      relationalOperator: defaultOp,
      thresholdWarn: defaultWarn,
      thresholdHigh: defaultHigh,
      thresholdCritical: defaultCrit,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Metric Name is required.', type: 'error' });
      return;
    }

    if (!formData.sqlQuery.trim()) {
      toast({ title: 'Validation Error', description: 'SQL Query command is required.', type: 'error' });
      return;
    }

    const validation = validateMetricSqlQuery(formData.sqlQuery, formData.metricQueryType);
    if (!validation.isValid) {
      toast({
        title: 'SQL Syntax Error',
        description: validation.error || 'SQL statement did not pass query type security/format validation.',
        type: 'error',
      });
      return;
    }

    const matchedEng = databaseEngines.find((e) => e.id === formData.databaseEngineId);

    // Compute template bindings
    let updatedTemplateIds: string[] = [];
    if (editingMetric) {
      updatedTemplateIds = editingMetric.templateIds || (editingMetric.templateId ? [editingMetric.templateId] : []);
      if (targetTemplate && !updatedTemplateIds.includes(targetTemplate.id)) {
        updatedTemplateIds.push(targetTemplate.id);
      }
    } else if (targetTemplate) {
      updatedTemplateIds = [targetTemplate.id];
    }

    const payload: Partial<MetricEntity> = {
      ...(formData.id ? { id: formData.id } : { id: `met-${Date.now()}` }),
      name: formData.name.trim(),
      sqlQuery: formData.sqlQuery.trim(),
      valueType: formData.valueType,
      databaseEngineId: formData.databaseEngineId || null,
      databaseEngine: matchedEng || null,
      relationalOperator: formData.relationalOperator,
      thresholdOperator: formData.relationalOperator,
      thresholdWarn: formData.noAlertRequired ? null : formData.thresholdWarn.trim() || null,
      thresholdHigh: formData.noAlertRequired ? null : formData.thresholdHigh.trim() || null,
      thresholdCritical: formData.noAlertRequired ? null : formData.thresholdCritical.trim() || null,
      cycle: Number(formData.cycle) || 60,
      isEnabled: formData.isEnabled,
      noAlertRequired: formData.noAlertRequired,
      metricQueryType: formData.metricQueryType,
      templateIds: updatedTemplateIds,
      templateId: updatedTemplateIds[0] || null,
      templateName: targetTemplate ? targetTemplate.name : editingMetric?.templateName || null,
    };

    try {
      await onSaveMetric(payload);
      toast({
        title: editingMetric ? 'Metric Updated' : 'Metric Created',
        description: `Metric "${formData.name}" was successfully saved and bound to template "${targetTemplate?.name || 'Monitoring'}".`,
        type: 'success',
      });
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error Saving Metric',
        description: err.message || 'Failed to save metric.',
        type: 'error',
      });
    }
  };

  const currentEngine = databaseEngines.find((e) => e.id === formData.databaseEngineId);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingMetric
          ? `Edit Metric: ${editingMetric.name}`
          : targetTemplate
          ? `Add New Metric for "${targetTemplate.name}"`
          : 'Create Metric'
      }
      description={
        targetTemplate
          ? `Configure probe query and threshold telemetry for template engine: ${
              targetTemplate.targetDbType || 'All'
            }.`
          : 'Configure metric probe query, cycle interval, and alarm evaluation logic.'
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Template Context Indicator */}
        {targetTemplate && (
          <div className="flex items-center justify-between p-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-indigo-950">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold text-xs">Bundled into Template: </span>
                <span className="font-semibold text-indigo-800">{targetTemplate.name}</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white text-indigo-700 border border-indigo-200 shadow-2xs">
              {targetTemplate.targetDbType || 'ALL'}
            </span>
          </div>
        )}

        {/* Metric Query Type Selector */}
        <div className="space-y-2">
          <label className="block text-slate-700 font-bold text-xs uppercase tracking-wider">
            {t('metrics.metricQueryTypeLabel') || 'Query Type'}
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              {
                type: 1,
                label: t('metrics.type1') || 'Type 1: Single Value',
                desc: t('metrics.type1Desc') || 'Scalar result: SELECT count(*) AS value',
              },
              {
                type: 2,
                label: t('metrics.type2') || 'Type 2: Multi-Row',
                desc: t('metrics.type2Desc') || 'Grouped list: SELECT name, value',
              },
              {
                type: 3,
                label: t('metrics.type3') || 'Type 3: Object-Attribute',
                desc: t('metrics.type3Desc') || 'Matrix: SELECT name, attribute, value',
              },
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

        {/* Name & Target Database Engine */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Metric Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Active Connections Count"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-semibold">Target Database Engine</label>
              {currentEngine && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: currentEngine.dbColor + '15',
                    color: currentEngine.dbColor,
                    border: `1px solid ${currentEngine.dbColor}40`,
                  }}
                >
                  {currentEngine.dbCode}
                </span>
              )}
            </div>
            <select
              value={formData.databaseEngineId}
              onChange={(e) => setFormData({ ...formData, databaseEngineId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="">Universal / All DB Engines</option>
              {databaseEngines.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.dbName} ({eng.dbCode})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              {targetTemplate
                ? 'Pre-set to match the template engine; can be set to Universal.'
                : 'Choose an engine or leave as Universal for all database types.'}
            </p>
          </div>
        </div>

        {/* Active Monitoring State Toggle */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-900 block text-xs">Active Monitoring State</span>
            <span className="text-[10px] text-slate-500">Enable or pause continuous polling for this metric.</span>
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

        {/* SQL Query Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-slate-700 font-semibold flex items-center gap-1.5 text-xs">
              <Code2 className="w-3.5 h-3.5 text-indigo-600" />
              SQL Query Command *
            </label>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200 font-mono">
              {formData.metricQueryType === 1
                ? 'SELECT ... AS value'
                : formData.metricQueryType === 2
                ? 'SELECT ... AS name, ... AS value'
                : 'SELECT ... AS name, ... AS attribute, ... AS value'}
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
                ? 'SELECT count(*) AS value FROM pg_stat_activity'
                : formData.metricQueryType === 2
                ? 'SELECT datname AS name, numbackends AS value FROM pg_stat_database'
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

        {/* Value Type & Polling Cycle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Value Type</label>
            <select
              value={formData.valueType}
              onChange={(e) => handleValueTypeChange(e.target.value as MetricValueType)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="NUMBER">Numeric (Number)</option>
              <option value="STRING">Text (String)</option>
              <option value="BOOLEAN">Boolean (Flag)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Polling Cycle (Seconds) *
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
          </div>
        </div>

        {/* No Alert Required Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="space-y-0.5 pr-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <BellOff className="w-3.5 h-3.5 text-amber-600" />
              <span>Telemetry Collection Only (No Alert Required)</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Collect and graph historical measurements without triggering threshold alert dispatches.
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

        {/* Thresholds Configuration */}
        {!formData.noAlertRequired && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                Alarm Evaluation Logic & Thresholds
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-semibold">Operator:</span>
                <select
                  value={formData.relationalOperator}
                  onChange={(e) => setFormData({ ...formData, relationalOperator: e.target.value as RelationalOperator })}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 font-mono text-xs text-slate-800 font-bold"
                >
                  <option value=">">&gt; (Greater than)</option>
                  <option value=">=">&gt;= (Greater or equal)</option>
                  <option value="<">&lt; (Less than)</option>
                  <option value="<=">&lt;= (Less or equal)</option>
                  <option value="=">= (Equal to)</option>
                  <option value="!=">!= (Not equal)</option>
                  {formData.valueType === 'STRING' && (
                    <>
                      <option value="CONTAINS">CONTAINS</option>
                      <option value="REGEX">REGEX</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="block text-[11px] font-bold text-amber-800 mb-1">
                  Warning Threshold
                </label>
                <input
                  type="text"
                  placeholder="e.g. 75"
                  value={formData.thresholdWarn}
                  onChange={(e) => setFormData({ ...formData, thresholdWarn: e.target.value })}
                  className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                <label className="block text-[11px] font-bold text-orange-800 mb-1">
                  High Threshold
                </label>
                <input
                  type="text"
                  placeholder="e.g. 85"
                  value={formData.thresholdHigh}
                  onChange={(e) => setFormData({ ...formData, thresholdHigh: e.target.value })}
                  className="w-full bg-white border border-orange-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                <label className="block text-[11px] font-bold text-rose-800 mb-1">
                  Critical Threshold
                </label>
                <input
                  type="text"
                  placeholder="e.g. 95"
                  value={formData.thresholdCritical}
                  onChange={(e) => setFormData({ ...formData, thresholdCritical: e.target.value })}
                  className="w-full bg-white border border-rose-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Buttons */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
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
            <span>{editingMetric ? 'Save Changes' : 'Create & Attach Metric'}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
};
