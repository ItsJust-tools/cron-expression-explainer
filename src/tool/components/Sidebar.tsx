'use client';

import React from 'react';
import type { ToolState } from '../types';
import { EXAMPLES } from './Canvas';

export const Sidebar: React.FC<{ state: ToolState; onChange: (state: ToolState) => void }> = ({
  state,
  onChange,
}) => {
  return (
    <div className="p-4 space-y-6 text-sm bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full overflow-y-auto">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Example patterns</h3>
        <div className="space-y-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.expression + ex.label}
              type="button"
              onClick={() => onChange({ ...state, expression: ex.expression, error: null })}
              className="w-full text-left px-3 py-2 text-xs rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="block font-medium text-gray-900 dark:text-gray-100">{ex.label}</span>
              <span className="block font-mono text-gray-500 dark:text-gray-400">
                {ex.expression}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Aliases</h3>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li>
            <span className="font-mono">@hourly</span> — 0 * * * *
          </li>
          <li>
            <span className="font-mono">@daily</span> — 0 0 * * *
          </li>
          <li>
            <span className="font-mono">@weekly</span> — 0 0 * * 0
          </li>
          <li>
            <span className="font-mono">@monthly</span> — 0 0 1 * *
          </li>
          <li>
            <span className="font-mono">@yearly</span> — 0 0 1 1 *
          </li>
          <li>
            <span className="font-mono">@reboot</span> — runs at startup
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
