"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AgreementText from "@/components/AgreementText";
import PaymentPanel from "@/components/PaymentPanel";
import StatusBadge from "@/components/StatusBadge";
import UnitPhoto from "@/components/UnitPhoto";
import { RULES } from "@/lib/config";
import { dateTime, peso, prettyMobile, SERVICE_LABEL } from "@/lib/format";
import { checkUnit, normalizeMobile, quote, suggestUnit, type UnitAvailability } from "@/lib/logic";
import { createHold, useAppState } from "@/lib/store";
import type { AppState, LockInMethod, ServiceType } from "@/lib/types";

const SERVICES: { key: ServiceType; title: string; note: string }[] = [
  { key: "SELF_DRIVE", title: "Self-drive", note: "Per 24 hrs · license needed" },
  { key: "WITH_DRIVER", title: "With driver", note: "Per day · driver included" },
  { key: "DAY_TOUR", title: "6-hour Day Tour", note: "Package · driver + fuel" },
  { key: "LONG_TOUR", title: "Long-term Tour", note: "Multi-day · per day" },
];

const STEPS = ["Service", "When", "Unit", "Details", "Deposit"];

const REASON_TEXT: Record<Exclude<UnitAvailability, { ok: true }>["reason"], string> = {
  BOOKED: "Booked for these dates",
  BLOCKED: "Not available (maintenance)",
  MAINTENANCE: "In the shop",
  TOO_SMALL: "Not enough seats",
  NO_SELF_DRIVE: "With driver only",
};

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}
const toIso = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

export default function BookingWizard() {
  const params = useSearchParams();
  const ownerMode = params.get("owner") === "1";
  const initialService = (SERVICES.find((s) => s.key === params.get("service"))?.key ?? null) as ServiceType | null;
  const state = useAppState();

  const [step, setStep] = useState(initialService ? 1 : 0);
  const [service, setService] = useState<ServiceType | null>(initialService);
  const [tourId, setTourId] = useState<string>();
  const [startDate, setStartDate] = useState(addDays(1));
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState(addDays(2));
  const [endTime, setEndTime] = useState("08:00");
  const [slot, setSlot] = useState<string>();
  const [days, setDays] = useState(3);
  const [pax, setPax] = useState(2);
  const [unitId, setUnitId] = useState<string>();
  const [d, setD] = useState({ fullName: "", mobile: "", email: "", pickup: "", licenseNo: "", licenseFile: "", ageOk: false });
  const [agree, setAgree] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [lockIn, setLockIn] = useState<LockInMethod>("GCASH_PAYMONGO");
  const [bookingId, setBookingId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    globalThis.scrollTo?.({ top: 0, behavior: "smooth" });
  }, [step, bookingId]);

  const isTour = service === "DAY_TOUR" || service === "LONG_TOUR";
  const tours = state?.tours.filter((t) => (service === "DAY_TOUR" ? t.type === "DAY_6H" : t.type === "LONG_TERM")) ?? [];
  const tour = state?.tours.find((t) => t.id === tourId);
  const unit = state?.units.find((u) => u.id === unitId);

  const win = useMemo(() => {
    if (!service) return null;
    try {
      if (service === "DAY_TOUR") {
        if (!slot) return null;
        const s = toIso(startDate, slot);
        return { startAt: s, endAt: new Date(Date.parse(s) + 6 * 3600_000).toISOString() };
      }
      if (service === "LONG_TOUR") {
        const s = toIso(startDate, startTime);
        return { startAt: s, endAt: new Date(Date.parse(s) + days * 24 * 3600_000).toISOString() };
      }
      return { startAt: toIso(startDate, startTime), endAt: toIso(endDate, endTime) };
    } catch {
      return null;
    }
  }, [service, slot, startDate, startTime, endDate, endTime, days]);

  const whenError = (() => {
    if (!win) return service === "DAY_TOUR" ? "Pick a start time." : "Enter valid dates.";
    if (Date.parse(win.startAt) < Date.now() + 2 * 3600_000) return "Pickup must be at least 2 hours from now.";
    if (Date.parse(win.endAt) <= Date.parse(win.startAt)) return "Return must be after pickup.";
    if (isTour && !tour) return "Pick a tour package.";
    if (tour && pax > tour.maxPax) return `This tour takes up to ${tour.maxPax} people.`;
    if (service === "LONG_TOUR" && tour?.minDays && days < tour.minDays) return `Minimum ${tour.minDays} days.`;
    if (pax < 1) return "At least 1 passenger.";
    return null;
  })();

  const q = service && win ? quote(service, unit, tour, win.startAt, win.endAt) : null;
  const mobile = normalizeMobile(d.mobile);
  const existing = mobile ? state?.customers.find((c) => c.mobile === mobile) : undefined;
  const canAgreementOnly = ownerMode || !!existing?.isTrusted;
  const booking = bookingId ? state?.bookings.find((b) => b.id === bookingId) : undefined;

  const detailsError = (() => {
    if (d.fullName.trim().length < 3) return "Enter your full name.";
    if (!mobile) return "Enter a valid PH mobile number (09XX XXX XXXX).";
    if (!d.pickup.trim()) return "Where should we meet you?";
    if (service === "SELF_DRIVE") {
      if (!d.licenseNo.trim()) return "Enter your driver's license number.";
      if (!ownerMode && !d.licenseFile) return "Upload a photo of your license.";
      if (!d.ageOk) return `Confirm you are ${RULES.selfDriveMinAge} or older.`;
    }
    if (!agree) return "Please read and accept the booking agreement.";
    if (signedName.trim().toLowerCase() !== d.fullName.trim().toLowerCase()) return "Type your full name exactly to sign.";
    return null;
  })();

  function pickService(s: ServiceType) {
    setService(s);
    setTourId(undefined);
    setSlot(undefined);
    setUnitId(undefined);
    setStep(1);
  }

  function goToUnits(st: AppState) {
    if (!service || !win) return;
    // Tours: pre-pick the smallest free unit that fits the group.
    if (isTour) setUnitId(suggestUnit(st, win.startAt, win.endAt, service, pax)?.id);
    else if (unitId && unit && !checkUnit(st, unit, win.startAt, win.endAt, { serviceType: service, pax }).ok) setUnitId(undefined);
    setStep(2);
  }

  function hold() {
    if (!service || !win || !unitId || !q || !mobile) return;
    setError(undefined);
    const res = createHold({
      serviceType: service,
      unitId,
      tourId,
      startAt: win.startAt,
      endAt: win.endAt,
      pax,
      pickupLocation: d.pickup.trim(),
      total: q.total,
      depositDue: q.deposit,
      securityDeposit: q.security,
      lockIn,
      customer: { fullName: d.fullName.trim(), mobile, email: d.email.trim() || undefined, licenseNo: d.licenseNo.trim() || undefined },
      signedName: signedName.trim(),
      createdBy: ownerMode ? "OWNER" : "CUSTOMER",
    });
    if (!res.ok) {
      setError(res.error);
      if (res.error.includes("just taken")) setStep(2);
      return;
    }
    setBookingId(res.booking.id);
    try {
      sessionStorage.setItem("b247-mobile", mobile);
    } catch {}
    setStep(4);
  }

  if (!state) return <p className="p-6 text-slate-500">Loading…</p>;

  // ---------- Done screen ----------
  if (booking && booking.status !== "HELD") {
    const lastSms = state.smsLog.find((m) => m.bookingId === booking.id && m.template !== "OWNER_NEW");
    const u = state.units.find((x) => x.id === booking.unitId)!;
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="card p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl">
            {booking.status === "CONFIRMED" ? "✓" : booking.status === "EXPIRED" ? "⌛" : "…"}
          </div>
          <h1 className="mt-3 text-xl font-extrabold">
            {booking.status === "CONFIRMED" ? "You're booked!" : booking.status === "PENDING_VERIFICATION" ? "Payment received, checking it now" : "This hold has expired"}
          </h1>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-brand-700">{booking.code}</p>
          <div className="mt-2"><StatusBadge status={booking.status} /></div>
          <dl className="mt-5 space-y-1 text-left text-sm">
            <Row k="Service" v={SERVICE_LABEL[booking.serviceType]} />
            <Row k="Unit" v={`${u.name} · ${u.plateNo}`} />
            <Row k="Pickup" v={`${dateTime(booking.startAt)} · ${booking.pickupLocation}`} />
            <Row k="Return" v={dateTime(booking.endAt)} />
            <Row k="Total" v={peso(booking.total)} />
            <Row k="Balance at pickup" v={peso(booking.total - booking.payments.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0))} />
          </dl>
        </div>
        {lastSms && (
          <div className="card p-4">
            <p className="label">Text message sent to {prettyMobile(lastSms.to)}</p>
            <p className="rounded-2xl rounded-tl-sm bg-slate-100 p-3 text-sm">{lastSms.body}</p>
          </div>
        )}
        <div className="flex gap-2">
          <Link href={ownerMode ? "/owner" : "/my-bookings"} className="btn-primary flex-1">{ownerMode ? "Back to dashboard" : "See my bookings"}</Link>
          <button className="btn-ghost" onClick={() => location.assign(ownerMode ? "/book?owner=1" : "/book")}>Book another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {ownerMode && (
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Owner mode: encoding a walk-in / Messenger booking. Same slot check applies.</div>
        )}
        <ol className="flex gap-1">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                disabled={i > step || !!bookingId}
                onClick={() => setStep(i)}
                className={`w-full border-t-4 pt-1 text-left text-[11px] font-semibold uppercase tracking-wide ${i <= step ? "border-brand-500 text-brand-700" : "border-slate-200 text-slate-400"}`}
              >
                {i + 1}. {s}
              </button>
            </li>
          ))}
        </ol>

        {/* Step 0: service */}
        {step === 0 && (
          <section className="card p-5">
            <h1 className="text-lg font-bold">What do you need?</h1>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SERVICES.map((s) => (
                <button key={s.key} onClick={() => pickService(s.key)} className={`rounded-xl p-4 text-left ring-1 transition hover:ring-brand-500 ${service === s.key ? "bg-brand-50 ring-brand-500" : "ring-slate-200"}`}>
                  <span className="block font-semibold">{s.title}</span>
                  <span className="text-xs text-slate-500">{s.note}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Step 1: when */}
        {step === 1 && service && (
          <section className="card space-y-4 p-5">
            <h1 className="text-lg font-bold">{SERVICE_LABEL[service]}: when?</h1>

            {isTour && (
              <div className="grid gap-2">
                <span className="label">Tour package</span>
                {tours.map((t) => (
                  <button key={t.id} onClick={() => setTourId(t.id)} className={`rounded-xl p-3 text-left ring-1 ${tourId === t.id ? "bg-brand-50 ring-brand-500" : "ring-slate-200"}`}>
                    <span className="flex justify-between font-semibold">
                      <span>{t.name}</span>
                      <span>{peso(t.basePrice)}{t.type === "LONG_TERM" ? "/day" : ""}</span>
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{t.itinerary.join(" · ")}</span>
                    <span className="mt-1 block text-xs text-emerald-700">Includes: {t.includes.join(", ")}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="sd">{isTour ? "Tour date" : "Pickup date"}</label>
                <input id="sd" type="date" className="input" min={addDays(0)} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              {service === "DAY_TOUR" ? (
                <div>
                  <span className="label">Start time (6 hrs)</span>
                  <div className="flex flex-wrap gap-2">
                    {(tour?.startSlots ?? []).map((s) => (
                      <button key={s} onClick={() => setSlot(s)} className={`rounded-lg px-3 py-2 text-sm ring-1 ${slot === s ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-300"}`}>{s}</button>
                    ))}
                    {!tour && <span className="text-sm text-slate-400">Pick a package first</span>}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label" htmlFor="st">{isTour ? "Pickup time" : "Pickup time"}</label>
                  <input id="st" type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
              )}
              {(service === "SELF_DRIVE" || service === "WITH_DRIVER") && (
                <>
                  <div>
                    <label className="label" htmlFor="ed">Return date</label>
                    <input id="ed" type="date" className="input" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="et">Return time</label>
                    <input id="et" type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </>
              )}
              {service === "LONG_TOUR" && (
                <div>
                  <label className="label" htmlFor="days">Number of days</label>
                  <input id="days" type="number" min={tour?.minDays ?? 2} max={30} className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} />
                </div>
              )}
              <div>
                <label className="label" htmlFor="pax">Passengers</label>
                <input id="pax" type="number" min={1} max={15} className="input" value={pax} onChange={(e) => setPax(Number(e.target.value))} />
              </div>
            </div>
            {whenError && <p className="text-sm text-rose-600">{whenError}</p>}
            <div className="flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(0)}>Back</button>
              <button className="btn-primary" disabled={!!whenError} onClick={() => goToUnits(state)}>See free units</button>
            </div>
          </section>
        )}

        {/* Step 2: unit */}
        {step === 2 && service && win && (
          <section className="card space-y-4 p-5">
            <div>
              <h1 className="text-lg font-bold">Pick a unit</h1>
              <p className="text-sm text-slate-500">{dateTime(win.startAt)} → {dateTime(win.endAt)} · {pax} pax</p>
              {isTour && <p className="mt-1 text-xs text-emerald-700">We picked the smallest free unit that fits your group. You can change it.</p>}
            </div>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {state.units.filter((u) => u.status !== "RETIRED").map((u) => {
                const a = checkUnit(state, u, win.startAt, win.endAt, { serviceType: service, pax });
                const rate = service === "SELF_DRIVE" ? u.dailyRate : u.withDriverRate;
                return (
                  <button
                    key={u.id}
                    disabled={!a.ok}
                    onClick={() => setUnitId(u.id)}
                    className={`rounded-2xl p-3 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-45 disabled:grayscale ${unitId === u.id ? "bg-brand-50 ring-2 ring-brand-500" : "ring-slate-200 hover:ring-brand-300"}`}
                  >
                    <UnitPhoto unit={u} className="h-24 w-full" />
                    <span className="mt-2 flex items-start justify-between gap-2">
                      <span>
                        <span className="block font-semibold">{u.name}</span>
                        <span className="text-xs text-slate-500">{u.type} · {u.seats} seats · {u.transmission} · {u.fuel}</span>
                      </span>
                      {!isTour && rate > 0 && <span className="whitespace-nowrap text-sm font-bold">{peso(rate)}<span className="text-xs font-normal text-slate-500">/day</span></span>}
                    </span>
                    {!a.ok && <span className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">{REASON_TEXT[a.reason]}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary" disabled={!unitId} onClick={() => { setError(undefined); setStep(3); }}>Continue</button>
            </div>
          </section>
        )}

        {/* Step 3: details + agreement */}
        {step === 3 && service && (
          <section className="card space-y-4 p-5">
            <h1 className="text-lg font-bold">Your details</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" id="fn" value={d.fullName} onChange={(v) => setD({ ...d, fullName: v })} placeholder="Juan Dela Cruz" />
              <Field label="Mobile number" id="mo" value={d.mobile} onChange={(v) => setD({ ...d, mobile: v })} placeholder="0917 123 4567" inputMode="tel" />
              <Field label="Email (optional)" id="em" value={d.email} onChange={(v) => setD({ ...d, email: v })} placeholder="you@email.com" />
              <Field label="Pickup / meeting spot" id="pl" value={d.pickup} onChange={(v) => setD({ ...d, pickup: v })} placeholder="e.g. Airport arrival, SM entrance 2" />
              {service === "SELF_DRIVE" && (
                <>
                  <Field label="Driver's license no." id="ln" value={d.licenseNo} onChange={(v) => setD({ ...d, licenseNo: v })} placeholder="N01-23-456789" />
                  <div>
                    <label className="label" htmlFor="lf">License photo</label>
                    <input id="lf" type="file" accept="image/*" className="input" onChange={(e) => setD({ ...d, licenseFile: e.target.files?.[0]?.name ?? "" })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={d.ageOk} onChange={(e) => setD({ ...d, ageOk: e.target.checked })} />
                    I am {RULES.selfDriveMinAge} or older and my license is valid (foreign license: within 90 days of arrival).
                  </label>
                </>
              )}
            </div>
            {existing && !existing.isBlocked && <p className="text-xs text-emerald-700">Welcome back, {existing.fullName.split(" ")[0]}!</p>}

            <div className="rounded-xl ring-1 ring-slate-200">
              <div className="max-h-48 overflow-y-auto p-4"><AgreementText /></div>
              <div className="space-y-3 border-t border-slate-200 p-4">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  I have read and agree to the booking agreement and the privacy notice.
                </label>
                <Field label="Type your full name to sign" id="sig" value={signedName} onChange={setSignedName} placeholder={d.fullName || "Your full name"} />
              </div>
            </div>

            <div>
              <span className="label">How do you want to lock it in?</span>
              <div className="grid gap-2 sm:grid-cols-3">
                <LockOption active={lockIn === "GCASH_PAYMONGO"} onClick={() => setLockIn("GCASH_PAYMONGO")} title="GCash / QR Ph" note="Instant confirmation" />
                <LockOption active={lockIn === "MANUAL"} onClick={() => setLockIn("MANUAL")} title="Send-money / Bank" note="Upload receipt; we check it" />
                <LockOption active={lockIn === "AGREEMENT_ONLY"} disabled={!canAgreementOnly} onClick={() => setLockIn("AGREEMENT_ONLY")} title="Agreement only" note={canAgreementOnly ? "Trusted customer, pay at pickup" : "For returning customers only"} />
              </div>
            </div>

            {detailsError && <p className="text-sm text-rose-600">{detailsError}</p>}
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div className="flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary" disabled={!!detailsError} onClick={hold}>
                {lockIn === "AGREEMENT_ONLY" ? "Confirm booking" : "Hold unit & pay deposit"}
              </button>
            </div>
          </section>
        )}

        {/* Step 4: deposit */}
        {step === 4 && booking && booking.status === "HELD" && (
          <section className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold">Pay the deposit</h1>
              <span className="font-mono text-sm font-bold text-brand-700">{booking.code}</span>
            </div>
            <PaymentPanel booking={booking} />
          </section>
        )}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-3 p-4 text-sm">
          <p className="font-bold">Summary</p>
          {!service && <p className="text-slate-400">Pick a service to start.</p>}
          {service && <Row k="Service" v={SERVICE_LABEL[service]} />}
          {tour && <Row k="Package" v={tour.name} />}
          {win && step >= 2 && <Row k="Pickup" v={dateTime(win.startAt)} />}
          {win && step >= 2 && <Row k="Return" v={dateTime(win.endAt)} />}
          {unit && <Row k="Unit" v={unit.name} />}
          {q && q.total > 0 && (
            <div className="space-y-1 border-t border-slate-200 pt-3">
              {q.lines.map((l) => <Row key={l.label} k={l.label} v={peso(l.amount)} />)}
              <Row k="Total" v={peso(q.total)} bold />
              <Row k="Deposit now" v={peso(q.deposit)} bold accent />
              <Row k="Balance at pickup" v={peso(q.balance)} />
              {q.security > 0 && <Row k="Security deposit (refundable, at pickup)" v={peso(q.security)} />}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v, bold, accent }: { k: string; v: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`text-right ${bold ? "font-bold" : ""} ${accent ? "text-brand-700" : ""}`}>{v}</dd>
    </div>
  );
}

function Field(props: { label: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "tel" }) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>{props.label}</label>
      <input id={props.id} className="input" value={props.value} placeholder={props.placeholder} inputMode={props.inputMode} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

function LockOption({ active, disabled, onClick, title, note }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; note: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl p-3 text-left ring-1 disabled:opacity-40 ${active ? "bg-brand-50 ring-2 ring-brand-500" : "ring-slate-200"}`}>
      <span className="block text-sm font-semibold">{title}</span>
      <span className="text-xs text-slate-500">{note}</span>
    </button>
  );
}
