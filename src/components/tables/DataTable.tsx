import React from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';

export interface Column<T> {
  header: string | React.ReactNode;
  accessorKey?: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (field: string) => void;
  rowClassName?: (row: T, index: number) => string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found',
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  sortField,
  sortOrder,
  onSortChange,
  rowClassName,
}: DataTableProps<T>) {
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{ width: col.width }}
                  className={cn(
                    'px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.sortable && 'cursor-pointer hover:text-slate-800 transition-colors'
                  )}
                  onClick={() => {
                    if (col.sortable && col.accessorKey && onSortChange) {
                      onSortChange(String(col.accessorKey));
                    }
                  }}
                >
                  <div className={cn('flex items-center gap-1.5', col.align === 'right' && 'justify-end', col.align === 'center' && 'justify-center')}>
                    <span>{col.header}</span>
                    {col.sortable && col.accessorKey && sortField === col.accessorKey && (
                      <span className="text-indigo-600">
                        {sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {columns.map((_, colIdx) => (
                    <td key={colIdx} className="px-6 py-4">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  className={cn(
                    'transition-colors',
                    rowClassName ? rowClassName(row, rowIdx) : 'hover:bg-slate-50/80'
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={cn(
                        'px-6 py-3.5 text-sm text-slate-700',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center'
                      )}
                    >
                      {col.cell ? col.cell(row) : col.accessorKey ? String(row[col.accessorKey] ?? '—') : '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            Showing <span className="font-semibold text-slate-800">{startItem}</span> - <span className="font-semibold text-slate-800">{endItem}</span> of <span className="font-semibold text-slate-800">{totalCount}</span> records
          </div>
          {onPageSizeChange && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="text-[11px] font-medium text-slate-500">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} / page
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>

          <div className="flex items-center gap-1 px-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 2 + i;
                if (pageNum > totalPages) pageNum = totalPages - (4 - i);
              }
              if (pageNum <= 0) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  disabled={isLoading}
                  className={cn(
                    'w-7 h-7 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                    currentPage === pageNum
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-2xs'
                      : 'border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || totalPages === 0 || isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
