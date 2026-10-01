import type { Booking } from '../types';

/** Partner share of the service subtotal. Keep in sync with the SQL RPCs. */
export const PARTNER_SHARE = 0.8;

/** What the technician will be paid. Prefer the server value; otherwise
 *  compute with the SAME rounding as the SQL (2 decimals), never Math.round. */
export function payoutFor(b: Pick<Booking, 'subtotal' | 'technician_earnings'>): number {
  if (b.technician_earnings != null) return Number(b.technician_earnings);
  return Math.round(b.subtotal * PARTNER_SHARE * 100) / 100;
}

export function formatMoney(n: number | null | undefined, opts: { paise?: boolean } = {}): string {
  const v = Number(n ?? 0);
  const hasPaise = Math.abs(v % 1) > 0.0001;
  return '₹' + v.toLocaleString('en-IN', {
    minimumFractionDigits: opts.paise || hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** "Today", "Tomorrow", "Sat, 5 Oct" from a YYYY-MM-DD string. */
export function formatDay(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** Indian numbers without country code -> +91, digits only (for wa.me). */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits;
}

export function addressLine(a?: Booking['address_snapshot']): string {
  if (!a) return '';
  if (a.full_address) return a.full_address;
  return [a.flat_number, a.building_name, a.street, a.city, a.pincode].filter(Boolean).join(', ');
}
