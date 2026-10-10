"use client";

// Stage 2 stand-in for the database: everything lives in this browser's
// localStorage. Stage 3 swaps these functions for Supabase calls; the screens
// should not need to change much.

import { useSyncExternalStore } from "react";
import { BUSINESS, RULES } from "./config";
import { dateTime, peso, timeOnly } from "./format";
import { balanceLeft, checkUnit, newCode, newId } from "./logic";
import { buildSeed } from "./seed";
import type {
  AppState, Booking, BookingStatus, Customer, LockInMethod, PaymentMethod, ServiceType,
} from "./types";

const KEY = "b247-state-v1";
const EVENT = "b247-change";

let cachedRaw: string | null = null;
let cachedState: AppState | null = null;

function read(): AppState {
  let raw = localStorage.getItem(KEY);
  if (!raw) {
    raw = JSON.stringify(buildSeed());
    localStorage.setItem(KEY, raw);
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = JSON.parse(raw) as AppState;
  }
  return cachedState!;
}

function write(next: AppState) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Returns null during server render / first paint, then the live state. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

function mutate<T>(fn: (s: AppState) => T): T {
  const s = structuredClone(read());
  const result = fn(s);
  write(s);
  return result;
}

export function resetDemo() {
  localStorage.removeItem(KEY);
  cachedRaw = null;
  window.dispatchEvent(new Event(EVENT));
}

// ---------- internal helpers ----------

function find(s: AppState, bookingId: string) {
  const b = s.bookings.find((x) => x.id === bookingId);
  if (!b) throw new Error("Booking not found");
  return b;
}

function setStatusIn(b: Booking, to: BookingStatus, by: "CUSTOMER" | "OWNER" | "SYSTEM", note?: string) {
  b.status = to;
  b.events.push({ at: new Date().toISOString(), to, by, note });
}

/** Simulated SMS (PLAN.md job 7). Stage 5 sends these through Semaphore. */
function sms(s: AppState, b: Booking, template: string) {
  const c = s.customers.find((x) => x.id === b.customerId)!;
  const u = s.units.find((x) => x.id === b.unitId)!;
  const first = c.fullName.split(" ")[0];
  const bodies: Record<string, string> = {
    CONFIRMED: `${BUSINESS.smsSender}: Hi ${first}, booking ${b.code} confirmed. ${u.name}, ${dateTime(b.startAt)}. Balance ${peso(balanceLeft(b))}. Salamat!`,
    RECEIVED: `${BUSINESS.smsSender}: Hi ${first}, we got your payment for ${b.code}. We'll text you once it's checked (usually within 1 hr).`,
    REMINDER_24H: `${BUSINESS.smsSender}: Hi ${first}, pickup tomorrow ${timeOnly(b.startAt)}, ${u.name} ${u.plateNo} @ ${b.pickupLocation}. Ref ${b.code}`,
    CANCELLED: `${BUSINESS.smsSender}: Hi ${first}, booking ${b.code} is cancelled. Any refund will be sent within 3 banking days.`,
    OWNER_NEW: `New booking ${b.code}: ${c.fullName} ${c.mobile}, ${u.name}, ${dateTime(b.startAt)}.`,
  };
  s.smsLog.unshift({
    id: newId("sms"),
    bookingId: b.id,
    to: template === "OWNER_NEW" ? "Nole (owner)" : c.mobile,
    template,
    body: bodies[template] ?? template,
    at: new Date().toISOString(),
  });
}

// ---------- actions ----------

export interface NewBookingInput {
  serviceType: ServiceType;
  unitId: string;
  tourId?: string;
  startAt: string;
  endAt: string;
  pax: number;
  pickupLocation: string;
  total: number;
  depositDue: number;
  securityDeposit: number;
  lockIn: LockInMethod;
  customer: { fullName: string; mobile: string; email?: string; licenseNo?: string };
  signedName: string;
  createdBy: "CUSTOMER" | "OWNER";
}

export type CreateResult = { ok: true; booking: Booking } | { ok: false; error: string };

/**
 * Saves the booking as HELD for 30 minutes. Runs the slot check again at save
 * time, so if someone else grabbed the unit a moment ago this one is refused.
 * (In Stage 3 the database enforces this with an exclusion constraint.)
 */
export function createHold(input: NewBookingInput): CreateResult {
  return mutate<CreateResult>((s) => {
    const unit = s.units.find((u) => u.id === input.unitId);
    if (!unit) return { ok: false, error: "Unit not found." };
    const avail = checkUnit(s, unit, input.startAt, input.endAt, { serviceType: input.serviceType, pax: input.pax });
    if (!avail.ok) return { ok: false, error: "Sorry, that unit was just taken for those dates. Please pick another unit or time." };

    let customer = s.customers.find((c) => c.mobile === input.customer.mobile);
    if (customer?.isBlocked) return { ok: false, error: "We can't take this booking online. Please message us on Messenger." };
    if (!customer) {
      customer = { id: newId("c"), isTrusted: false, isBlocked: false, createdAt: new Date().toISOString(), ...input.customer };
      s.customers.push(customer);
    } else {
      Object.assign(customer, { fullName: input.customer.fullName, email: input.customer.email || customer.email, licenseNo: input.customer.licenseNo || customer.licenseNo });
    }
    if (input.lockIn === "AGREEMENT_ONLY" && !customer.isTrusted && input.createdBy !== "OWNER") {
      return { ok: false, error: "Agreement-only booking is for returning customers. Please pay the deposit." };
    }

    const now = new Date();
    const b: Booking = {
      id: newId("b"),
      code: newCode(s.bookings.map((x) => x.code)),
      customerId: customer.id,
      unitId: input.unitId,
      tourId: input.tourId,
      serviceType: input.serviceType,
      startAt: input.startAt,
      endAt: input.endAt,
      pax: input.pax,
      pickupLocation: input.pickupLocation,
      total: input.total,
      depositDue: input.depositDue,
      securityDeposit: input.securityDeposit,
      lockIn: input.lockIn,
      status: "HELD",
      holdExpiresAt: new Date(now.getTime() + RULES.holdMinutes * 60_000).toISOString(),
      createdBy: input.createdBy,
      createdAt: now.toISOString(),
      payments: [],
      agreement: { version: RULES.agreementVersion, signedName: input.signedName, signedAt: now.toISOString() },
      events: [{ at: now.toISOString(), to: "HELD", by: input.createdBy }],
    };
    s.bookings.push(b);

    if (input.lockIn === "AGREEMENT_ONLY") {
      b.holdExpiresAt = undefined;
      setStatusIn(b, "CONFIRMED", input.createdBy, "Agreement only (trusted customer)");
      sms(s, b, "CONFIRMED");
    }
    sms(s, b, "OWNER_NEW");
    return { ok: true, booking: b };
  });
}

/** TEST MODE: pretends PayMongo's webhook said "paid". */
export function payDepositTestMode(bookingId: string) {
  mutate((s) => {
    const b = find(s, bookingId);
    if (b.status !== "HELD") return;
    const now = new Date().toISOString();
    b.payments.push({ id: newId("p"), kind: "DEPOSIT", method: "GCASH_PAYMONGO", amount: b.depositDue, referenceNo: `pay_test_${Math.random().toString(36).slice(2, 8)}`, status: "VERIFIED", createdAt: now, verifiedAt: now });
    b.holdExpiresAt = undefined;
    setStatusIn(b, "CONFIRMED", "SYSTEM", "PayMongo webhook (test)");
    sms(s, b, "CONFIRMED");
  });
}

export function submitManualProof(bookingId: string, method: "GCASH_MANUAL" | "BANK", referenceNo: string, proofFileName?: string) {
  mutate((s) => {
    const b = find(s, bookingId);
    if (b.status !== "HELD") return;
    b.payments.push({ id: newId("p"), kind: "DEPOSIT", method, amount: b.depositDue, referenceNo, proofFileName, status: "PENDING", createdAt: new Date().toISOString() });
    b.holdExpiresAt = undefined;
    setStatusIn(b, "PENDING_VERIFICATION", "CUSTOMER", `Ref ${referenceNo}`);
    sms(s, b, "RECEIVED");
  });
}

export function verifyPayment(bookingId: string, paymentId: string) {
  mutate((s) => {
    const b = find(s, bookingId);
    const p = b.payments.find((x) => x.id === paymentId);
    if (!p || p.status === "VERIFIED") return;
    p.status = "VERIFIED";
    p.verifiedAt = new Date().toISOString();
    if (b.status === "PENDING_VERIFICATION") {
      setStatusIn(b, "CONFIRMED", "OWNER", `Verified ref ${p.referenceNo}`);
      sms(s, b, "CONFIRMED");
    }
  });
}

export function rejectPayment(bookingId: string, paymentId: string) {
  mutate((s) => {
    const b = find(s, bookingId);
    b.payments = b.payments.filter((x) => x.id !== paymentId);
    if (b.status === "PENDING_VERIFICATION") {
      b.holdExpiresAt = new Date(Date.now() + RULES.holdMinutes * 60_000).toISOString();
      setStatusIn(b, "HELD", "OWNER", "Payment proof rejected – ref no. not found");
    }
  });
}

export function collectBalance(bookingId: string, method: PaymentMethod, referenceNo?: string) {
  mutate((s) => {
    const b = find(s, bookingId);
    const amount = balanceLeft(b);
    if (amount <= 0) return;
    const now = new Date().toISOString();
    b.payments.push({ id: newId("p"), kind: "BALANCE", method, amount, referenceNo, status: "VERIFIED", createdAt: now, verifiedAt: now });
    b.events.push({ at: now, to: "NOTE", by: "OWNER", note: `Balance ${peso(amount)} collected` });
  });
}

export function setStatus(bookingId: string, to: BookingStatus, by: "CUSTOMER" | "OWNER", note?: string) {
  mutate((s) => {
    const b = find(s, bookingId);
    setStatusIn(b, to, by, note);
    b.cancelRequested = false;
    if (to === "CANCELLED") sms(s, b, "CANCELLED");
  });
}

export function requestCancel(bookingId: string) {
  mutate((s) => {
    const b = find(s, bookingId);
    b.cancelRequested = true;
    b.events.push({ at: new Date().toISOString(), to: "NOTE", by: "CUSTOMER", note: "Cancellation requested" });
  });
}

export function cancelWithRefund(bookingId: string, refundAmount: number) {
  mutate((s) => {
    const b = find(s, bookingId);
    if (refundAmount > 0) {
      b.payments.push({ id: newId("p"), kind: "REFUND", method: "GCASH_MANUAL", amount: refundAmount, status: "PENDING", createdAt: new Date().toISOString() });
    }
    b.cancelRequested = false;
    setStatusIn(b, "CANCELLED", "OWNER", refundAmount > 0 ? `Refund ${peso(refundAmount)} to send` : "No refund");
    sms(s, b, "CANCELLED");
  });
}

export function reassignUnit(bookingId: string, unitId: string): CreateResult {
  return mutate<CreateResult>((s) => {
    const b = find(s, bookingId);
    const unit = s.units.find((u) => u.id === unitId)!;
    const ok = checkUnit(s, unit, b.startAt, b.endAt, { serviceType: b.serviceType, pax: b.pax, ignoreBookingId: b.id });
    if (!ok.ok) return { ok: false, error: `${unit.name} is not free for those dates.` };
    b.events.push({ at: new Date().toISOString(), to: "NOTE", by: "OWNER", note: `Unit changed to ${unit.name}` });
    b.unitId = unitId;
    return { ok: true, booking: b };
  });
}

export function sendReminder(bookingId: string) {
  mutate((s) => sms(s, find(s, bookingId), "REMINDER_24H"));
}

export function expireHolds() {
  const s = read();
  const now = Date.now();
  if (!s.bookings.some((b) => b.status === "HELD" && b.holdExpiresAt && Date.parse(b.holdExpiresAt) < now)) return;
  mutate((d) => {
    for (const b of d.bookings) {
      if (b.status === "HELD" && b.holdExpiresAt && Date.parse(b.holdExpiresAt) < now) setStatusIn(b, "EXPIRED", "SYSTEM", "Hold ran out");
    }
  });
}

export function addBlock(unitId: string, startAt: string, endAt: string, reason: string) {
  mutate((s) => s.blocks.push({ id: newId("k"), unitId, startAt, endAt, reason }));
}

export function removeBlock(blockId: string) {
  mutate((s) => {
    s.blocks = s.blocks.filter((k) => k.id !== blockId);
  });
}

export function setUnitStatus(unitId: string, status: "ACTIVE" | "MAINTENANCE") {
  mutate((s) => {
    s.units.find((u) => u.id === unitId)!.status = status;
  });
}

export function toggleCustomerFlag(customerId: string, flag: keyof Pick<Customer, "isTrusted" | "isBlocked">) {
  mutate((s) => {
    const c = s.customers.find((x) => x.id === customerId)!;
    c[flag] = !c[flag];
  });
}

export function declineCancel(bookingId: string) {
  mutate((s) => {
    const b = find(s, bookingId);
    b.cancelRequested = false;
    b.events.push({ at: new Date().toISOString(), to: "NOTE", by: "OWNER", note: "Cancellation request declined" });
  });
}
