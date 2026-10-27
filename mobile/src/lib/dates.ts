// Date helpers for the phone pickers (no native date picker needed).

export function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(n: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Local date + "HH:MM" → ISO string. Built by parts so it works the same on iOS and Android. */
export function toIso(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

export const HOURS = Array.from({ length: 17 }, (_, i) => `${String(i + 5).padStart(2, "0")}:00`); // 05:00–21:00

export function hourLabel(t: string) {
  const h = Number(t.slice(0, 2));
  return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
}

/** "YYYY-MM-DD" → local Date at noon (avoids time-zone edge cases). */
export function fromYmd(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
