import React, { useState, useMemo, useCallback } from 'react';
import {
  Tag,
  Search,
  Filter,
  CheckSquare,
  Square,
  Plus,
  Minus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  Layers,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Hash
} from 'lucide-react';
import { DatabaseEntity, DatabaseEngineEntity } from '../../types';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n/LanguageContext';
import { getDbEngineBadgeClass, getDbEngineHexColor } from '../../config/dbEngines';

interface BatchEditTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  databases: DatabaseEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  onSaveDatabase: (database: Partial<DatabaseEntity>) => void;
  onRefresh?: () => void;
}

const PAGE_SIZE = 20;

const DEFAULT_RECOMMENDED_TAGS = [
  'PRODUCTION',
  'PRIMARY',
  'STANDBY',
  'STAGING',
  'LAB',
  'DEV',
  'CRITICAL',
  'ANALYTICS',
  'REPLICA',
  'FINANCE',
  'RAC',
  'DATAGUARD',
  'OS',
  'SERVER',
  'WINDOWS',
  'UBUNTU',
  'CENTOS',
  'ORACLELINUX',
  'REDHAT',
  'OPENSUSE',
];

export const BatchEditTagsModal: React.FC<BatchEditTagsModalProps> = ({
  isOpen,
  onClose,
  databases,
  databaseEngines = [],
  onSaveDatabase,
  onRefresh,
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Mode: ADD or REMOVE tag
  const [actionType, setActionType] = useState<'ADD' | 'REMOVE'>('ADD');

  // Tag selection / input
  const [targetTag, setTargetTag] = useState<string>('PRODUCTION');
  const [customTagInput, setCustomTagInput] = useState<string>('');

  // Selected Database IDs Set
  const [selectedDbIds, setSelectedDbIds] = useState<Set<string>>(new Set());

  // Filter and Search States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [engineFilter, setEngineFilter] = useState<string>('ALL');
  const [systemFilter, setSystemFilter] = useState<string>('ALL');
  const [tagStatusFilter, setTagStatusFilter] = useState<'ALL' | 'HAS_TAG' | 'NO_TAG'>('ALL');

  // Pagination (Strict 20 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Collect all unique existing tags across workspace
  const workspaceTags = useMemo(() => {
    const set = new Set<string>();
    databases.forEach((db) => {
      (db.tags || []).forEach((t) => {
        if (t && t.trim()) set.add(t.trim().toUpperCase());
      });
    });
    DEFAULT_RECOMMENDED_TAGS.forEach((t) => set.add(t.toUpperCase()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [databases]);

  // Unique systems for dropdown
  const uniqueSystems = useMemo(() => {
    const systems = new Set<string>();
    databases.forEach((db) => {
      if (db.databaseSystem && db.databaseSystem.trim()) {
        systems.add(db.databaseSystem.trim());
      }
    });
    return Array.from(systems).sort((a, b) => a.localeCompare(b));
  }, [databases]);

  // Active target tag normalized
  const activeTargetTag = useMemo(() => {
    const raw = customTagInput.trim() || targetTag.trim();
    return raw.toUpperCase();
  }, [customTagInput, targetTag]);

  // Filtered databases based on search, engine, system, tag status
  const filteredDatabases = useMemo(() => {
    return databases.filter((db) => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = (db.name || '').toLowerCase().includes(query);
        const matchesHost = (db.host || '').toLowerCase().includes(query);
        const matchesSystem = (db.databaseSystem || '').toLowerCase().includes(query);
        const matchesEngine = (db.dbType || '').toLowerCase().includes(query);
        const matchesId = (db.id || '').toLowerCase().includes(query);
        const matchesTags = (db.tags || []).some((t) => t.toLowerCase().includes(query));
        if (!matchesName && !matchesHost && !matchesSystem && !matchesEngine && !matchesId && !matchesTags) {
          return false;
        }
      }

      // 2. Engine filter
      if (engineFilter !== 'ALL' && db.dbType !== engineFilter) {
        return false;
      }

      // 3. System filter
      if (systemFilter !== 'ALL' && db.databaseSystem !== systemFilter) {
        return false;
      }

      // 4. Tag status filter relative to activeTargetTag
      if (tagStatusFilter !== 'ALL' && activeTargetTag) {
        const hasActiveTag = (db.tags || []).some((t) => t.toUpperCase() === activeTargetTag);
        if (tagStatusFilter === 'HAS_TAG' && !hasActiveTag) return false;
        if (tagStatusFilter === 'NO_TAG' && hasActiveTag) return false;
      }

      return true;
    });
  }, [databases, searchTerm, engineFilter, systemFilter, tagStatusFilter, activeTargetTag]);

  // Total pages calculation (20 items per page)
  const totalPages = Math.max(1, Math.ceil(filteredDatabases.length / PAGE_SIZE));

  // Paginated databases slice
  const paginatedDatabases = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * PAGE_SIZE;
    return filteredDatabases.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredDatabases, currentPage, totalPages]);

  // Toggle selection for a single DB
  const handleToggleDb = useCallback((id: string) => {
    setSelectedDbIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle select all on current page (20 items)
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedDatabases.length === 0) return false;
    return paginatedDatabases.every((db) => selectedDbIds.has(db.id));
  }, [paginatedDatabases, selectedDbIds]);

  const handleToggleSelectPage = useCallback(() => {
    if (isAllCurrentPageSelected) {
      setSelectedDbIds((prev) => {
        const next = new Set(prev);
        paginatedDatabases.forEach((db) => next.delete(db.id));
        return next;
      });
    } else {
      setSelectedDbIds((prev) => {
        const next = new Set(prev);
        paginatedDatabases.forEach((db) => next.add(db.id));
        return next;
      });
    }
  }, [isAllCurrentPageSelected, paginatedDatabases]);

  // Select all matching filtered databases across all pages
  const handleSelectAllFiltered = useCallback(() => {
    setSelectedDbIds((prev) => {
      const next = new Set(prev);
      filteredDatabases.forEach((db) => next.add(db.id));
      return next;
    });
  }, [filteredDatabases]);

  // Clear all selections
  const handleClearSelection = useCallback(() => {
    setSelectedDbIds(new Set());
  }, []);

  // Compute impact stats
  const impactStats = useMemo(() => {
    let willChangeCount = 0;
    let unchangedCount = 0;
    const selectedDbs = databases.filter((db) => selectedDbIds.has(db.id));

    selectedDbs.forEach((db) => {
      const hasTag = (db.tags || []).some((t) => t.toUpperCase() === activeTargetTag);
      if (actionType === 'ADD') {
        if (!hasTag) {
          willChangeCount++;
        } else {
          unchangedCount++;
        }
      } else {
        if (hasTag) {
          willChangeCount++;
        } else {
          unchangedCount++;
        }
      }
    });

    return {
      selectedTotal: selectedDbs.length,
      willChangeCount,
      unchangedCount,
    };
  }, [databases, selectedDbIds, activeTargetTag, actionType]);

  // Apply batch tag modifications
  const handleApplyBatchTags = async () => {
    if (!activeTargetTag) {
      toast({
        title: t('databases.validationError') || 'Validation Error',
        description: t('databases.noTagSpecified') || 'Please select or enter a tag name to apply.',
        type: 'warning',
      });
      return;
    }

    if (selectedDbIds.size === 0) {
      toast({
        title: t('databases.validationError') || 'Validation Error',
        description: t('databases.noDatabasesSelected') || 'Please select at least one database.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    let updatedCount = 0;

    try {
      const selectedDbs = databases.filter((db) => selectedDbIds.has(db.id));

      for (const db of selectedDbs) {
        const currentTags = db.tags || [];
        const hasTag = currentTags.some((t) => t.toUpperCase() === activeTargetTag);

        let newTags: string[] = [];
        if (actionType === 'ADD') {
          if (!hasTag) {
            newTags = Array.from(new Set([...currentTags, activeTargetTag]));
          } else {
            newTags = currentTags;
          }
        } else {
          // REMOVE
          if (hasTag) {
            newTags = currentTags.filter((t) => t.toUpperCase() !== activeTargetTag);
          } else {
            newTags = currentTags;
          }
        }

        // Only save if tags actually changed
        if (JSON.stringify(newTags) !== JSON.stringify(currentTags)) {
          onSaveDatabase({
            ...db,
            tags: newTags,
            passwordEncrypted: db.passwordEncrypted,
          });
          updatedCount++;
        }
      }

      toast({
        title: t('databases.tagsUpdatedSuccess') || 'Tags Updated Successfully',
        description: t('databases.tagsUpdatedDesc', { count: updatedCount }) || `Successfully updated tags for ${updatedCount} database(s).`,
        type: 'success',
      });

      if (onRefresh) {
        onRefresh();
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to batch update tags:', err);
      toast({
        title: t('databases.importError') || 'Error Updating Tags',
        description: err.message || 'An error occurred while saving tag updates.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('databases.editTagsTitle') || 'Batch Manage Database Tags'}
      description={t('databases.editTagsDesc') || 'Add or remove a specific tag across multiple databases in bulk.'}
      maxWidth="5xl"
    >
      <div className="space-y-4 max-h-[80vh] flex flex-col text-xs text-slate-700">
        {/* Top Control Block: Action Type & Target Tag Selection */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Action Mode Toggle */}
            <div className="md:col-span-4 space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('databases.tagActionLabel') || 'Action Mode'}</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-200/80 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActionType('ADD')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
                    actionType === 'ADD'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/50'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('databases.addTagAction') || 'Add Tag'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('REMOVE')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
                    actionType === 'REMOVE'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/50'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>{t('databases.removeTagAction') || 'Remove Tag'}</span>
                </button>
              </div>
            </div>

            {/* Target Tag Selector & Custom Input */}
            <div className="md:col-span-8 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t('databases.targetTagLabel') || 'Target Tag'}</span>
                </label>
                {activeTargetTag && (
                  <span className="font-mono text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Active: {activeTargetTag}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => {
                      setCustomTagInput(e.target.value.toUpperCase());
                      if (e.target.value) setTargetTag(e.target.value.toUpperCase());
                    }}
                    placeholder={t('databases.targetTagPlaceholder') || 'Type custom tag or pick below...'}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  {customTagInput && (
                    <button
                      type="button"
                      onClick={() => setCustomTagInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={targetTag}
                  onChange={(e) => {
                    setTargetTag(e.target.value);
                    setCustomTagInput('');
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 max-w-[180px]"
                >
                  <option value="" disabled>-- Select Existing Tag --</option>
                  {workspaceTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Tag Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">Quick Select:</span>
            {workspaceTags.slice(0, 12).map((tag) => {
              const isSelected = activeTargetTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setTargetTag(tag);
                    setCustomTagInput('');
                  }}
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle Filter Toolbar & Fast Selection Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-2xs shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t('databases.searchPlaceholder') || 'Search by name, host, system, engine, tags...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Engine Filter */}
              <select
                value={engineFilter}
                onChange={(e) => {
                  setEngineFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Engines</option>
                {databaseEngines.length > 0 ? (
                  databaseEngines.map((eng) => (
                    <option key={eng.dbCode} value={eng.dbCode}>
                      {eng.dbName} ({eng.dbCode})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="ORACLE">Oracle</option>
                    <option value="POSTGRESQL">PostgreSQL</option>
                    <option value="MYSQL">MySQL</option>
                    <option value="MSSQL">SQL Server</option>
                  </>
                )}
              </select>

              {/* System Filter */}
              <select
                value={systemFilter}
                onChange={(e) => {
                  setSystemFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Systems</option>
                {uniqueSystems.map((sys) => (
                  <option key={sys} value={sys}>
                    {sys}
                  </option>
                ))}
              </select>

              {/* Tag Status Filter */}
              <select
                value={tagStatusFilter}
                onChange={(e) => {
                  setTagStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Tag Status</option>
                <option value="HAS_TAG">Has '{activeTargetTag || 'Tag'}'</option>
                <option value="NO_TAG">Does not have '{activeTargetTag || 'Tag'}'</option>
              </select>
            </div>
          </div>

          {/* Quick Selection & Counters Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectPage}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition-colors cursor-pointer"
              >
                {isAllCurrentPageSelected ? (
                  <>
                    <Square className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('databases.deselectAllPage') || 'Deselect Page (20)'}</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('databases.selectAllPage') || 'Select Page (20)'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-semibold transition-colors cursor-pointer"
              >
                {t('databases.selectAllAll', { count: filteredDatabases.length }) || `Select All Matching (${filteredDatabases.length})`}
              </button>

              {selectedDbIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-md font-semibold transition-colors cursor-pointer"
                >
                  {t('databases.clearAllSelection') || 'Clear Selection'}
                </button>
              )}
            </div>

            {/* Selected Count Indicator */}
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-slate-500">
                {t('databases.selectedDatabasesCount', { selected: selectedDbIds.size, total: databases.length }) ||
                  `${selectedDbIds.size} of ${databases.length} databases selected`}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600 font-mono text-[11px]">
                Showing {filteredDatabases.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-
                {Math.min(currentPage * PAGE_SIZE, filteredDatabases.length)} of {filteredDatabases.length}
              </span>
            </div>
          </div>
        </div>

        {/* Database List Table (Optimized, 20 items per page) */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white min-h-[260px] max-h-[380px] shadow-2xs">
          {paginatedDatabases.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400 space-y-2">
              <Database className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">No databases match current filter criteria.</p>
              <p className="text-[11px] text-slate-400">Try adjusting search term, engine, or system filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-2 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllCurrentPageSelected}
                      onChange={handleToggleSelectPage}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3">Database Instance</th>
                  <th className="py-2 px-3">System / Endpoint</th>
                  <th className="py-2 px-3">Current Tags</th>
                  <th className="py-2 px-3 text-right">Action Effect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {paginatedDatabases.map((db) => {
                  const isSelected = selectedDbIds.has(db.id);
                  const hasTag = (db.tags || []).some((t) => t.toUpperCase() === activeTargetTag);
                  const dbTags = db.tags || [];

                  return (
                    <tr
                      key={db.id}
                      onClick={() => handleToggleDb(db.id)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer select-none ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleDb(db.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Database Name & Engine */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border shrink-0 ${getDbEngineBadgeClass(
                              db.dbType
                            )}`}
                          >
                            {db.dbType}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{db.name}</span>
                              {db.isEnabled === false && (
                                <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1 py-0.2 rounded font-mono font-medium">
                                  PAUSED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{db.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* System & Endpoint */}
                      <td className="py-2.5 px-3">
                        <div className="text-slate-700 font-medium">
                          {db.databaseSystem || <span className="text-slate-400 italic">No System</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {db.host}:{db.port}
                        </div>
                      </td>

                      {/* Current Tags */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {dbTags.length > 0 ? (
                            dbTags.map((t, idx) => {
                              const isTarget = t.toUpperCase() === activeTargetTag;
                              return (
                                <span
                                  key={idx}
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                                    isTarget
                                      ? actionType === 'REMOVE' && isSelected
                                        ? 'bg-rose-100 text-rose-800 border-rose-300 line-through'
                                        : 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {t}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No tags</span>
                          )}
                        </div>
                      </td>

                      {/* Action Status / Preview */}
                      <td className="py-2.5 px-3 text-right">
                        {actionType === 'ADD' ? (
                          hasTag ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                              <Check className="w-3 h-3 text-slate-400" />
                              <span>{t('databases.tagAlreadyPresent') || 'Already has tag'}</span>
                            </span>
                          ) : isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                              <Plus className="w-3 h-3 text-emerald-600" />
                              <span>{t('databases.tagWillBeAdded') || 'Will add tag'}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              {t('databases.tagNotPresent') || 'No tag'}
                            </span>
                          )
                        ) : (
                          // REMOVE
                          hasTag ? (
                            isSelected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                <Minus className="w-3 h-3 text-rose-600" />
                                <span>{t('databases.tagWillBeRemoved') || 'Will remove tag'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                <span>Has tag</span>
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              {t('databases.tagNotPresent') || 'Doesn\'t have tag'}
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar (20 per page) */}
        <div className="flex items-center justify-between pt-1 text-xs shrink-0">
          <div className="text-slate-500">
            {t('databases.pageIndicator', { current: currentPage, total: totalPages }) ||
              `Page ${currentPage} of ${totalPages} (20 items/page)`}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{t('databases.previous') || 'Previous'}</span>
            </button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  p = currentPage - 2 + i;
                  if (p > totalPages) p = totalPages - 4 + i;
                }
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded text-xs font-bold transition-all cursor-pointer ${
                      currentPage === p
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{t('databases.next') || 'Next'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Summary Banner */}
        {selectedDbIds.size > 0 && activeTargetTag && (
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs shrink-0 ${
              actionType === 'ADD'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/80 border-rose-200 text-rose-900'
            }`}
          >
            <AlertCircle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                actionType === 'ADD' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            />
            <div className="space-y-0.5">
              <div className="font-bold">
                {actionType === 'ADD' ? 'Add Tag Summary:' : 'Remove Tag Summary:'}
              </div>
              <div className="text-[11px] leading-relaxed">
                Applying action <strong className="font-mono">{actionType}</strong> tag{' '}
                <strong className="font-mono bg-white/80 px-1.5 py-0.2 rounded border border-current">
                  {activeTargetTag}
                </strong>{' '}
                across <strong>{impactStats.selectedTotal}</strong> selected database(s):{' '}
                <strong>{impactStats.willChangeCount}</strong> will be updated,{' '}
                <strong>{impactStats.unchangedCount}</strong> already in target state.
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>

          <button
            type="button"
            disabled={isSubmitting || selectedDbIds.size === 0 || !activeTargetTag}
            onClick={handleApplyBatchTags}
            className={`px-4 py-2 rounded-lg text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${
              actionType === 'ADD'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t('databases.applyingTags') || 'Updating Tags...'}</span>
              </>
            ) : (
              <>
                {actionType === 'ADD' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                <span>
                  {actionType === 'ADD' ? 'Add Tag to' : 'Remove Tag from'}{' '}
                  {selectedDbIds.size} Database{selectedDbIds.size === 1 ? '' : 's'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
