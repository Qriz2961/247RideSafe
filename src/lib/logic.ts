import { BUSY_STATUSES, CANCELLATION_TIERS, RULES } from "./config";
import type { AppState, Booking, ServiceType, Tour, Unit } from "./types";

const HOUR = 3600_000;

// ---------- Slot check (PLAN.md back-end job 1) ----------

export function isBusy(b: Booking, now = Date.now()): boolean {
  if (!(BUSY_STATUSES as readonly string[]).includes(b.status)) return false;
  if (b.status === "HELD" && b.holdExpiresAt && Date.parse(b.holdExpiresAt) < now) return false;
  return true;
}

/** Two windows clash if they overlap once the turnaround buffer is added to each end. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string, bufferHours = RULES.bufferHours) {
  const buf = bufferHours * HOUR;
  return Date.parse(aStart) < Date.parse(bEnd) + buf && Date.parse(bStart) < Date.parse(aEnd) + buf;
}

export type UnitAvailability =
  | { ok: true }
  | { ok: false; reason: "BOOKED" | "BLOCKED" | "MAINTENANCE" | "TOO_SMALL" | "NO_SELF_DRIVE"; detail?: string };

export function checkUnit(
  state: AppState,
  unit: Unit,
  startAt: string,
  endAt: string,
  opts: { serviceType: ServiceType; pax: number; ignoreBookingId?: string },
): UnitAvailability {
  if (unit.status !== "ACTIVE") return { ok: false, reason: "MAINTENANCE" };
  if (opts.serviceType === "SELF_DRIVE" && !unit.selfDriveAllowed) return { ok: false, reason: "NO_SELF_DRIVE" };
  if (opts.pax > unit.seats) return { ok: false, reason: "TOO_SMALL" };
  const block = state.blocks.find((k) => k.unitId === unit.id && overlaps(startAt, endAt, k.startAt, k.endAt, 0));
  if (block) return { ok: false, reason: "BLOCKED", detail: block.reason };
  const clash = state.bookings.find(
    (b) => b.unitId === unit.id && b.id !== opts.ignoreBookingId && isBusy(b) && overlaps(startAt, endAt, b.startAt, b.endAt),
  );
  if (clash) return { ok: false, reason: "BOOKED" };
  return { ok: true };
}

/** For tours: the smallest free unit that fits everyone. */
export function suggestUnit(state: AppState, startAt: string, endAt: string, serviceType: ServiceType, pax: number) {
  return [...state.units]
    .sort((a, b) => a.seats - b.seats || a.withDriverRate - b.withDriverRate)
    .find((u) => checkUnit(state, u, startAt, endAt, { serviceType, pax }).ok);
}

// ---------- Pricing ----------

export interface Quote {
  lines: { label: string; amount: number }[];
  total: number;
  deposit: number;
  balance: number;
  security: number;
}

export function billableDays(startAt: string, endAt: string) {
  return Math.max(1, Math.ceil((Date.parse(endAt) - Date.parse(startAt)) / (24 * HOUR)));
}

export function quote(serviceType: ServiceType, unit: Unit | undefined, tour: Tour | undefined, startAt: string, endAt: string): Quote {
  const lines: Quote["lines"] = [];
  const days = billableDays(startAt, endAt);
  if (serviceType === "SELF_DRIVE" && unit) lines.push({ label: `${unit.name} · self-drive × ${days} day${days > 1 ? "s" : ""}`, amount: unit.dailyRate * days });
  if (serviceType === "WITH_DRIVER" && unit) lines.push({ label: `${unit.name} · with driver × ${days} day${days > 1 ? "s" : ""}`, amount: unit.withDriverRate * days });
  if (serviceType === "DAY_TOUR" && tour) lines.push({ label: `${tour.name} (6 hrs)`, amount: tour.basePrice });
  if (serviceType === "LONG_TOUR" && tour) lines.push({ label: `${tour.name} × ${days} days`, amount: tour.basePrice * days });

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const deposit = total === 0 ? 0 : Math.min(total, Math.max(RULES.minDeposit, Math.round((total * RULES.depositRate) / 100) * 100));
  const security = serviceType === "SELF_DRIVE" ? RULES.selfDriveSecurityDeposit : 0;
  return { lines, total, deposit, balance: total - deposit, security };
}

// ---------- Money on a booking ----------

export function paidSoFar(b: Booking) {
  return b.payments.filter((p) => p.status === "VERIFIED" && p.kind !== "REFUND").reduce((s, p) => s + p.amount, 0);
}

export function balanceLeft(b: Booking) {
  return Math.max(0, b.total - paidSoFar(b));
}

// ---------- Cancellation (PLAN.md back-end job 9) ----------

export function refundFor(b: Booking, now = Date.now()) {
  const hoursBefore = (Date.parse(b.startAt) - now) / HOUR;
  const tier = CANCELLATION_TIERS.find((t) => hoursBefore >= t.minHoursBefore)!;
  const depositPaid = b.payments.filter((p) => p.kind === "DEPOSIT" && p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);
  return { pct: tier.refundPct, amount: Math.round((depositPaid * tier.refundPct) / 100), hoursBefore: Math.floor(hoursBefore) };
}

// ---------- Small helpers ----------

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newCode(existing: string[]) {
  for (;;) {
    let c = "247-";
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!existing.includes(c)) return c;
  }
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Accepts 09XXXXXXXXX, 9XXXXXXXXX or +639XXXXXXXXX; returns 09XXXXXXXXX or null. */
export function normalizeMobile(raw: string): string | null {
  const d = raw.replace(/[\s-]/g, "");
  const m = d.match(/^(?:\+?63|0)?(9\d{9})$/);
  return m ? `0${m[1]}` : null;
}
