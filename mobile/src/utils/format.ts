import { API_BASE_URL } from '../config';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function groupThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 'Rs 12,990' or 'Rs 12,990.25' (decimals shown only when present). */
export function formatMoney(value: number): string {
  const hasFraction = Math.abs(value % 1) > 1e-9;
  const fixed = hasFraction ? value.toFixed(2) : Math.round(value).toString();
  const [intPart, decPart] = fixed.split('.');
  return `Rs ${groupThousands(intPart)}${decPart ? `.${decPart}` : ''}`;
}

/** 'Rs 285.50' — always two decimals (unit rates always have them on slips). */
export function formatRate(value: number): string {
  const [intPart, decPart] = value.toFixed(2).split('.');
  return `Rs ${groupThousands(intPart)}.${decPart}`;
}

/** '45.50 L' */
export function formatLiters(value: number): string {
  return `${value.toFixed(2)} L`;
}

/** '2026-06-15' → '15 Jun 2026' */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function dayMonth(iso: string): { day: string; month: string } {
  const [, m, d] = iso.split('-').map(Number);
  return { day: String(d), month: MONTHS_SHORT[m - 1].toUpperCase() };
}

/** ISO datetime → '15 Jun 2026, 14:32' (local time) */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** '2026-06' (current month, local time) */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Shifts 'YYYY-MM' by delta months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** '2026-06' → 'June 2026' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** Builds an absolute URL from a relative backend file path like '/uploads/x.png'. */
export function resolveFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** '2026-06' → 'Jun' */
export function monthShortLabel(month: string): string {
  const [, m] = month.split('-').map(Number);
  return MONTHS_SHORT[m - 1] ?? '';
}

/** Compact number for chart labels: 1234 → '1.2k', 1250000 → '1.3M'. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `${(value / 1_000).toFixed(0)}k`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

/** Compact money for chart labels: 'Rs 354k'. */
export function compactMoney(value: number): string {
  return `Rs ${compactNumber(value)}`;
}

/** Today as local ISO date 'YYYY-MM-DD'. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** First day of the current local month as 'YYYY-MM-01'. */
export function firstDayOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}