import type { ToolState } from './types';
import type { ToolConfig, ToolExporterDefinition } from '@itsjust/core';
import toolConfig from './tool.config';
import { initialState } from './types';

export const notepadTool = {
  id: 'cron-expression-explainer',
  name: 'Cron Expression Explainer',
  version: '1.0.0',
  config: toolConfig as unknown as ToolConfig,
  initialState: { ...initialState } as ToolState,
  serialize: (state: ToolState): string => JSON.stringify(state, null, 2),
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ] as ToolExporterDefinition[],
  deserialize: (data: unknown) => {
    try {
      if (
        typeof data === 'object' &&
        data !== null &&
        typeof (data as { expression?: unknown }).expression === 'string'
      ) {
        const d = data as { expression: string; error?: unknown };
        return {
          success: true as const,
          data: {
            expression: d.expression,
            error: typeof d.error === 'string' ? d.error : null,
          } as ToolState,
        };
      }
      return {
        success: false as const,
        error: 'Invalid data format: expected { expression: string, error?: string | null }',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deserialization error';
      return {
        success: false as const,
        error: `Failed to deserialize state: ${message}`,
      };
    }
  },
};
