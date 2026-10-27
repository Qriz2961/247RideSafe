// House rules from PLAN.md. Values marked "Nole to confirm" are placeholders
// until the open questions in PLAN.md section 10 are answered.

export const BUSINESS = {
  name: "24/7 RideSafe",
  legalName: "Twenty Four Seven Ridesafe Car Rental And Tourist Transport OPC",
  address: "Brgy 88 Costa Brava, San Jose, Tacloban City, Leyte 6500",
  owner: "Nole Candiza",
  smsSender: "247RIDESAFE", // 11 characters, the most a PH sender name allows
  // Customer-facing contact. The owner's own numbers are kept out of the app on
  // purpose; Stage 5 reads them from OWNER_ALERT_MOBILES on the server.
  phone: "09206118147",
  email: "twentyfoursevencarrentalandtou@gmail.com", // Gmail caps names at 30 letters, so "tour" lost its "r"
  facebook: "https://www.facebook.com/profile.php?id=61593358162245",
  messenger: "https://m.me/61593358162245",
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
