import React, { useState, useMemo, useEffect } from 'react';
import {
  Server,
  Layers,
  BellRing,
  Radio,
  Search,
  X,
  Check,
  Filter,
  Tag,
  ArrowUpDown,
  Send,
  Mail,
  Globe,
  Info,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  DatabaseEntity,
  TemplateEntity,
  AlertNotificationMethodEntity,
  GroupEntity,
  DatabaseEngineEntity,
} from '../../../types';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { getDbEngineBadgeClass } from '../../../config/dbEngines';
import { useTranslation } from '../../../i18n/LanguageContext';
import { extractGroupMappings } from '../GroupsView';
import { DatabaseEngineFilter } from '../../common/DatabaseEngineFilter';

interface GroupFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGroup: GroupEntity | null;
  databases: DatabaseEntity[];
  templates: TemplateEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  alertMethods?: AlertNotificationMethodEntity[];
  onSaveGroup: (group: Partial<GroupEntity>, assignedDbIds?: string[]) => Promise<any> | void;
}

export const GroupFormModal: React.FC<GroupFormModalProps> = ({
  isOpen,
  onClose,
  editingGroup,
  databases,
  templates,
  databaseEngines = [],
  alertMethods = [],
  onSaveGroup,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Active section tab: 1 = Managed Databases, 2 = Applied Templates, 3 = Alert Dispatchers
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);

  // Primary form data state
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    description: string;
    databaseIds: string[];
    templateIds: string[];
    notificationMappings: { notificationMethodId: string; senderIds: string }[];
  }>({
    name: '',
    description: '',
    databaseIds: [],
    templateIds: [],
    notificationMappings: [],
  });

  // Database selection filters & sort
  const [dbSearch, setDbSearch] = useState('');
  const [dbEngineFilter, setDbEngineFilter] = useState<string>('ALL');
  const [dbTagFilter, setDbTagFilter] = useState<string>('ALL');
  const [dbSortOption, setDbSortOption] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'>('created_desc');
  const [dbShowOnlySelected, setDbShowOnlySelected] = useState(false);

  // Template selection filters
  const [tplSearch, setTplSearch] = useState('');
  const [tplEngineFilter, setTplEngineFilter] = useState<string>('ALL');
  const [tplShowOnlySelected, setTplShowOnlySelected] = useState(false);

  // Dispatcher selection filters
  const [dispSearch, setDispSearch] = useState('');
  const [dispTypeFilter, setDispTypeFilter] = useState<string>('ALL');
  const [dispShowOnlySelected, setDispShowOnlySelected] = useState(false);

  // Reset form state when dialog opens or editingGroup changes
  useEffect(() => {
    if (isOpen) {
      if (editingGroup) {
        const initialMappings = extractGroupMappings(editingGroup);
        setFormData({
          id: editingGroup.id,
          name: editingGroup.name,
          description: editingGroup.description || '',
          databaseIds: editingGroup.databaseIds || [],
          templateIds: editingGroup.templateIds || [],
          notificationMappings: initialMappings,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          databaseIds: [],
          templateIds: [],
          notificationMappings: [],
        });
      }
      // Reset navigation and filter states
      setActiveTab(1);
      setDbSearch('');
      setDbEngineFilter('ALL');
      setDbTagFilter('ALL');
      setDbSortOption('created_desc');
      setDbShowOnlySelected(false);
      setTplSearch('');
      setTplEngineFilter('ALL');
      setTplShowOnlySelected(false);
      setDispSearch('');
      setDispTypeFilter('ALL');
      setDispShowOnlySelected(false);
    }
  }, [isOpen, editingGroup]);

  // -------------------------------------------------------------
  // 1. MANAGED DATABASES FILTERING & SORTING LOGIC
  // -------------------------------------------------------------
  const availableDbEngines = useMemo(() => {
    const engines = new Set<string>();
    const activeEngines = databaseEngines.filter((eng) => eng.statusOnOff === 'ACTIVE');
    if (activeEngines.length > 0) {
      activeEngines.forEach((eng) => {
        if (eng.dbCode) engines.add(eng.dbCode.toUpperCase());
      });
    } else {
      databases.forEach((db) => {
        if (db.dbType) engines.add(db.dbType.toUpperCase());
      });
    }
    return Array.from(engines).sort();
  }, [databases, databaseEngines]);

  // Unique tags extracted from databases
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    databases.forEach((db) => {
      if (Array.isArray(db.tags)) {
        db.tags.forEach((t) => {
          if (t && typeof t === 'string' && t.trim()) {
            tagSet.add(t.trim());
          }
        });
      }
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [databases]);

  const filteredDatabases = useMemo(() => {
    return databases.filter((db) => {
      // Engine filter
      if (dbEngineFilter !== 'ALL' && db.dbType.toUpperCase() !== dbEngineFilter.toUpperCase()) {
        return false;
      }
      // Tag filter
      if (dbTagFilter !== 'ALL') {
        if (!Array.isArray(db.tags) || !db.tags.includes(dbTagFilter)) {
          return false;
        }
      }
      // Show only selected
      if (dbShowOnlySelected && !formData.databaseIds.includes(db.id)) {
        return false;
      }
      // Search query
      if (dbSearch.trim()) {
        const q = dbSearch.toLowerCase().trim();
        const matchName = db.name.toLowerCase().includes(q);
        const matchHost = db.host.toLowerCase().includes(q);
        const matchPort = String(db.port || '').includes(q);
        const matchType = db.dbType.toLowerCase().includes(q);
        const matchEnv = (db.environment || '').toLowerCase().includes(q);
        const matchTags = Array.isArray(db.tags) && db.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchHost && !matchPort && !matchType && !matchEnv && !matchTags) {
          return false;
        }
      }
      return true;
    });
  }, [databases, dbEngineFilter, dbTagFilter, dbShowOnlySelected, dbSearch, formData.databaseIds]);

  // Apply sorting
  const sortedDatabases = useMemo(() => {
    return [...filteredDatabases].sort((a, b) => {
      if (dbSortOption === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (dbSortOption === 'name_desc') {
        return b.name.localeCompare(a.name);
      }
      if (dbSortOption === 'created_desc') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA === timeB) return b.id.localeCompare(a.id);
        return timeB - timeA;
      }
      if (dbSortOption === 'created_asc') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA === timeB) return a.id.localeCompare(b.id);
        return timeA - timeB;
      }
      return 0;
    });
  }, [filteredDatabases, dbSortOption]);

  const toggleAllFilteredDatabases = (select: boolean) => {
    const filteredIds = sortedDatabases.map((d) => d.id);
    if (select) {
      const merged = Array.from(new Set([...formData.databaseIds, ...filteredIds]));
      setFormData((prev) => ({ ...prev, databaseIds: merged }));
    } else {
      setFormData((prev) => ({
        ...prev,
        databaseIds: prev.databaseIds.filter((id) => !filteredIds.includes(id)),
      }));
    }
  };

  const resetDbFilters = () => {
    setDbSearch('');
    setDbEngineFilter('ALL');
    setDbTagFilter('ALL');
    setDbSortOption('created_desc');
    setDbShowOnlySelected(false);
  };

  // -------------------------------------------------------------
  // 2. TEMPLATES FILTERING LOGIC
  // -------------------------------------------------------------
  const availableTemplateEngines = useMemo(() => {
    const engines = new Set<string>();
    const activeEngineCodes = new Set(
      databaseEngines
        .filter((e) => e.statusOnOff === 'ACTIVE')
        .map((e) => e.dbCode.toUpperCase())
    );
    templates.forEach((t) => {
      if (t.targetDbType && t.targetDbType.toUpperCase() !== 'ALL') {
        const codeUpper = t.targetDbType.toUpperCase();
        if (activeEngineCodes.size === 0 || activeEngineCodes.has(codeUpper)) {
          engines.add(codeUpper);
        }
      }
    });
    return Array.from(engines).sort();
  }, [templates, databaseEngines]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      if (tplEngineFilter === 'UNIVERSAL') {
        if (tpl.targetDbType && tpl.targetDbType.toUpperCase() !== 'ALL') return false;
      } else if (tplEngineFilter !== 'ALL') {
        if ((tpl.targetDbType || '').toUpperCase() !== tplEngineFilter.toUpperCase()) return false;
      }

      if (tplShowOnlySelected && !formData.templateIds.includes(tpl.id)) {
        return false;
      }

      if (tplSearch.trim()) {
        const q = tplSearch.toLowerCase().trim();
        const matchName = tpl.name.toLowerCase().includes(q);
        const matchDesc = (tpl.description || '').toLowerCase().includes(q);
        const matchTarget = (tpl.targetDbType || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchTarget) {
          return false;
        }
      }
      return true;
    });
  }, [templates, tplEngineFilter, tplShowOnlySelected, tplSearch, formData.templateIds]);

  const toggleAllFilteredTemplates = (select: boolean) => {
    const filteredIds = filteredTemplates.map((t) => t.id);
    if (select) {
      const merged = Array.from(new Set([...formData.templateIds, ...filteredIds]));
      setFormData((prev) => ({ ...prev, templateIds: merged }));
    } else {
      setFormData((prev) => ({
        ...prev,
        templateIds: prev.templateIds.filter((id) => !filteredIds.includes(id)),
      }));
    }
  };

  // -------------------------------------------------------------
  // 3. ALERT DISPATCHERS FILTERING LOGIC
  // -------------------------------------------------------------
  const availableDispatcherTypes = useMemo(() => {
    const types = new Set<string>();
    alertMethods.forEach((m) => {
      if (m.type) types.add(m.type.toUpperCase());
    });
    return Array.from(types).sort();
  }, [alertMethods]);

  const filteredAlertMethods = useMemo(() => {
    return alertMethods.filter((method) => {
      if (dispTypeFilter !== 'ALL' && method.type.toUpperCase() !== dispTypeFilter.toUpperCase()) {
        return false;
      }

      const isChecked = formData.notificationMappings.some((m) => m.notificationMethodId === method.id);
      if (dispShowOnlySelected && !isChecked) {
        return false;
      }

      if (dispSearch.trim()) {
        const q = dispSearch.toLowerCase().trim();
        const matchName = method.name.toLowerCase().includes(q);
        const matchType = method.type.toLowerCase().includes(q);
        const configStr = JSON.stringify(method.configJson || {}).toLowerCase();
        const matchConfig = configStr.includes(q);
        if (!matchName && !matchType && !matchConfig) {
          return false;
        }
      }
      return true;
    });
  }, [alertMethods, dispTypeFilter, dispShowOnlySelected, dispSearch, formData.notificationMappings]);

  const toggleAllFilteredDispatchers = (select: boolean) => {
    const filteredIds = filteredAlertMethods.map((m) => m.id);
    if (select) {
      setFormData((prev) => {
        const currentIds = new Set(prev.notificationMappings.map((m) => m.notificationMethodId));
        const newMappings = [...prev.notificationMappings];
        filteredIds.forEach((id) => {
          if (!currentIds.has(id)) {
            newMappings.push({ notificationMethodId: id, senderIds: '' });
          }
        });
        return { ...prev, notificationMappings: newMappings };
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        notificationMappings: prev.notificationMappings.filter(
          (m) => !filteredIds.includes(m.notificationMethodId)
        ),
      }));
    }
  };

  const getDispatcherTypeBadge = (type: string) => {
    switch (type.toUpperCase()) {
      case 'TELEGRAM':
        return {
          icon: <Send className="w-3.5 h-3.5 text-sky-500" />,
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
        };
      case 'EMAIL':
        return {
          icon: <Mail className="w-3.5 h-3.5 text-emerald-500" />,
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'WEBHOOK':
        return {
          icon: <Globe className="w-3.5 h-3.5 text-purple-500" />,
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        };
      default:
        return {
          icon: <Radio className="w-3.5 h-3.5 text-indigo-500" />,
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Group name is required.', type: 'error' });
      return;
    }

    const cleanMappings = formData.notificationMappings.map((m) => ({
      notificationMethodId: m.notificationMethodId,
      senderIds: m.senderIds.trim(),
    }));

    onSaveGroup(
      {
        id: formData.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        databaseIds: formData.databaseIds,
        templateIds: formData.templateIds,
        notificationMappings: cleanMappings,
        alertMethodIds: cleanMappings.map((m) => m.notificationMethodId),
        senderIds: cleanMappings.map((m) => m.senderIds).filter(Boolean).join(', '),
      },
      formData.databaseIds
    );

    onClose();
    toast({
      title: formData.id ? 'Group Updated' : 'Group Created',
      description: `Database group "${formData.name}" saved successfully.`,
      type: 'success',
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingGroup ? `${t('groups.editGroupTitle')}: ${editingGroup.name}` : t('groups.createGroupTitle')}
      description={t('groups.dialogDesc')}
      maxWidth="5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* ============================================================== */}
        {/* TOP PINNED PANEL: General Group Metadata */}
        {/* ============================================================== */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                {t('groups.groupNameLabel')}
              </label>
              <input
                type="text"
                required
                placeholder={t('groups.groupNamePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-800 font-bold mb-1">
                {t('groups.description')}
              </label>
              <input
                type="text"
                placeholder={t('groups.descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION NAVIGATION TABS */}
        {/* ============================================================== */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`flex-1 min-w-[200px] flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 1
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold'
            }`}
          >
            <div className="flex items-center gap-2">
              <Server className={`w-4 h-4 shrink-0 ${activeTab === 1 ? 'text-white' : 'text-indigo-600'}`} />
              <span>{t('groups.sectionManagedDbs') || '1. Managed Databases'}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 1 ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {formData.databaseIds.length} / {databases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(2)}
            className={`flex-1 min-w-[200px] flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 2
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className={`w-4 h-4 shrink-0 ${activeTab === 2 ? 'text-white' : 'text-indigo-600'}`} />
              <span>{t('groups.sectionTemplates') || '2. Applied Templates'}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 2 ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {formData.templateIds.length} / {templates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(3)}
            className={`flex-1 min-w-[200px] flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 3
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold'
            }`}
          >
            <div className="flex items-center gap-2">
              <BellRing className={`w-4 h-4 shrink-0 ${activeTab === 3 ? 'text-white' : 'text-indigo-600'}`} />
              <span>{t('groups.sectionDispatchers') || '3. Alert Dispatchers'}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 3 ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {formData.notificationMappings.length} / {alertMethods.length}
            </span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* SECTION 1: MANAGED DATABASES */}
        {/* ============================================================== */}
        {activeTab === 1 && (
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            {/* Header & Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span className="text-slate-900 font-bold text-sm">
                    {t('groups.managedDatabases')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {formData.databaseIds.length} / {databases.length} {t('groups.selected')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('groups.managedDatabasesDesc')}
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px]">
                <button
                  type="button"
                  onClick={() => toggleAllFilteredDatabases(true)}
                  disabled={sortedDatabases.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  title="Select all databases matching current search, engine, tag, and sort filters"
                >
                  Select Filtered ({sortedDatabases.length})
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllFilteredDatabases(false)}
                  disabled={sortedDatabases.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  title="Deselect all databases matching current filter"
                >
                  Deselect Filtered
                </button>
                {formData.databaseIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, databaseIds: [] }))}
                    className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Comprehensive Filter & Sort Panel */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
                {/* Search Box */}
                <div className="lg:col-span-4 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search name, host, port, env, tag..."
                    value={dbSearch}
                    onChange={(e) => setDbSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                  {dbSearch && (
                    <button
                      type="button"
                      onClick={() => setDbSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter by DB Engine */}
                <div className="lg:col-span-3 relative">
                  <DatabaseEngineFilter
                    value={dbEngineFilter}
                    onChange={(val) => setDbEngineFilter(val)}
                    databases={databases}
                    databaseEngines={databaseEngines}
                    allLabel={`All DB Engines (${databases.length})`}
                    className="w-full text-xs font-medium shadow-2xs"
                  />
                </div>

                {/* Filter by Tag */}
                <div className="lg:col-span-3 relative">
                  <select
                    value={dbTagFilter}
                    onChange={(e) => setDbTagFilter(e.target.value)}
                    className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">
                      🏷️ {t('groups.allTags') || 'All Tags'} ({databases.length})
                    </option>
                    {availableTags.map((tag) => {
                      const count = databases.filter((d) => Array.isArray(d.tags) && d.tags.includes(tag)).length;
                      return (
                        <option key={tag} value={tag}>
                          🏷️ {tag} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Sort Option */}
                <div className="lg:col-span-2 relative">
                  <select
                    value={dbSortOption}
                    onChange={(e) => setDbSortOption(e.target.value as any)}
                    className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="created_desc">🆕 {t('groups.sortNewest') || 'Newest Created'}</option>
                    <option value="created_asc">⏳ {t('groups.sortOldest') || 'Oldest Created'}</option>
                    <option value="name_asc">🔤 {t('groups.sortNameAsc') || 'Name (A → Z)'}</option>
                    <option value="name_desc">🔤 {t('groups.sortNameDesc') || 'Name (Z → A)'}</option>
                  </select>
                </div>
              </div>

              {/* Bottom toolbar status & selected toggle */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                  <span>Showing <strong className="text-slate-800">{sortedDatabases.length}</strong> of {databases.length} databases</span>
                  {(dbEngineFilter !== 'ALL' || dbTagFilter !== 'ALL' || dbSearch || dbShowOnlySelected) && (
                    <button
                      type="button"
                      onClick={resetDbFilters}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold ml-2 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset filters
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDbShowOnlySelected(!dbShowOnlySelected)}
                  className={`py-1 px-3 rounded-lg font-semibold text-[11px] border transition-all cursor-pointer ${
                    dbShowOnlySelected
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {dbShowOnlySelected ? '✓ Selected Only' : 'Show All'}
                </button>
              </div>
            </div>

            {/* Database Items List */}
            <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto bg-white p-2">
              {sortedDatabases.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic space-y-2">
                  <Server className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No databases match the selected engine, tag, sort option, or search query.</p>
                  <button
                    type="button"
                    onClick={resetDbFilters}
                    className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sortedDatabases.map((db) => {
                    const isSelected = formData.databaseIds.includes(db.id);
                    return (
                      <label
                        key={db.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-300 text-slate-900 shadow-2xs ring-1 ring-indigo-200'
                            : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/70 text-slate-700'
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
                          className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 truncate text-xs" title={db.name}>
                              {db.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded border shrink-0 ${getDbEngineBadgeClass(
                                db.dbType
                              )}`}
                            >
                              {db.dbType}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span className="truncate" title={`${db.host}:${db.port}`}>
                              {db.host}:{db.port}
                            </span>
                            {db.environment && (
                              <span className="px-1 py-0.2 bg-slate-200 text-slate-700 rounded text-[9px] font-sans font-semibold">
                                {db.environment}
                              </span>
                            )}
                          </div>

                          {/* Tags Display */}
                          {Array.isArray(db.tags) && db.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {db.tags.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white text-slate-600 border border-slate-200 shadow-2xs"
                                >
                                  <Tag className="w-2.5 h-2.5 text-indigo-500" />
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION 2: APPLIED MONITORING TEMPLATES */}
        {/* ============================================================== */}
        {activeTab === 2 && (
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            {/* Header & Counters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span className="text-slate-900 font-bold text-sm">
                    {t('groups.appliedMonitoringTemplates')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {formData.templateIds.length} / {templates.length} {t('groups.selected')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('groups.appliedMonitoringTemplatesDesc')}
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px]">
                <button
                  type="button"
                  onClick={() => toggleAllFilteredTemplates(true)}
                  disabled={filteredTemplates.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  title="Select all templates matching current search and engine filter"
                >
                  Select Filtered ({filteredTemplates.length})
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllFilteredTemplates(false)}
                  disabled={filteredTemplates.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  title="Deselect all templates matching current filter"
                >
                  Deselect Filtered
                </button>
                {formData.templateIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, templateIds: [] }))}
                    className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Search & Engine Filter Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {/* Search Input */}
              <div className="sm:col-span-6 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search templates by name, metric, description..."
                  value={tplSearch}
                  onChange={(e) => setTplSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
                {tplSearch && (
                  <button
                    type="button"
                    onClick={() => setTplSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter by DB Engine Compatibility */}
              <div className="sm:col-span-4 relative">
                <select
                  value={tplEngineFilter}
                  onChange={(e) => setTplEngineFilter(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Compatibility ({templates.length})</option>
                  <option value="UNIVERSAL">
                    Universal ({templates.filter((t) => !t.targetDbType || t.targetDbType === 'ALL').length})
                  </option>
                  {availableTemplateEngines.map((engine) => {
                    const count = templates.filter(
                      (t) => (t.targetDbType || '').toUpperCase() === engine
                    ).length;
                    return (
                      <option key={engine} value={engine}>
                        {engine} Engine ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Only Selected Toggle */}
              <div className="sm:col-span-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setTplShowOnlySelected(!tplShowOnlySelected)}
                  className={`w-full py-1.5 px-2 rounded-lg font-semibold text-[11px] border transition-all cursor-pointer truncate ${
                    tplShowOnlySelected
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {tplShowOnlySelected ? '✓ Selected Only' : 'Show All'}
                </button>
              </div>
            </div>

            {/* Template Items List */}
            <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto bg-white p-2">
              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">
                  No templates match the selected engine compatibility or search query.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredTemplates.map((tpl) => {
                    const isSelected = formData.templateIds.includes(tpl.id);
                    const isUniversal = !tpl.targetDbType || tpl.targetDbType.toUpperCase() === 'ALL';
                    return (
                      <label
                        key={tpl.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-300 text-slate-900 shadow-2xs ring-1 ring-indigo-200'
                            : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/70 text-slate-700'
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
                          className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 truncate text-xs" title={tpl.name}>
                              {tpl.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded border shrink-0 ${
                                isUniversal
                                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                                  : getDbEngineBadgeClass(tpl.targetDbType)
                              }`}
                            >
                              {isUniversal ? t('groups.universal') : tpl.targetDbType}
                            </span>
                          </div>
                          {tpl.description && (
                            <p className="text-[10px] text-slate-500 line-clamp-2" title={tpl.description}>
                              {tpl.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SECTION 3: ALERT NOTIFICATION DISPATCHERS */}
        {/* ============================================================== */}
        {activeTab === 3 && (
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            {/* Header & Counters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-indigo-600" />
                  <span className="text-slate-900 font-bold text-sm">
                    {t('groups.alertNotificationDispatchers')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {formData.notificationMappings.length} / {alertMethods.length} {t('groups.selected')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('groups.boundFromSystemSettings')}
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px]">
                <button
                  type="button"
                  onClick={() => toggleAllFilteredDispatchers(true)}
                  disabled={filteredAlertMethods.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  title="Select all dispatchers matching current search and filter"
                >
                  Select Filtered ({filteredAlertMethods.length})
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllFilteredDispatchers(false)}
                  disabled={filteredAlertMethods.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  title="Deselect all dispatchers matching current filter"
                >
                  Deselect Filtered
                </button>
                {formData.notificationMappings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, notificationMappings: [] }))}
                    className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Search & Channel Type Filter Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="sm:col-span-6 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search dispatchers by name, type, endpoint, bot..."
                  value={dispSearch}
                  onChange={(e) => setDispSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
                {dispSearch && (
                  <button
                    type="button"
                    onClick={() => setDispSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="sm:col-span-4 relative">
                <select
                  value={dispTypeFilter}
                  onChange={(e) => setDispTypeFilter(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Dispatcher Types ({alertMethods.length})</option>
                  {availableDispatcherTypes.map((type) => {
                    const count = alertMethods.filter((m) => m.type.toUpperCase() === type).length;
                    return (
                      <option key={type} value={type}>
                        {type} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setDispShowOnlySelected(!dispShowOnlySelected)}
                  className={`w-full py-1.5 px-2 rounded-lg font-semibold text-[11px] border transition-all cursor-pointer truncate ${
                    dispShowOnlySelected
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {dispShowOnlySelected ? '✓ Selected Only' : 'Show All'}
                </button>
              </div>
            </div>

            {/* Alert Dispatchers Grid */}
            <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto bg-white p-2">
              {filteredAlertMethods.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">
                  {alertMethods.length === 0
                    ? t('groups.noDispatchersConfigured')
                    : 'No alert dispatchers match the selected type or search query.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredAlertMethods.map((method) => {
                    const isChecked = formData.notificationMappings.some(
                      (m) => m.notificationMethodId === method.id
                    );
                    const { icon, badgeClass } = getDispatcherTypeBadge(method.type);

                    return (
                      <label
                        key={method.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-indigo-50/80 border-indigo-300 text-slate-900 shadow-2xs ring-1 ring-indigo-200'
                            : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/70 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                notificationMappings: [
                                  ...formData.notificationMappings,
                                  { notificationMethodId: method.id, senderIds: '' },
                                ],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                notificationMappings: formData.notificationMappings.filter(
                                  (m) => m.notificationMethodId !== method.id
                                ),
                              });
                            }
                          }}
                          className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 truncate text-xs flex items-center gap-1.5">
                              {icon}
                              {method.name}
                            </span>
                            <span className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded border shrink-0 ${badgeClass}`}>
                              {method.type}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate font-mono">
                            {method.configJson?.smtpHost ||
                              method.configJson?.endpoint ||
                              method.configJson?.botUsername ||
                              'Active Routing Endpoint'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Target Destinations Configuration */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-600" />
                  {t('groups.targetSendersTitle')}
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  {formData.notificationMappings.length} channel(s) configured
                </span>
              </div>

              {formData.notificationMappings.length === 0 ? (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2 font-medium">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t('groups.selectAtLeastOneChannel')}</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {formData.notificationMappings.map((mapItem) => {
                    const method = alertMethods.find((m) => m.id === mapItem.notificationMethodId);
                    if (!method) return null;

                    const { icon, badgeClass } = getDispatcherTypeBadge(method.type);

                    let placeholder = 'e.g. dba-team@company.internal';
                    let helperText = 'Comma-separated target destination addresses.';
                    if (method.type === 'TELEGRAM') {
                      placeholder = 'e.g. -1001234567890, 987654321 (Telegram Chat IDs)';
                      helperText = 'Target Telegram Chat IDs or Channel IDs (numeric, comma-separated).';
                    } else if (method.type === 'EMAIL') {
                      placeholder = 'e.g. dba-team@company.internal, oncall@company.com';
                      helperText = 'Email recipient addresses (comma-separated).';
                    } else if (method.type === 'WEBHOOK') {
                      placeholder = 'e.g. https://api.company.internal/alerts or webhook channel token';
                      helperText = 'Webhook URL or routing keys to receive alert JSON payloads.';
                    }

                    return (
                      <div
                        key={mapItem.notificationMethodId}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-1.5 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {icon}
                            <span className="font-bold text-slate-900 text-xs">{method.name}</span>
                            <span className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded border ${badgeClass}`}>
                              {method.type}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                notificationMappings: prev.notificationMappings.filter(
                                  (m) => m.notificationMethodId !== mapItem.notificationMethodId
                                ),
                              }));
                            }}
                            className="text-slate-400 hover:text-rose-600 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Remove
                          </button>
                        </div>

                        <input
                          type="text"
                          placeholder={placeholder}
                          value={mapItem.senderIds}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              notificationMappings: prev.notificationMappings.map((m) =>
                                m.notificationMethodId === mapItem.notificationMethodId
                                  ? { ...m, senderIds: nextVal }
                                  : m
                              ),
                            }));
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                        />
                        <div className="text-[10px] text-slate-500">{helperText}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* FORM FOOTER ACTIONS */}
        {/* ============================================================== */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {activeTab > 1 && (
              <button
                type="button"
                onClick={() => setActiveTab((prev) => (prev - 1) as any)}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer text-xs flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('groups.prevSection') || 'Previous Section'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab < 3 ? (
              <button
                type="button"
                onClick={() => setActiveTab((prev) => (prev + 1) as any)}
                className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors cursor-pointer text-xs flex items-center gap-1 border border-indigo-200"
              >
                {t('groups.nextSection') || 'Next Section'}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold transition-colors cursor-pointer text-xs"
            >
              {t('common.cancel')}
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-2xs hover:shadow-sm cursor-pointer text-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {editingGroup ? t('groups.saveGroupConfiguration') : t('groups.createGroup')}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
};
