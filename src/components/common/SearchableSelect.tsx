import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface SearchableSelectProps {
  /** Currently selected value or 'ALL' */
  value: string;
  /** Change callback */
  onChange: (value: string) => void;
  /** List of selectable options */
  options: SearchableOption[];
  /** Custom label for 'ALL' option (defaults to 'All') */
  allLabel?: string;
  /** Subtitle description for 'ALL' option */
  allSubLabel?: string;
  /** Search input placeholder */
  placeholder?: string;
  /** Tooltip or accessible label */
  title?: string;
  /** Leading icon for the button */
  icon?: React.ReactNode;
  /** Compact vs Default button height */
  variant?: 'default' | 'compact';
  /** Custom wrapper classes */
  className?: string;
  /** Custom popover dropdown minimum width */
  popoverMinWidth?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Empty results fallback text */
  emptyText?: string;
  /** Custom container ID */
  id?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options = [],
  allLabel = 'All',
  allSubLabel,
  placeholder = 'Search...',
  title,
  icon,
  variant = 'compact',
  className,
  popoverMinWidth = 'min-w-[220px]',
  disabled = false,
  emptyText = 'No matching items',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Selected Option
  const selectedOption = useMemo(() => {
    if (value === 'ALL') return null;
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, searchQuery]);

  return (
    <div className={cn('relative inline-block', className)} ref={dropdownRef} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs group disabled:opacity-50 disabled:cursor-not-allowed',
          variant === 'compact' ? 'h-8 py-1' : 'h-10 py-2',
          isOpen && 'ring-2 ring-indigo-500/20 border-indigo-500',
          value !== 'ALL' && 'border-indigo-300 bg-indigo-50/20'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {icon && <span className="text-slate-400 shrink-0 group-hover:text-slate-600 transition-colors">{icon}</span>}
          {selectedOption ? (
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <span className="font-bold text-slate-900 truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span
                  className={cn(
                    'text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0',
                    selectedOption.badgeColor || 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  )}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="font-semibold text-slate-700 truncate">
              {allLabel}
              {options.length > 0 && <span className="text-slate-400 font-normal ml-1">({options.length})</span>}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value !== 'ALL' && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('ALL');
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition-colors"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 group-hover:text-slate-600',
              isOpen && 'rotate-180 text-indigo-600'
            )}
          />
        </div>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80 w-auto',
            popoverMinWidth
          )}
        >
          {/* Search Header */}
          <div className="p-2 bg-slate-50 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={placeholder}
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

          {/* Options List */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-60">
            {/* 'ALL' option */}
            <button
              type="button"
              onClick={() => {
                onChange('ALL');
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-indigo-50/50 transition-colors cursor-pointer',
                value === 'ALL' && 'bg-indigo-50/80 font-bold'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{allLabel}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({options.length})</span>
                </div>
                {allSubLabel && <div className="text-[10px] text-slate-400 truncate">{allSubLabel}</div>}
              </div>
              {value === 'ALL' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
            </button>

            {/* Filtered list */}
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">{emptyText}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-indigo-50/50 transition-colors cursor-pointer',
                      isSelected && 'bg-indigo-50/80 font-bold'
                    )}
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <span className={cn('text-xs text-slate-900 truncate', isSelected ? 'font-bold' : 'font-medium')}>
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span
                            className={cn(
                              'text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0',
                              opt.badgeColor || 'bg-slate-100 text-slate-700 border border-slate-200'
                            )}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {opt.count !== undefined && (
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">({opt.count})</span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <div className="text-[10px] text-slate-400 truncate font-mono">{opt.subLabel}</div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
