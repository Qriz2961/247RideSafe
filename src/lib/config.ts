// House rules from PLAN.md. Values marked "Nole to confirm" are placeholders
// until the open questions in PLAN.md section 10 are answered.

export const BUSINESS = {
  name: "24/7 Rentals & Tours",
  owner: "Nole Candizo",
  smsSender: "247RENTALS",
  // Placeholders: replace with Nole's real accounts before going live.
  gcashName: "NOLE C.",
  gcashNumber: "0917 000 0000",
  bankName: "BDO",
  bankAccountName: "NOLE CANDIZO",
  bankAccountNo: "0000 0000 0000",
};

export const RULES = {
  bufferHours: 2, // turnaround between bookings (Nole to confirm)
  holdMinutes: 30,
  depositRate: 0.3, // Nole to confirm: fixed or percentage
  minDeposit: 1000,
  selfDriveSecurityDeposit: 3000, // refundable, Nole to confirm
  selfDriveMinAge: 21,
  agreementVersion: "v1-draft",
};

// Refund share of the deposit, by hours before pickup (Nole to confirm).
export const CANCELLATION_TIERS = [
  { minHoursBefore: 72, refundPct: 100 },
  { minHoursBefore: 24, refundPct: 50 },
  { minHoursBefore: -Infinity, refundPct: 0 },
];

// Statuses that keep a unit busy.
export const BUSY_STATUSES = ["HELD", "PENDING_VERIFICATION", "CONFIRMED", "ONGOING"] as const;
