// Shapes mirror the tables in PLAN.md section 4. In Stage 3 these become Supabase tables.

export type ServiceType = "SELF_DRIVE" | "WITH_DRIVER" | "DAY_TOUR" | "LONG_TOUR";

export type BookingStatus =
  | "HELD"
  | "PENDING_VERIFICATION"
  | "CONFIRMED"
  | "ONGOING"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED"
  | "NO_SHOW";

export type PaymentMethod = "GCASH_PAYMONGO" | "GCASH_MANUAL" | "BANK" | "COD";
export type LockInMethod = "GCASH_PAYMONGO" | "MANUAL" | "AGREEMENT_ONLY";
export type PaymentKind = "DEPOSIT" | "BALANCE" | "REFUND";
export type PaymentStatus = "PENDING" | "VERIFIED";

export type UnitType = "Sedan" | "Hatchback" | "MPV" | "SUV" | "Van";

export interface Unit {
  id: string;
  plateNo: string;
  name: string;
  type: UnitType;
  seats: number;
  transmission: "AT" | "MT";
  fuel: "Gas" | "Diesel";
  dailyRate: number; // self-drive, per 24 hrs
  withDriverRate: number; // per day, driver included
  selfDriveAllowed: boolean;
  status: "ACTIVE" | "MAINTENANCE" | "RETIRED";
  color: string; // used for the placeholder photo
}

export interface UnitBlock {
  id: string;
  unitId: string;
  startAt: string;
  endAt: string;
  reason: string;
}

export interface Tour {
  id: string;
  name: string;
  type: "DAY_6H" | "LONG_TERM";
  basePrice: number; // DAY_6H: per tour. LONG_TERM: per day.
  maxPax: number;
  minDays?: number;
  startSlots?: string[]; // "06:00"
  itinerary: string[];
  includes: string[];
}

export interface Customer {
  id: string;
  fullName: string;
  mobile: string; // stored as 09XXXXXXXXX
  email?: string;
  licenseNo?: string;
  isTrusted: boolean;
  isBlocked: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amount: number;
  referenceNo?: string;
  proofFileName?: string;
  status: PaymentStatus;
  createdAt: string;
  verifiedAt?: string;
}

export interface Agreement {
  version: string;
  signedName: string;
  signedAt: string;
}

export interface BookingEvent {
  at: string;
  to: BookingStatus | "NOTE";
  by: "CUSTOMER" | "OWNER" | "SYSTEM";
  note?: string;
}

export interface Booking {
  id: string;
  code: string;
  customerId: string;
  unitId: string;
  tourId?: string;
  serviceType: ServiceType;
  startAt: string;
  endAt: string;
  pax: number;
  pickupLocation: string;
  total: number;
  depositDue: number;
  securityDeposit: number;
  lockIn: LockInMethod;
  status: BookingStatus;
  holdExpiresAt?: string;
  cancelRequested?: boolean;
  createdBy: "CUSTOMER" | "OWNER";
  createdAt: string;
  payments: Payment[];
  agreement?: Agreement;
  events: BookingEvent[];
}

export interface AppState {
  customers: Customer[];
  units: Unit[];
  tours: Tour[];
  blocks: UnitBlock[];
  bookings: Booking[];
  smsLog: SmsLog[];
}

export interface SmsLog {
  id: string;
  bookingId: string;
  to: string;
  template: string;
  body: string;
  at: string;
}
