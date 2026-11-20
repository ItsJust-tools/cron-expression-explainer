'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { ToolState } from '../types';
import { explain, nextRuns } from '../cron-logic';

export interface CronExample {
  label: string;
  expression: string;
}

export const EXAMPLES: CronExample[] = [
  { label: 'Every minute', expression: '* * * * *' },
  { label: 'Daily at 09:30', expression: '30 9 * * *' },
  { label: 'Weekdays at 08:00', expression: '0 8 * * 1-5' },
  { label: 'Every 15 minutes', expression: '*/15 * * * *' },
  { label: 'Every Monday noon', expression: '0 12 * * 1' },
  { label: 'First of month', expression: '0 0 1 * *' },
  { label: 'Quarterly (Jan/Apr/Jul/Oct)', expression: '0 0 1 1,4,7,10 *' },
  { label: 'Nightly backups at 02:00', expression: '0 2 * * *' },
  { label: 'Every 6 hours', expression: '0 */6 * * *' },
  { label: 'Last day of month', expression: '0 0 L * *' },
  { label: 'Every 6 months with seconds', expression: '0 0 0 1 */6 *' },
  { label: 'Alias: @daily', expression: '@daily' },
];

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ToolCanvasProps {
  state: ToolState;
  onChange: (state: ToolState) => void;
}

export const Canvas: React.FC<ToolCanvasProps> = ({ state, onChange }) => {
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const info = explain(state.expression);
    if (info.error || !info.fields.length) return { info, runs: [] as Date[] };
    const { dates } = nextRuns(state.expression, new Date(), 5);
    return { info, runs: dates };
  }, [state.expression]);

  const handleCopy = useCallback(() => {
    if (!result.info.fields.length) return;
    const text = [
      result.info.summary,
      ...result.info.fields.map((f) => `${f.name} (${f.raw}): ${f.description}`),
      '',
      'Next runs:',
      ...result.runs.map((d, i) => `${i + 1}. ${formatDateTime(d)}`),
    ].join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [result]);

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div>
        <label
          htmlFor="cron-input"
          className="block text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1"
        >
          Cron expression
        </label>
        <input
          id="cron-input"
          data-testid="cron-input"
          value={state.expression}
          onChange={(e) => onChange({ ...state, expression: e.target.value, error: null })}
          placeholder="e.g. 30 9 * * 1-5 or @daily"
          spellCheck={false}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 font-mono text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        {result.info.error && (
          <p
            data-testid="cron-error"
            role="alert"
            className="mt-2 text-xs text-red-600 dark:text-red-400"
          >
            {result.info.error}
          </p>
        )}
      </div>

      {result.info.fields.length > 0 && (
        <div
          data-testid="cron-explanation"
          className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-2"
        >
          <p
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            data-testid="cron-summary"
          >
            {result.info.summary}
          </p>
          <ul className="space-y-1">
            {result.info.fields.map((f) => (
              <li key={f.name + f.raw} className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-mono font-semibold">{f.raw}</span>{' '}
                <span className="text-gray-500 dark:text-gray-400">({f.name})</span> —{' '}
                {f.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.runs.length > 0 && (
        <div
          data-testid="cron-next-runs"
          className="rounded-md border border-gray-200 dark:border-gray-800 p-4"
        >
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
            Next 5 runs
          </h3>
          <ol className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
            {result.runs.map((d, i) => (
              <li key={`${d.toISOString()}-${i}`}>
                {i + 1}. {formatDateTime(d)}
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.info.fields.length > 0 && (
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {copied ? 'Copied!' : 'Copy explanation'}
        </button>
      )}
    </div>
  );
};

export default Canvas;
