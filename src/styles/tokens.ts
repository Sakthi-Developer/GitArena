/** Design token system — 8pt grid, dark-first palette, motion curves */

export const colors = {
  bg: '#0a0e17',
  surface: '#111827',
  surfaceHover: '#1a2235',
  border: '#1e293b',
  borderHover: '#334155',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  accent: '#6366f1',
  accentHover: '#818cf8',
  accentDim: '#4338ca',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  branchColors: [
    '#6366f1', // indigo
    '#22c55e', // green
    '#f59e0b', // amber
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#a855f7', // purple
    '#14b8a6', // teal
  ],
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const typography = {
  fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const motion = {
  durations: {
    instant: 100,
    fast: 150,
    normal: 200,
    slow: 300,
    verySlow: 500,
  },
  easings: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 4px 6px rgba(0,0,0,0.3)',
  lg: '0 10px 15px rgba(0,0,0,0.4)',
  xl: '0 20px 25px rgba(0,0,0,0.5)',
  glow: '0 0 20px rgba(99,102,241,0.3)',
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

/** Graph rendering constants */
export const graph = {
  nodeRadius: 18,
  nodeRadiusSmall: 10,
  nodeRadiusLOD: 4,
  colSpacing: 80,
  rowSpacing: 70,
  lineWidth: 2.5,
  headHighlightWidth: 3.5,
  fontSize: 13,
  labelPadding: 8,
  lodThreshold: 200,
  virtualizationPadding: 100,
} as const;
