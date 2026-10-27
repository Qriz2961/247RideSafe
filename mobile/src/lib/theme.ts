// Same orange as the web app (src/app/globals.css).
export const C = {
  brand: "#ea580c",
  brandDark: "#c2410c",
  brandSoft: "#fff7ed",
  ink: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  bg: "#f8fafc",
  danger: "#e11d48",
  ok: "#059669",
};

import { BUSINESS } from "./shared";

export const CONTACT = {
  phone: BUSINESS.phone,
  email: BUSINESS.email,
  messenger: "https://m.me/", // placeholder until the Facebook page link is known
  viber: `viber://chat?number=%2B63${BUSINESS.phone.slice(1)}`,
};

// Demo-only gate for the owner tab. Stage 4 replaces it with Nole's real log-in.
export const OWNER_DEMO_PIN = "2470";
export const TEST_OTP = "123456";
