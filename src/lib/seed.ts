import type { AppState, Booking, Customer, Tour, Unit, UnitBlock } from "./types";

// Fake data for Stage 2. Dates are built relative to "now" so the owner
// dashboard always has something to show.

export const UNITS: Unit[] = [
  { id: "u1", plateNo: "NBC 1234", name: "Toyota Vios 2023", type: "Sedan", seats: 5, transmission: "AT", fuel: "Gas", dailyRate: 1800, withDriverRate: 2800, selfDriveAllowed: true, status: "ACTIVE", color: "#e2e8f0" },
  { id: "u2", plateNo: "NDA 5678", name: "Toyota Innova 2023", type: "MPV", seats: 7, transmission: "AT", fuel: "Diesel", dailyRate: 2800, withDriverRate: 3800, selfDriveAllowed: true, status: "ACTIVE", color: "#cbd5e1" },
  { id: "u3", plateNo: "NFE 2468", name: "Mitsubishi Xpander 2024", type: "MPV", seats: 7, transmission: "AT", fuel: "Gas", dailyRate: 2500, withDriverRate: 3500, selfDriveAllowed: true, status: "ACTIVE", color: "#fecaca" },
  { id: "u4", plateNo: "NGH 1357", name: "Toyota Fortuner 2022", type: "SUV", seats: 7, transmission: "AT", fuel: "Diesel", dailyRate: 3500, withDriverRate: 4500, selfDriveAllowed: true, status: "ACTIVE", color: "#1e293b" },
  { id: "u5", plateNo: "NJK 9090", name: "Toyota HiAce GL Grandia", type: "Van", seats: 12, transmission: "AT", fuel: "Diesel", dailyRate: 0, withDriverRate: 5500, selfDriveAllowed: false, status: "ACTIVE", color: "#f1f5f9" },
  { id: "u6", plateNo: "NLM 4321", name: "Nissan Urvan NV350", type: "Van", seats: 15, transmission: "MT", fuel: "Diesel", dailyRate: 0, withDriverRate: 5000, selfDriveAllowed: false, status: "ACTIVE", color: "#e5e7eb" },
];

export const TOURS: Tour[] = [
  {
    id: "t1",
    name: "City & Heritage Day Tour",
    type: "DAY_6H",
    basePrice: 4500,
    maxPax: 15,
    startSlots: ["06:00", "08:00", "13:00"],
    itinerary: ["Old churches & plaza", "Local market food stop", "Heritage houses", "Pasalubong center"],
    includes: ["Driver", "Fuel", "Parking"],
  },
  {
    id: "t2",
    name: "Beach & Falls Day Tour",
    type: "DAY_6H",
    basePrice: 5500,
    maxPax: 15,
    startSlots: ["05:00", "07:00"],
    itinerary: ["Falls & swimming", "Lunch by the beach", "Sunset viewpoint"],
    includes: ["Driver", "Fuel", "Tolls"],
  },
  {
    id: "t3",
    name: "Province Loop (Long-term Tour)",
    type: "LONG_TERM",
    basePrice: 6000,
    maxPax: 15,
    minDays: 2,
    itinerary: ["Day 1: north towns & beaches", "Day 2: mountain resort", "Day 3+: free itinerary with driver"],
    includes: ["Driver", "Fuel up to 200 km/day"],
  },
];

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function buildSeed(): AppState {
  const now = new Date().toISOString();

  const customers: Customer[] = [
    { id: "c1", fullName: "Ana Dela Cruz", mobile: "09171234567", email: "ana@example.com", licenseNo: "N01-23-456789", isTrusted: true, isBlocked: false, createdAt: now },
    { id: "c2", fullName: "Mark Villanueva", mobile: "09181234567", isTrusted: false, isBlocked: false, createdAt: now },
    { id: "c3", fullName: "Joy Santos (ABC Corp)", mobile: "09191234567", email: "joy@abccorp.ph", isTrusted: true, isBlocked: false, createdAt: now },
  ];

  const ev = (to: Booking["status"]) => [{ at: now, to, by: "SYSTEM" as const, note: "Sample data" }];

  const bookings: Booking[] = [
    {
      id: "b1", code: "247-K3F9", customerId: "c1", unitId: "u2", serviceType: "SELF_DRIVE",
      startAt: at(1, 8), endAt: at(3, 8), pax: 5, pickupLocation: "Robinsons Place, main entrance",
      total: 5600, depositDue: 1700, securityDeposit: 3000, lockIn: "GCASH_PAYMONGO", status: "CONFIRMED",
      createdBy: "CUSTOMER", createdAt: now,
      payments: [{ id: "p1", kind: "DEPOSIT", method: "GCASH_PAYMONGO", amount: 1700, referenceNo: "pay_test_8812", status: "VERIFIED", createdAt: now, verifiedAt: now }],
      agreement: { version: "v1-draft", signedName: "Ana Dela Cruz", signedAt: now },
      events: ev("CONFIRMED"),
    },
    {
      id: "b2", code: "247-P7QX", customerId: "c2", unitId: "u5", tourId: "t1", serviceType: "DAY_TOUR",
      startAt: at(0, 13), endAt: at(0, 19), pax: 10, pickupLocation: "SM City, Entrance 2",
      total: 4500, depositDue: 1400, securityDeposit: 0, lockIn: "MANUAL", status: "PENDING_VERIFICATION",
      createdBy: "CUSTOMER", createdAt: now,
      payments: [{ id: "p2", kind: "DEPOSIT", method: "GCASH_MANUAL", amount: 1400, referenceNo: "5012 334 889201", proofFileName: "gcash-receipt.jpg", status: "PENDING", createdAt: now }],
      agreement: { version: "v1-draft", signedName: "Mark Villanueva", signedAt: now },
      events: ev("PENDING_VERIFICATION"),
    },
    {
      id: "b3", code: "247-ZR2M", customerId: "c3", unitId: "u6", tourId: "t3", serviceType: "LONG_TOUR",
      startAt: at(4, 6), endAt: at(7, 6), pax: 14, pickupLocation: "ABC Corp office, Business Park",
      total: 18000, depositDue: 5400, securityDeposit: 0, lockIn: "AGREEMENT_ONLY", status: "CONFIRMED",
      createdBy: "OWNER", createdAt: now, payments: [],
      agreement: { version: "v1-draft", signedName: "Joy Santos", signedAt: now },
      events: ev("CONFIRMED"),
    },
    {
      id: "b4", code: "247-H8DW", customerId: "c1", unitId: "u1", serviceType: "WITH_DRIVER",
      startAt: at(-1, 7), endAt: at(0, 19), pax: 3, pickupLocation: "Airport arrival area",
      total: 5600, depositDue: 1700, securityDeposit: 0, lockIn: "GCASH_PAYMONGO", status: "ONGOING",
      createdBy: "CUSTOMER", createdAt: now,
      payments: [{ id: "p3", kind: "DEPOSIT", method: "GCASH_PAYMONGO", amount: 1700, referenceNo: "pay_test_7710", status: "VERIFIED", createdAt: now, verifiedAt: now }],
      agreement: { version: "v1-draft", signedName: "Ana Dela Cruz", signedAt: now },
      events: ev("ONGOING"),
    },
  ];

  const blocks: UnitBlock[] = [
    { id: "k1", unitId: "u4", startAt: at(2, 8), endAt: at(3, 17), reason: "PMS at casa (10,000 km)" },
  ];

  return { customers, units: UNITS, tours: TOURS, blocks, bookings, smsLog: [] };
}
