import type { BookingStatus, PaymentMethod, ServiceType } from "./types";

export const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const dateOnly = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

export const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

export const prettyMobile = (m: string) => `${m.slice(0, 4)} ${m.slice(4, 7)} ${m.slice(7)}`;

export const SERVICE_LABEL: Record<ServiceType, string> = {
  SELF_DRIVE: "Self-drive",
  WITH_DRIVER: "With driver",
  DAY_TOUR: "6-hour Day Tour",
  LONG_TOUR: "Long-term Tour",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  HELD: "On hold – awaiting deposit",
  PENDING_VERIFICATION: "Checking payment",
  CONFIRMED: "Confirmed",
  ONGOING: "On the road",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const STATUS_STYLE: Record<BookingStatus, string> = {
  HELD: "bg-amber-100 text-amber-800 ring-amber-300",
  PENDING_VERIFICATION: "bg-orange-100 text-orange-800 ring-orange-300",
  CONFIRMED: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  ONGOING: "bg-sky-100 text-sky-800 ring-sky-300",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-300",
  EXPIRED: "bg-slate-100 text-slate-500 ring-slate-200",
  CANCELLED: "bg-rose-100 text-rose-700 ring-rose-300",
  NO_SHOW: "bg-rose-100 text-rose-700 ring-rose-300",
};

// Solid colours for the owner's calendar bars.
export const STATUS_BAR: Record<BookingStatus, string> = {
  HELD: "bg-amber-400",
  PENDING_VERIFICATION: "bg-orange-500",
  CONFIRMED: "bg-emerald-500",
  ONGOING: "bg-sky-500",
  COMPLETED: "bg-slate-400",
  EXPIRED: "bg-slate-300",
  CANCELLED: "bg-rose-300",
  NO_SHOW: "bg-rose-400",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  GCASH_PAYMONGO: "GCash (PayMongo)",
  GCASH_MANUAL: "GCash send-money",
  BANK: "Bank transfer",
  COD: "Cash on pickup",
};
