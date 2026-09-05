import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Server, Database, Search, ChevronDown, Check } from 'lucide-react';
import { DatabaseEntity } from '../../types';
import { getDbEngineBadgeClass } from '../../config/dbEngines';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface TargetDatabaseFilterProps {
  /** Currently selected database ID or 'ALL' */
  value: string;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** List of available databases */
  databases: DatabaseEntity[];
  /** Optional active engine code filter (e.g. 'POSTGRES', 'ORACLE', 'ALL') */
  selectedEngineType?: string;
  /** Optional callback if engine filter should be reset/cleared when selecting a DB */
  onEngineChange?: (engine: string) => void;
  /** Label for top header bar (defaults to 'Target Database') */
  label?: string;
  /** Custom label for 'ALL' option (defaults to 'All Databases') */
  allLabel?: string;
  /** Whether to render top label header row above trigger (defaults to false) */
  showHeader?: boolean;
  /** Button height/variant styling: 'default' (h-10) | 'compact' (h-8) */
  variant?: 'default' | 'compact';
  /** Optional container element ID */
  id?: string;
  /** Custom container CSS classes */
  className?: string;
}

export const TargetDatabaseFilter: React.FC<TargetDatabaseFilterProps> = ({
  value,
  onChange,
  databases = [],
  selectedEngineType = 'ALL',
  onEngineChange,
  label = 'Target Database',
  allLabel = 'All Databases',
  showHeader = false,
  variant = 'default',
  id,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Click outside listener to close dropdown popover
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Selected database object
  const selectedDb = useMemo(() => {
    if (value === 'ALL') return null;
    return databases.find((d) => d.id === value) || null;
  }, [databases, value]);

  // Filtered databases list
  const searchableDatabases = useMemo(() => {
    let list = databases;

    // Filter by engine type if active
    if (selectedEngineType && selectedEngineType !== 'ALL') {
      list = list.filter((db) => (db.dbType || '').toUpperCase() === selectedEngineType.toUpperCase());
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((db) => {
        return (
          db.name.toLowerCase().includes(q) ||
          (db.host && db.host.toLowerCase().includes(q)) ||
          (db.dbType && db.dbType.toLowerCase().includes(q)) ||
          (db.databaseName && db.databaseName.toLowerCase().includes(q)) ||
          (db.environment && db.environment.toLowerCase().includes(q)) ||
          String(db.port).includes(q)
        );
      });
    }

    return list;
  }, [databases, selectedEngineType, searchQuery]);

  return (
    <div className={cn('relative', className)} ref={dropdownRef} id={id}>
      {showHeader && (
        <div className="h-5 flex items-center justify-between mb-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <Server className="w-3.5 h-3.5 text-indigo-500" />
            <span>{label}</span>
          </label>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
            {value === 'ALL' ? allLabel : '1 Selected'}
          </span>
        </div>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs group',
          variant === 'compact' ? 'h-8 py-1 px-2.5 rounded-lg' : 'h-10 py-2',
          isOpen && 'ring-2 ring-indigo-500/20 border-indigo-500'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedDb ? (
            <>
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  (selectedDb.status || 'UP').toUpperCase() === 'UP' || (selectedDb.status || 'UP').toUpperCase() === 'NORMAL'
                    ? 'bg-emerald-500'
                    : (selectedDb.status || '').toUpperCase() === 'DOWN' || (selectedDb.status || '').toUpperCase() === 'CRITICAL'
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                )}
              />
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <span className="font-bold text-slate-900 truncate">{selectedDb.name}</span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline truncate">
                  ({selectedDb.host}:{selectedDb.port})
                </span>
              </div>
              <span
                className={cn(
                  'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0',
                  getDbEngineBadgeClass(selectedDb.dbType)
                )}
              >
                {selectedDb.dbType}
              </span>
            </>
          ) : (
            <>
              <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="font-medium text-slate-700 truncate">
                {allLabel} ({searchableDatabases.length})
              </span>
            </>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 group-hover:text-slate-600',
            isOpen && 'rotate-180 text-indigo-600'
          )}
        />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80 w-full min-w-[260px] sm:min-w-[280px]">
          {/* Search input header */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search database, host, IP, engine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-lg pl-8 pr-7 py-1.5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-0.5 rounded cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Database List */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-60">
            {/* "All Databases" option */}
            <button
              type="button"
              onClick={() => {
                onChange('ALL');
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/50 transition-colors cursor-pointer',
                value === 'ALL' && 'bg-indigo-50/80 font-bold'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-indigo-600" />
                <div>
                  <div className="text-xs font-bold text-slate-900">{allLabel}</div>
                  <div className="text-[10px] text-slate-400">Do not filter by target database instance</div>
                </div>
              </div>
              {value === 'ALL' && (
                <Check className="w-4 h-4 text-indigo-600 shrink-0 font-bold" />
              )}
            </button>

            {searchableDatabases.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                <Database className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-semibold text-slate-600">No matching databases</p>
              </div>
            ) : (
              searchableDatabases.map((db) => {
                const isSelected = db.id === value;
                const isUp = (db.status || 'UP').toUpperCase() === 'UP' || (db.status || 'UP').toUpperCase() === 'NORMAL';
                const isDown = (db.status || '').toUpperCase() === 'DOWN' || (db.status || '').toUpperCase() === 'CRITICAL';

                return (
                  <button
                    key={db.id}
                    type="button"
                    onClick={() => {
                      onChange(db.id);
                      setIsOpen(false);
                      if (
                        onEngineChange &&
                        selectedEngineType !== 'ALL' &&
                        selectedEngineType.toUpperCase() !== db.dbType.toUpperCase()
                      ) {
                        onEngineChange('ALL');
                      }
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/50 transition-colors cursor-pointer group',
                      isSelected && 'bg-indigo-50/80'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : 'bg-amber-500'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-xs font-bold text-slate-900', isSelected && 'text-indigo-900')}>
                            {db.name}
                          </span>
                          <span
                            className={cn(
                              'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                              getDbEngineBadgeClass(db.dbType)
                            )}
                          >
                            {db.dbType}
                          </span>
                          {db.environment && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                              {db.environment}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2 truncate">
                          <span>{db.host}:{db.port}</span>
                          {db.databaseName && <span>• {db.databaseName}</span>}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 font-bold" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
            <span>{searchableDatabases.length} databases</span>
            {selectedEngineType !== 'ALL' && onEngineChange && (
              <button
                type="button"
                onClick={() => onEngineChange('ALL')}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                Clear Engine Filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
