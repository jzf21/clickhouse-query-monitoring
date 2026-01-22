'use client';

import { useState } from 'react';
import {
  getExportUrl,
  QUERY_LOG_COLUMNS,
  QueryLogColumnKey,
} from '@/app/lib/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColumns: QueryLogColumnKey[];
  currentFilters: {
    user?: string;
    db_name?: string;
    only_failed?: boolean;
    only_success?: boolean;
    start_time?: string;
    end_time?: string;
  };
}

export default function ExportModal({
  isOpen,
  onClose,
  selectedColumns,
  currentFilters,
}: ExportModalProps) {
  const [exportColumns, setExportColumns] = useState<QueryLogColumnKey[]>(selectedColumns);
  const [exportLimit, setExportLimit] = useState<string>('1000');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');

  if (!isOpen) return null;

  const handleColumnToggle = (columnKey: QueryLogColumnKey) => {
    setExportColumns((prev) =>
      prev.includes(columnKey)
        ? prev.filter((c) => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSelectAll = () => {
    setExportColumns(QUERY_LOG_COLUMNS.map((c) => c.key));
  };

  const handleSelectNone = () => {
    setExportColumns([]);
  };

  const handleExport = () => {
    if (exportColumns.length === 0) {
      alert('Please select at least one column to export');
      return;
    }

    const limit = parseInt(exportLimit, 10);
    if (isNaN(limit) || limit <= 0) {
      alert('Please enter a valid limit');
      return;
    }

    const filters = {
      columns: exportColumns.join(','),
      limit: Math.min(limit, 100000),
      ...currentFilters,
      ...(useCustomTime && customStartTime ? { start_time: new Date(customStartTime).toISOString() } : {}),
      ...(useCustomTime && customEndTime ? { end_time: new Date(customEndTime).toISOString() } : {}),
    };

    // Remove time filters if using custom time and they're not set
    if (useCustomTime) {
      if (!customStartTime) delete filters.start_time;
      if (!customEndTime) delete filters.end_time;
    }

    const url = getExportUrl(filters);
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Export Query Logs
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Limit */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Row Limit (max 100,000)
          </label>
          <input
            type="number"
            min="1"
            max="100000"
            value={exportLimit}
            onChange={(e) => setExportLimit(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* Time Range Override */}
        <div className="mb-4">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={useCustomTime}
              onChange={(e) => setUseCustomTime(e.target.checked)}
              className="rounded"
            />
            Override time range for export
          </label>
          {useCustomTime && (
            <div className="mt-2 flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-zinc-500">Start Time</label>
                <input
                  type="datetime-local"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-zinc-500">End Time</label>
                <input
                  type="datetime-local"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Columns Selection */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Columns to Export ({exportColumns.length} selected)
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                Select All
              </button>
              <button
                onClick={handleSelectNone}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                Select None
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-300 p-2 dark:border-zinc-700">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {QUERY_LOG_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={exportColumns.includes(col.key)}
                    onChange={() => handleColumnToggle(col.key)}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Current Filters Info */}
        <div className="mb-4 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">Active Filters:</p>
          <ul className="mt-1 text-zinc-600 dark:text-zinc-400">
            {currentFilters.user && <li>User: {currentFilters.user}</li>}
            {currentFilters.db_name && <li>Database: {currentFilters.db_name}</li>}
            {currentFilters.only_failed && <li>Status: Failed only</li>}
            {currentFilters.only_success && <li>Status: Success only</li>}
            {!useCustomTime && currentFilters.start_time && (
              <li>From: {new Date(currentFilters.start_time).toLocaleString()}</li>
            )}
            {!useCustomTime && currentFilters.end_time && (
              <li>To: {new Date(currentFilters.end_time).toLocaleString()}</li>
            )}
            {!currentFilters.user && !currentFilters.db_name && !currentFilters.only_failed && !currentFilters.only_success && !currentFilters.start_time && !currentFilters.end_time && (
              <li>None</li>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exportColumns.length === 0}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
