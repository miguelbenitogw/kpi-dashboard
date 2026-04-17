/**
 * Globalworking brand theme tokens for runtime use (recharts, inline styles).
 *
 * Keep in sync with src/app/globals.css @theme inline.
 * For Tailwind classes, use the CSS variables (bg-brand-600, text-accent-500, etc.).
 */

export const brandColors = {
  // Primary blue (logo wordmark)
  brand: {
    50: '#eaf0fb',
    100: '#c7d5f1',
    200: '#9db5e3',
    300: '#6f93d4',
    400: '#4877c7',
    500: '#2e6bc2',
    600: '#1e4b9e', // PRIMARY
    700: '#173b7d',
    800: '#112c5e',
    900: '#0b1e41',
  },
  // Accent orange (logo swoosh)
  accent: {
    50: '#fdece4',
    100: '#fbd1bf',
    200: '#f7ae91',
    300: '#f18a63',
    400: '#ea6e41',
    500: '#e55a2b', // PRIMARY
    600: '#c54620',
    700: '#9f3519',
    800: '#782614',
    900: '#4d180c',
  },
  // Dark navy surfaces
  surface: {
    950: '#0a1324',
    900: '#121c30',
    850: '#17243e',
    800: '#1e2d4c',
    700: '#2b3d61',
    600: '#3a4f78',
  },
  // Traffic light semantics
  ok: { 500: '#16a34a', 400: '#22c55e' },
  warn: { 500: '#eab308', 400: '#facc15' },
  danger: { 500: '#dc2626', 400: '#ef4444' },
  neutral: {
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
  },
} as const

/**
 * Categorical palette for charts — uses brand blues + accent orange first,
 * then neutral fallbacks. Good for status distributions, source breakdowns, etc.
 */
export const chartCategorical = [
  brandColors.brand[600],
  brandColors.accent[500],
  brandColors.brand[400],
  brandColors.accent[300],
  brandColors.brand[300],
  brandColors.accent[700],
  brandColors.brand[800],
  brandColors.neutral[500],
]

/**
 * Semaphore palette — for good/warn/danger grouped charts.
 */
export const chartSemaphore = {
  ok: brandColors.ok[500],
  warn: brandColors.warn[500],
  danger: brandColors.danger[500],
}

/**
 * Common recharts style props for a GW-branded dark theme.
 */
export const chartTheme = {
  grid: { stroke: brandColors.surface[700], strokeDasharray: '3 3' },
  axis: {
    tick: { fill: brandColors.neutral[400], fontSize: 11 },
    axisLine: { stroke: brandColors.surface[700] },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: brandColors.surface[850],
      border: `1px solid ${brandColors.brand[700]}`,
      borderRadius: '8px',
      color: '#f3f4f6',
    },
    labelStyle: { color: brandColors.neutral[400] },
    itemStyle: { color: '#e5e7eb' },
  },
}

/**
 * Status → color for candidate lifecycle (formation / placement stages).
 * Biased toward brand blues for "active" states and accent orange for
 * "attention" states, with hard semantic red for terminal failures.
 */
export const statusColor: Record<string, string> = {
  // Hired / success
  'Hired': brandColors.ok[500],
  'Training Finished': brandColors.ok[400],
  'Assigned': brandColors.brand[500],
  // In-progress
  'In Training': brandColors.brand[600],
  'To Place': brandColors.brand[400],
  'Working on it': brandColors.brand[500],
  'Interview in process': brandColors.brand[400],
  'Onboarding': brandColors.brand[300],
  'Registration ready': brandColors.brand[200],
  'Presented to an Agency': brandColors.brand[400],
  // Attention
  'Offer-Withdrawn': brandColors.accent[500],
  'Offer-Declined': brandColors.accent[400],
  'Stand-by': brandColors.neutral[500],
  'Transferred': brandColors.accent[300],
  'Not ready to present': brandColors.neutral[400],
  // Terminal failure
  'Expelled': brandColors.danger[500],
  'Resign': brandColors.danger[400],
  'Rejected': brandColors.danger[500],
  'Not Valid': brandColors.danger[400],
  // Hired-by variants
  'Hired by Kommuner Fast': brandColors.ok[500],
  'Hired by Kommuner temporary': brandColors.ok[400],
  'Hired by agency': brandColors.brand[500],
}

export function colorForStatus(status: string): string {
  return statusColor[status] ?? brandColors.neutral[500]
}
