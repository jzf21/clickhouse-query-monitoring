'use client';

import { useState, useRef, useEffect } from 'react';
import { QUERY_LOG_COLUMNS, QueryLogColumnKey, getDefaultColumns } from '@/app/lib/api';

interface ColumnPickerProps {
  selectedColumns: QueryLogColumnKey[];
  onColumnsChange: (columns: QueryLogColumnKey[]) => void;
}

export default function ColumnPicker({ selectedColumns, onColumnsChange }: ColumnPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleColumn = (columnKey: QueryLogColumnKey) => {
    if (selectedColumns.includes(columnKey)) {
      onColumnsChange(selectedColumns.filter((c) => c !== columnKey));
    } else {
      onColumnsChange([...selectedColumns, columnKey]);
    }
  };

  const handleSelectAll = () => {
    onColumnsChange(QUERY_LOG_COLUMNS.map((col) => col.key));
  };

  const handleClearAll = () => {
    onColumnsChange([]);
  };

  const handleResetToDefault = () => {
    onColumnsChange(getDefaultColumns());
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        Columns ({selectedColumns.length})
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 p-2 dark:border-zinc-700">
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              Select All
            </button>
            <button
              onClick={handleResetToDefault}
              className="text-xs text-zinc-500 hover:text-zinc-600"
            >
              Reset
            </button>
            <button
              onClick={handleClearAll}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Clear
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {QUERY_LOG_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(col.key)}
                  onChange={() => handleToggleColumn(col.key)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500 dark:border-zinc-600"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
