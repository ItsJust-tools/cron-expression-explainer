import type { ToolConfig } from '@itsjust/core';

export const templateBaseVersion = '1.4.1';

export const toolConfig = {
  id: 'cron-expression-explainer',
  name: 'Cron Expression Explainer',
  description:
    'Explains cron expressions in plain English with a field-by-field breakdown, alias support, and the next 5 scheduled run times. All client-side, privacy-first.',
  version: '1.0.0',
  category: 'Developer',
  exportFormats: ['json', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#22d3ee',
    accentHover: '#0891b2',
    accentSubtle: 'rgba(34, 211, 238, 0.08)',
    brand: 'Cron Expression Explainer',
    icon: '⏰',
  },
  shortcuts: [
    {
      title: 'Cron Expression Explainer',
      shortcuts: [
        {
          keys: 'Ctrl+Shift+C',
          label: 'Copy Explanation',
          description: 'copy the explanation to the clipboard',
        },
        {
          keys: 'Ctrl+Shift+X',
          label: 'Clear Input',
          description: 'clear the expression and result',
        },
      ],
    },
  ],
} as unknown as ToolConfig;

export default toolConfig;
