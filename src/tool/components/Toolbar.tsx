'use client';

import React from 'react';
import type { ToolState } from '../types';

export const Toolbar: React.FC<{
  state: ToolState;
  onChange: (state: ToolState) => void;
}> = ({ state, onChange }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Cron Expression Explainer
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ expression: '', error: null })}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Clear
        </button>
      </div>
      <input type="hidden" value={state.expression} readOnly />
    </div>
  );
};

export default Toolbar;
