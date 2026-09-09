import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  Sun,
} from 'lucide-react';
import {
  TemplateEntity,
  MetricEntity,
  DatabaseEngineEntity,
} from '../../../types';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { useTranslation } from '../../../i18n';

interface TemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTemplate: TemplateEntity | null;
  metrics?: MetricEntity[];
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
  databaseEngines = [],
  onSaveTemplate,
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Form fields
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    databaseEngineId: string;
    targetDbType: string;
    description: string;
    alertHourMode: 'ALL_DAY' | 'HOUR_RANGE';
    alertHourStart: string;
    alertHourEnd: string;
  }>({
    name: '',
    databaseEngineId: '',
    targetDbType: 'POSTGRES',
    description: '',
    alertHourMode: 'ALL_DAY',
    alertHourStart: '07:30',
    alertHourEnd: '17:00',
  });

  // Initialize form state when opening modal
  useEffect(() => {
    if (!isOpen) return;

    if (editingTemplate) {
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
        alertHourMode: (editingTemplate.alertHourMode as any) === 'HOUR_RANGE' ? 'HOUR_RANGE' : 'ALL_DAY',
        alertHourStart: editingTemplate.alertHourStart || '07:30',
        alertHourEnd: editingTemplate.alertHourEnd || '17:00',
      });
    } else {
      // Default to first active database engine or POSTGRES
      const firstEng = databaseEngines.find((e) => e.statusOnOff === 'ACTIVE') || databaseEngines[0];
      setFormData({
        name: '',
        databaseEngineId: firstEng ? firstEng.id : '',
        targetDbType: firstEng ? firstEng.dbCode : 'POSTGRES',
        description: '',
        alertHourMode: 'ALL_DAY',
        alertHourStart: '07:30',
        alertHourEnd: '17:00',
      });
    }
  }, [isOpen, editingTemplate, databaseEngines]);

  // Active database engines only
  const activeEngines = useMemo(() => {
    return databaseEngines.filter((e) => e.statusOnOff === 'ACTIVE');
  }, [databaseEngines]);

  // Current selected engine object
  const currentEngine = useMemo(() => {
    return databaseEngines.find((e) => e.id === formData.databaseEngineId);
  }, [databaseEngines, formData.databaseEngineId]);

  const handleAlertHourModeChange = (mode: 'ALL_DAY' | 'HOUR_RANGE') => {
    setFormData((prev) => ({
      ...prev,
      alertHourMode: mode,
      alertHourStart: prev.alertHourStart || '07:30',
      alertHourEnd: prev.alertHourEnd || '17:00',
    }));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Template Name is required.', type: 'error' });
      return;
    }

    if (formData.alertHourMode === 'HOUR_RANGE') {
      if (!formData.alertHourStart || !formData.alertHourEnd) {
        toast({ title: 'Validation Error', description: 'Please provide both Start and End hours for the alerting window.', type: 'error' });
        return;
      }
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
      alertHourMode: formData.alertHourMode,
      alertHourStart: formData.alertHourMode === 'HOUR_RANGE' ? (formData.alertHourStart || '07:30') : '07:30',
      alertHourEnd: formData.alertHourMode === 'HOUR_RANGE' ? (formData.alertHourEnd || '17:00') : '17:00',
    };

    try {
      await onSaveTemplate(templatePayload);

      toast({
        title: formData.id ? 'Template Updated' : 'Template Created',
        description: `Template "${formData.name}" has been saved successfully.`,
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
      description="Configure template name, target database engine, alerting hours, and description."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Template Basic Details */}
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
            {activeEngines.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.dbName} ({eng.dbCode})
              </option>
            ))}
            <option value="ALL">Universal (Compatible with all engines)</option>
          </select>
        </div>

        {/* Alert Hour Configuration */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('templates.alertHour') || 'Alert Hours'}</span>
          </label>
          <p className="text-[11px] text-slate-500 mb-2.5">
            {t('templates.alertHourDesc') || 'Configure when alerts will trigger for databases bound to this template.'}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            {/* Option 1: All Day */}
            <button
              type="button"
              onClick={() => handleAlertHourModeChange('ALL_DAY')}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                formData.alertHourMode === 'ALL_DAY'
                  ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                formData.alertHourMode === 'ALL_DAY' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
              }`}>
                {formData.alertHourMode === 'ALL_DAY' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('templates.allDay') || 'All Day'}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  {t('templates.allDayDesc') || 'Continuous 24/7 monitoring and alerting'}
                </div>
              </div>
            </button>

            {/* Option 2: Hour Range */}
            <button
              type="button"
              onClick={() => handleAlertHourModeChange('HOUR_RANGE')}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                formData.alertHourMode === 'HOUR_RANGE'
                  ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                formData.alertHourMode === 'HOUR_RANGE' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
              }`}>
                {formData.alertHourMode === 'HOUR_RANGE' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t('templates.hourRange') || 'Hour Range'}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  {t('templates.hourRangeDesc') || 'Alert only during specific daily hours (e.g. 07:30 - 17:00)'}
                </div>
              </div>
            </button>
          </div>

          {/* Hour Range Inputs (Shown when HOUR_RANGE is selected) */}
          {formData.alertHourMode === 'HOUR_RANGE' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-semibold text-[11px]">
                  Daily Active Alert Window
                </span>
                <span className="text-[11px] text-indigo-700 font-mono font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {formData.alertHourStart || '07:30'} &rarr; {formData.alertHourEnd || '17:00'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {t('templates.fromHour') || 'From'} ({t('templates.alertHourStart') || 'Start Time'}) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.alertHourStart}
                    onChange={(e) => setFormData({ ...formData, alertHourStart: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {t('templates.toHour') || 'To'} ({t('templates.alertHourEnd') || 'End Time'}) *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.alertHourEnd}
                    onChange={(e) => setFormData({ ...formData, alertHourEnd: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, alertHourStart: '07:30', alertHourEnd: '17:00' }))}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer transition-colors"
                >
                  07:30 – 17:00 (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, alertHourStart: '08:00', alertHourEnd: '17:30' }))}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer transition-colors"
                >
                  08:00 – 17:30 (Office)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, alertHourStart: '06:00', alertHourEnd: '22:00' }))}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer transition-colors"
                >
                  06:00 – 22:00 (Extended)
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Description</label>
          <textarea
            rows={3}
            placeholder="Summary of monitoring purpose and probes for this template..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-indigo-500"
          />
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
            <span>{editingTemplate ? 'Save Template' : 'Create Template'}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
};
