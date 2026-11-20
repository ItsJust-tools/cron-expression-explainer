export interface CronFieldExplanation {
  name: string;
  raw: string;
  description: string;
  valid: boolean;
}

export interface ToolState {
  expression: string;
  error: string | null;
}

export const initialState: ToolState = {
  expression: '30 9 * * 1-5',
  error: null,
};

export const ALIASES: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@reboot': '0 0 1 1 *',
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
