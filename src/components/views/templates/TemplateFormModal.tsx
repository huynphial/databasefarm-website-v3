import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
} from 'lucide-react';
import {
  TemplateEntity,
  MetricEntity,
  DatabaseEngineEntity,
} from '../../../types';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';

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

  // Form fields
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    databaseEngineId: string;
    targetDbType: string;
    description: string;
  }>({
    name: '',
    databaseEngineId: '',
    targetDbType: 'POSTGRES',
    description: '',
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
      });
    } else {
      // Default to first active database engine or POSTGRES
      const firstEng = databaseEngines.find((e) => e.statusOnOff === 'ACTIVE') || databaseEngines[0];
      setFormData({
        name: '',
        databaseEngineId: firstEng ? firstEng.id : '',
        targetDbType: firstEng ? firstEng.dbCode : 'POSTGRES',
        description: '',
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
      description="Configure template name, target database engine, and description."
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
