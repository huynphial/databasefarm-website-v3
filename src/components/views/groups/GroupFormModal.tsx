import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronDown,
  CheckSquare,
  Square,
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
  const [dbSelectedTags, setDbSelectedTags] = useState<string[]>([]);
  const [dbTagDropdownOpen, setDbTagDropdownOpen] = useState(false);
  const [dbTagSearch, setDbTagSearch] = useState('');
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

  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setDbTagDropdownOpen(false);
      }
    };
    if (dbTagDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [dbTagDropdownOpen]);

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
      setDbSelectedTags([]);
      setDbTagDropdownOpen(false);
      setDbTagSearch('');
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

  // Unique tags with frequency count extracted from databases
  const availableTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    databases.forEach((db) => {
      if (Array.isArray(db.tags)) {
        db.tags.forEach((t) => {
          if (t && typeof t === 'string' && t.trim()) {
            const clean = t.trim();
            tagMap.set(clean, (tagMap.get(clean) || 0) + 1);
          }
        });
      }
    });
    return Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [databases]);

  // Filtered tags for dropdown search
  const filteredAvailableTags = useMemo(() => {
    if (!dbTagSearch.trim()) return availableTags;
    const q = dbTagSearch.toLowerCase().trim();
    return availableTags.filter((item) => item.tag.toLowerCase().includes(q));
  }, [availableTags, dbTagSearch]);

  const toggleTagSelection = (tag: string) => {
    setDbSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filteredDatabases = useMemo(() => {
    return databases.filter((db) => {
      // Engine filter
      if (dbEngineFilter !== 'ALL' && db.dbType.toUpperCase() !== dbEngineFilter.toUpperCase()) {
        return false;
      }
      // Multi-tag filter: matches if database has at least one of the selected tags
      if (dbSelectedTags.length > 0) {
        if (!Array.isArray(db.tags) || !db.tags.some((t) => dbSelectedTags.includes(t))) {
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
  }, [databases, dbEngineFilter, dbSelectedTags, dbShowOnlySelected, dbSearch, formData.databaseIds]);

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
    setDbSelectedTags([]);
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
      <form onSubmit={handleSubmit} className="flex flex-col space-y-3.5 text-xs">
        {/* ============================================================== */}
        {/* TOP PINNED PANEL: General Group Metadata */}
        {/* ============================================================== */}
        <div className="bg-slate-50/90 border border-slate-200 p-3 rounded-xl shadow-2xs shrink-0">
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
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-xs shadow-2xs"
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
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION NAVIGATION TABS (Fixed, stable size) */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-slate-200 pb-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 1
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold ring-2 ring-indigo-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Server className={`w-3.5 h-3.5 shrink-0 ${activeTab === 1 ? 'text-white' : 'text-indigo-600'}`} />
              <span className="truncate">{t('groups.sectionManagedDbs') || '1. Managed Databases'}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-1.5 ${
                activeTab === 1 ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {formData.databaseIds.length} / {databases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(2)}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 2
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold ring-2 ring-indigo-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Layers className={`w-3.5 h-3.5 shrink-0 ${activeTab === 2 ? 'text-white' : 'text-indigo-600'}`} />
              <span className="truncate">{t('groups.sectionTemplates') || '2. Applied Templates'}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-1.5 ${
                activeTab === 2 ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {formData.templateIds.length} / {templates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(3)}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 3
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold ring-2 ring-indigo-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <BellRing className={`w-3.5 h-3.5 shrink-0 ${activeTab === 3 ? 'text-white' : 'text-indigo-600'}`} />
              <span className="truncate">{t('groups.sectionDispatchers') || '3. Alert Dispatchers'}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-1.5 ${
                activeTab === 3 ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {formData.notificationMappings.length} / {alertMethods.length}
            </span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* MAIN SECTION CONTENT (Fixed, stable container height h-[460px]) */}
        {/* ============================================================== */}
        <div className="h-[460px] flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          {/* ------------------------------------------------------------ */}
          {/* TAB 1: MANAGED DATABASES (Single column tick list + multi-tag) */}
          {/* ------------------------------------------------------------ */}
          {activeTab === 1 && (
            <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
              {/* Header & Quick Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 shrink-0">
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
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    title="Select all databases matching current search, engine, multi-tag, and sort filters"
                  >
                    Select Filtered ({sortedDatabases.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllFilteredDatabases(false)}
                    disabled={sortedDatabases.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    title="Deselect all databases matching current filter"
                  >
                    Deselect Filtered
                  </button>
                  {formData.databaseIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, databaseIds: [] }))}
                      className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Comprehensive Filter Toolbar with Multi-Tag & Sort */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2 shrink-0">
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

                  {/* Filter by Multi-Tag Selector Popover */}
                  <div className="lg:col-span-3 relative" ref={tagDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setDbTagDropdownOpen(!dbTagDropdownOpen)}
                      className={`w-full py-1.5 px-2.5 bg-white border rounded-lg text-xs font-medium flex items-center justify-between gap-1 shadow-2xs cursor-pointer transition-all ${
                        dbSelectedTags.length > 0
                          ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 font-bold'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Tag className={`w-3 h-3 shrink-0 ${dbSelectedTags.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="truncate">
                          {dbSelectedTags.length === 0
                            ? t('groups.allTags') || 'All Tags'
                            : `${dbSelectedTags.length} tag(s) selected`}
                        </span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>

                    {/* Multi-Tag Dropdown Popover */}
                    {dbTagDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-[11px] flex items-center gap-1">
                            <Tag className="w-3 h-3 text-indigo-600" />
                            {t('groups.filterByTags') || 'Filter by Tags'}
                          </span>
                          {dbSelectedTags.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setDbSelectedTags([])}
                              className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                            >
                              {t('groups.clearTags') || 'Clear'}
                            </button>
                          )}
                        </div>

                        {/* Search tags inside dropdown */}
                        {availableTags.length > 5 && (
                          <div className="relative">
                            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Find tag..."
                              value={dbTagSearch}
                              onChange={(e) => setDbTagSearch(e.target.value)}
                              className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-900 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        )}

                        {/* Tags Checkbox List */}
                        <div className="max-h-44 overflow-y-auto space-y-0.5 py-0.5 divide-y divide-slate-50">
                          {filteredAvailableTags.length === 0 ? (
                            <div className="py-2 text-center text-slate-400 text-[11px] italic">
                              No tags match
                            </div>
                          ) : (
                            filteredAvailableTags.map(({ tag, count }) => {
                              const isChecked = dbSelectedTags.includes(tag);
                              return (
                                <button
                                  type="button"
                                  key={tag}
                                  onClick={() => toggleTagSelection(tag)}
                                  className={`w-full flex items-center justify-between p-1.5 rounded-md text-[11px] transition-colors cursor-pointer text-left ${
                                    isChecked
                                      ? 'bg-indigo-50 text-indigo-900 font-bold'
                                      : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {isChecked ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    )}
                                    <span className="truncate">{tag}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                                    ({count})
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Quick actions inside dropdown */}
                        <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <button
                            type="button"
                            onClick={() => setDbSelectedTags(availableTags.map((t) => t.tag))}
                            className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                          >
                            {t('groups.selectAllTags') || 'Select All'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDbTagDropdownOpen(false)}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sort Option Dropdown */}
                  <div className="lg:col-span-2 relative">
                    <select
                      value={dbSortOption}
                      onChange={(e) => setDbSortOption(e.target.value as any)}
                      className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                    >
                      <option value="created_desc">🆕 {t('groups.sortNewest') || 'Newest Created'}</option>
                      <option value="created_asc">⏳ {t('groups.sortOldest') || 'Oldest Created'}</option>
                      <option value="name_asc">🔤 {t('groups.sortNameAsc') || 'Name (A → Z)'}</option>
                      <option value="name_desc">🔤 {t('groups.sortNameDesc') || 'Name (Z → A)'}</option>
                    </select>
                  </div>
                </div>

                {/* Active Tag Chips & Filter Bar Status */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 font-medium">
                    <span>
                      Showing <strong className="text-slate-900 font-bold">{sortedDatabases.length}</strong> of {databases.length} databases
                    </span>

                    {/* Active Selected Tag Pills */}
                    {dbSelectedTags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 ml-1.5">
                        {dbSelectedTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                            <button
                              type="button"
                              onClick={() => toggleTagSelection(tag)}
                              className="hover:text-rose-600 cursor-pointer ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {(dbEngineFilter !== 'ALL' || dbSelectedTags.length > 0 || dbSearch || dbShowOnlySelected) && (
                      <button
                        type="button"
                        onClick={resetDbFilters}
                        className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold ml-2 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDbShowOnlySelected(!dbShowOnlySelected)}
                    className={`py-1 px-2.5 rounded-lg font-semibold text-[11px] border transition-all cursor-pointer ${
                      dbShowOnlySelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {dbShowOnlySelected ? '✓ Selected Only' : 'Show All'}
                  </button>
                </div>
              </div>

              {/* SINGLE COLUMN DATABASE LIST (One column to tick) */}
              <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200 rounded-xl bg-slate-50/40 divide-y divide-slate-200/80">
                {sortedDatabases.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic space-y-2">
                    <Server className="w-8 h-8 text-slate-300 mx-auto" />
                    <p>No databases match the selected engine, tags, sort option, or search query.</p>
                    <button
                      type="button"
                      onClick={resetDbFilters}
                      className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  </div>
                ) : (
                  sortedDatabases.map((db) => {
                    const isSelected = formData.databaseIds.includes(db.id);
                    return (
                      <label
                        key={db.id}
                        className={`flex items-center justify-between gap-3 px-3 py-2 transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-indigo-50/90 text-slate-900 font-medium'
                            : 'bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {/* Left Side: Checkbox, Name, Engine, Env, Host:Port */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
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
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0"
                          />

                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className={`font-bold truncate text-xs ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`} title={db.name}>
                              {db.name}
                            </span>

                            <span
                              className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded border shrink-0 ${getDbEngineBadgeClass(
                                db.dbType
                              )}`}
                            >
                              {db.dbType}
                            </span>

                            {db.environment && (
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-sans font-semibold shrink-0">
                                {db.environment}
                              </span>
                            )}

                            <span className="text-[11px] text-slate-500 font-mono truncate" title={`${db.host}:${db.port}`}>
                              {db.host}:{db.port}
                            </span>
                          </div>
                        </div>

                        {/* Right Side: Tags Pills */}
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          {Array.isArray(db.tags) && db.tags.length > 0 ? (
                            db.tags.map((t) => {
                              const isTagFiltered = dbSelectedTags.includes(t);
                              return (
                                <span
                                  key={t}
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border shadow-2xs ${
                                    isTagFiltered
                                      ? 'bg-indigo-600 text-white border-indigo-700'
                                      : 'bg-white text-slate-600 border-slate-200'
                                  }`}
                                >
                                  <Tag className="w-2.5 h-2.5" />
                                  {t}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-300 italic font-mono">no tags</span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* TAB 2: APPLIED MONITORING TEMPLATES (Single column tick list) */}
          {/* ------------------------------------------------------------ */}
          {activeTab === 2 && (
            <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
              {/* Header & Counters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 shrink-0">
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
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    title="Select all templates matching current search and engine filter"
                  >
                    Select Filtered ({filteredTemplates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllFilteredTemplates(false)}
                    disabled={filteredTemplates.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    title="Deselect all templates matching current filter"
                  >
                    Deselect Filtered
                  </button>
                  {formData.templateIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, templateIds: [] }))}
                      className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Search & Engine Compatibility Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
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

              {/* SINGLE COLUMN TEMPLATES LIST (One column to tick) */}
              <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200 rounded-xl bg-slate-50/40 divide-y divide-slate-200/80">
                {filteredTemplates.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic">
                    No templates match the selected engine compatibility or search query.
                  </div>
                ) : (
                  filteredTemplates.map((tpl) => {
                    const isSelected = formData.templateIds.includes(tpl.id);
                    const isUniversal = !tpl.targetDbType || tpl.targetDbType.toUpperCase() === 'ALL';
                    return (
                      <label
                        key={tpl.id}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-indigo-50/90 text-slate-900 font-medium'
                            : 'bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
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
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0"
                          />

                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className={`font-bold truncate text-xs ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`} title={tpl.name}>
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
                            {tpl.description && (
                              <span className="text-[11px] text-slate-500 truncate max-w-md hidden md:inline" title={tpl.description}>
                                — {tpl.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono shrink-0">
                          ID: {tpl.id.slice(0, 8)}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* TAB 3: ALERT NOTIFICATION DISPATCHERS (Single column tick list) */}
          {/* ------------------------------------------------------------ */}
          {activeTab === 3 && (
            <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
              {/* Header & Counters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 shrink-0">
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
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    title="Select all dispatchers matching current search and filter"
                  >
                    Select Filtered ({filteredAlertMethods.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllFilteredDispatchers(false)}
                    disabled={filteredAlertMethods.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    title="Deselect all dispatchers matching current filter"
                  >
                    Deselect Filtered
                  </button>
                  {formData.notificationMappings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, notificationMappings: [] }))}
                      className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Search & Channel Type Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
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

              {/* SINGLE COLUMN ALERT DISPATCHERS LIST & TARGET DESTINATIONS CONFIG */}
              <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0">
                {/* Dispatcher Selection List (Left Column) */}
                <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200 rounded-xl bg-slate-50/40 divide-y divide-slate-200/80">
                  {filteredAlertMethods.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic">
                      {alertMethods.length === 0
                        ? t('groups.noDispatchersConfigured')
                        : 'No alert dispatchers match the selected type or search query.'}
                    </div>
                  ) : (
                    filteredAlertMethods.map((method) => {
                      const isChecked = formData.notificationMappings.some(
                        (m) => m.notificationMethodId === method.id
                      );
                      const { icon, badgeClass } = getDispatcherTypeBadge(method.type);

                      return (
                        <label
                          key={method.id}
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 transition-colors cursor-pointer select-none ${
                            isChecked
                              ? 'bg-indigo-50/90 text-slate-900 font-medium'
                              : 'bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
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
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0"
                            />

                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0">{icon}</span>
                              <span className={`font-bold truncate text-xs ${isChecked ? 'text-indigo-950' : 'text-slate-900'}`} title={method.name}>
                                {method.name}
                              </span>
                              <span className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded border shrink-0 ${badgeClass}`}>
                                {method.type}
                              </span>
                            </div>
                          </div>

                          <div className="text-[10px] text-slate-400 truncate max-w-[140px] font-mono shrink-0">
                            {method.configJson?.smtpHost ||
                              method.configJson?.endpoint ||
                              method.configJson?.botUsername ||
                              'Active'}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Target Destinations Configuration Panel (Right Column) */}
                <div className="w-full md:w-80 flex flex-col min-h-0 border border-slate-200 rounded-xl bg-slate-50/80 p-3 space-y-2 shrink-0">
                  <div className="flex items-center justify-between shrink-0 border-b border-slate-200/80 pb-1.5">
                    <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-indigo-600" />
                      {t('groups.targetSendersTitle')}
                    </label>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold border border-indigo-200">
                      {formData.notificationMappings.length} configured
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-0.5">
                    {formData.notificationMappings.length === 0 ? (
                      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex flex-col items-center text-center gap-2 font-medium justify-center h-full">
                        <Info className="w-5 h-5 text-amber-600 shrink-0" />
                        <span>{t('groups.selectAtLeastOneChannel')}</span>
                      </div>
                    ) : (
                      formData.notificationMappings.map((mapItem) => {
                        const method = alertMethods.find((m) => m.id === mapItem.notificationMethodId);
                        if (!method) return null;

                        const { icon, badgeClass } = getDispatcherTypeBadge(method.type);

                        let placeholder = 'e.g. dba-team@company.internal';
                        let helperText = 'Comma-separated target destination addresses.';
                        if (method.type === 'TELEGRAM') {
                          placeholder = 'e.g. -1001234567890, 987654321';
                          helperText = 'Telegram Chat IDs or Channel IDs (numeric).';
                        } else if (method.type === 'EMAIL') {
                          placeholder = 'e.g. dba@company.com, oncall@company.com';
                          helperText = 'Email recipients (comma-separated).';
                        } else if (method.type === 'WEBHOOK') {
                          placeholder = 'e.g. https://api.company.com/alerts or token';
                          helperText = 'Webhook URL or routing key.';
                        }

                        return (
                          <div
                            key={mapItem.notificationMethodId}
                            className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-1 shadow-2xs transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {icon}
                                <span className="font-bold text-slate-900 text-xs truncate max-w-[120px]">{method.name}</span>
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
                                className="text-slate-400 hover:text-rose-600 text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                ×
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
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 font-mono text-[11px] text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                            />
                            <div className="text-[9px] text-slate-500">{helperText}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* FORM FOOTER ACTIONS (Fixed height) */}
        {/* ============================================================== */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
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
