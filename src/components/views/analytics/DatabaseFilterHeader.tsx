import React, { useRef, useState, useEffect } from 'react';
import {
  Database,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { DatabaseEntity, DatabaseEngineEntity } from '../../../types';
import { getDbEngineBadgeClass } from '../../../config/dbEngines';
import { useLanguage } from '../../../i18n/LanguageContext';

interface DatabaseFilterHeaderProps {
  databases: DatabaseEntity[];
  databaseEngines: DatabaseEngineEntity[];
  selectedDbId: string;
  onSelectDbId: (id: string) => void;
  selectedEngineType: string;
  onSelectEngineType: (engine: string) => void;
  dbSearchQuery: string;
  onSearchQueryChange: (q: string) => void;
  timePreset: string;
  onSelectTimePreset: (preset: string) => void;
  fromDateTime: string;
  onFromDateTimeChange: (val: string) => void;
  toDateTime: string;
  onToDateTimeChange: (val: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const DatabaseFilterHeader: React.FC<DatabaseFilterHeaderProps> = ({
  databases,
  databaseEngines,
  selectedDbId,
  onSelectDbId,
  selectedEngineType,
  onSelectEngineType,
  dbSearchQuery,
  onSearchQueryChange,
  timePreset,
  onSelectTimePreset,
  fromDateTime,
  onFromDateTimeChange,
  toDateTime,
  onToDateTimeChange,
  onRefresh,
  isLoading = false,
}) => {
  const { t } = useLanguage();
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedDb = databases.find((d) => d.id === selectedDbId) || databases[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(event.target as Node)) {
        setIsDbDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDbDropdownOpen(false);
      }
    };
    if (isDbDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDbDropdownOpen]);

  const filteredDatabasesForDropdown = databases.filter((db) => {
    const matchEngine =
      selectedEngineType === 'ALL' || db.dbType.toUpperCase() === selectedEngineType.toUpperCase();
    const matchQuery =
      !dbSearchQuery.trim() ||
      db.name.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
      db.host.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
      db.dbType.toLowerCase().includes(dbSearchQuery.toLowerCase());
    return matchEngine && matchQuery;
  });

  const availableEngineCodes = Array.from(
    new Set([
      ...databaseEngines.map((e) => e.dbCode.toUpperCase()),
      ...databases.map((d) => d.dbType.toUpperCase()),
    ])
  );

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Engine Filter & Target Database Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Engine Filter */}
          <div className="relative shrink-0 sm:w-44">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedEngineType}
              onChange={(e) => onSelectEngineType(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl pl-8 pr-7 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="ALL">{t('analytics.allEngineTypes')}</option>
              {availableEngineCodes.map((code) => (
                <option key={code} value={code}>
                  {t('analytics.engineDatabases', { code })}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Database Selector Dropdown */}
          <div className="relative flex-1 min-w-0" ref={dbDropdownRef}>
            <button
              type="button"
              onClick={() => setIsDbDropdownOpen(!isDbDropdownOpen)}
              className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl px-3.5 py-2 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2.5 truncate min-w-0">
                <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">{selectedDb ? selectedDb.name : t('analytics.selectDatabase')}</span>
                {selectedDb && (
                  <span
                    className={`px-2 py-0.5 border rounded text-[10px] font-bold tracking-wider shrink-0 ${getDbEngineBadgeClass(
                      selectedDb.dbType
                    )}`}
                  >
                    {selectedDb.dbType}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                  isDbDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDbDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={dbSearchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    placeholder={t('analytics.searchPlaceholder')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs pl-8 pr-3 py-1.5 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredDatabasesForDropdown.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">{t('analytics.noDatabasesMatch')}</div>
                  ) : (
                    filteredDatabasesForDropdown.map((db) => (
                      <button
                        key={db.id}
                        type="button"
                        onClick={() => {
                          onSelectDbId(db.id);
                          setIsDbDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                          db.id === selectedDbId ? 'bg-indigo-50/80 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              db.isEnabled === false
                                ? 'bg-slate-400'
                                : db.status === 'DOWN'
                                ? 'bg-rose-500'
                                : db.status === 'WARNING'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span className="truncate">{db.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({db.host}:{db.port})</span>
                        </div>
                        <span
                          className={`px-1.5 py-0.2 border rounded text-[9px] font-bold ${getDbEngineBadgeClass(
                            db.dbType
                          )}`}
                        >
                          {db.dbType}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Time Range Filter & Refresh Button */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* Time Presets */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            {['1h', '6h', '24h', '7d', 'custom'].map((preset) => {
              const labelKey = preset === 'custom' ? 'analytics.presetCustom' : `analytics.preset${preset}`;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSelectTimePreset(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timePreset === preset
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
            <span>{isRefreshing || isLoading ? t('analytics.refreshing') : t('analytics.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Custom Time Range Selector Inputs */}
      {timePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>{t('analytics.from')}</span>
            <input
              type="datetime-local"
              value={fromDateTime}
              onChange={(e) => onFromDateTimeChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <span>{t('analytics.to')}</span>
            <input
              type="datetime-local"
              value={toDateTime}
              onChange={(e) => onToDateTimeChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
