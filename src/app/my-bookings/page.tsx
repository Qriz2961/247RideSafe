"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AgreementText from "@/components/AgreementText";
import PaymentPanel from "@/components/PaymentPanel";
import StatusBadge from "@/components/StatusBadge";
import UnitPhoto from "@/components/UnitPhoto";
import { dateTime, METHOD_LABEL, peso, prettyMobile, SERVICE_LABEL } from "@/lib/format";
import { balanceLeft, normalizeMobile, paidSoFar, refundFor } from "@/lib/logic";
import { requestCancel, useAppState } from "@/lib/store";
import type { AppState, Booking } from "@/lib/types";

const SESSION_KEY = "b247-mobile";
const TEST_CODE = "123456"; // Stage 4 replaces this with a real SMS one-time code (Supabase Auth).

export default function MyBookingsPage() {
  const state = useAppState();
  const [mobile, setMobile] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setMobile(sessionStorage.getItem(SESSION_KEY));
    } catch {}
    setReady(true);
  }, []);

  if (!state || !ready) return <p className="p-6 text-slate-500">Loading…</p>;
  if (!mobile) return <SignIn onDone={(m) => { try { sessionStorage.setItem(SESSION_KEY, m); } catch {} setMobile(m); }} />;

  const customer = state.customers.find((c) => c.mobile === mobile);
  const mine = state.bookings
    .filter((b) => b.customerId === customer?.id)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const now = Date.now();
  const upcoming = mine.filter((b) => ["HELD", "PENDING_VERIFICATION", "CONFIRMED", "ONGOING"].includes(b.status));
  const past = mine.filter((b) => !upcoming.includes(b)).reverse();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">My bookings</h1>
          <p className="text-sm text-slate-500">{customer ? `${customer.fullName} · ` : ""}{prettyMobile(mobile)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/book" className="btn-primary">New booking</Link>
          <button className="btn-ghost" onClick={() => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} setMobile(null); }}>Sign out</button>
        </div>
      </div>

      {mine.length === 0 && (
        <div className="card p-8 text-center text-slate-500">
          No bookings under this number yet. <Link href="/book" className="font-semibold text-brand-700">Book one now</Link>.
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="label">Upcoming</h2>
          {upcoming.map((b) => <BookingCard key={b.id} b={b} state={state} now={now} />)}
        </section>
      )}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="label">Past & cancelled</h2>
          {past.map((b) => <BookingCard key={b.id} b={b} state={state} now={now} />)}
        </section>
      )}
    </div>
  );
}

function SignIn({ onDone }: { onDone: (mobile: string) => void }) {
  const [raw, setRaw] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string>();
  const m = normalizeMobile(raw);

  return (
    <div className="mx-auto max-w-sm">
      <div className="card space-y-4 p-6">
        <div>
          <h1 className="text-xl font-extrabold">My bookings</h1>
          <p className="text-sm text-slate-500">Sign in with the mobile number you booked with. We&apos;ll text you a 6-digit code. No password needed.</p>
        </div>
        <div>
          <label className="label" htmlFor="m">Mobile number</label>
          <input id="m" className="input" inputMode="tel" placeholder="0917 123 4567" value={raw} disabled={sent} onChange={(e) => setRaw(e.target.value)} />
        </div>
        {!sent ? (
          <button className="btn-primary w-full" disabled={!m} onClick={() => setSent(true)}>Text me a code</button>
        ) : (
          <>
            <div className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">Demo: no real SMS is sent. Use code <b className="font-mono">{TEST_CODE}</b>.</div>
            <div>
              <label className="label" htmlFor="c">6-digit code</label>
              <input id="c" className="input text-center font-mono text-lg tracking-[0.5em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button
              className="btn-primary w-full"
              disabled={code.length !== 6}
              onClick={() => (code === TEST_CODE && m ? onDone(m) : setErr("Wrong code. Try again."))}
            >
              Sign in
            </button>
            <button className="w-full text-xs text-slate-500" onClick={() => { setSent(false); setCode(""); setErr(undefined); }}>Use a different number</button>
          </>
        )}
        <p className="text-center text-xs text-slate-400">Try 0917 123 4567 to see sample bookings.</p>
      </div>
    </div>
  );
}

function BookingCard({ b, state, now }: { b: Booking; state: AppState; now: number }) {
  const [open, setOpen] = useState<null | "pay" | "agreement" | "cancel">(null);
  const unit = state.units.find((u) => u.id === b.unitId)!;
  const tour = state.tours.find((t) => t.id === b.tourId);
  const refund = refundFor(b, now);
  const pending = b.payments.find((p) => p.status === "PENDING" && p.kind === "DEPOSIT");
  const canCancel = ["HELD", "PENDING_VERIFICATION", "CONFIRMED"].includes(b.status) && !b.cancelRequested;

  return (
    <article className="card overflow-hidden">
      <div className="flex gap-4 p-4">
        <UnitPhoto unit={unit} className="hidden h-20 w-32 shrink-0 sm:block" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-brand-700">{b.code}</span>
            <StatusBadge status={b.status} />
            {b.cancelRequested && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">Cancellation requested</span>}
          </div>
          <p className="font-semibold">{tour ? tour.name : `${SERVICE_LABEL[b.serviceType]} · ${unit.name}`}</p>
          <p className="text-sm text-slate-600">{dateTime(b.startAt)} → {dateTime(b.endAt)}</p>
          <p className="text-sm text-slate-500">{unit.name} · {unit.plateNo} · {b.pickupLocation}</p>
          <p className="text-sm">
            Paid <b>{peso(paidSoFar(b))}</b> of {peso(b.total)}
            {balanceLeft(b) > 0 && <> · Balance <b>{peso(balanceLeft(b))}</b> at pickup</>}
            {pending && <span className="text-orange-700"> · {peso(pending.amount)} via {METHOD_LABEL[pending.method]} being checked</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2">
        {b.status === "HELD" && <button className="btn-primary btn-sm" onClick={() => setOpen(open === "pay" ? null : "pay")}>Pay deposit</button>}
        {b.agreement && <button className="btn-ghost btn-sm" onClick={() => setOpen(open === "agreement" ? null : "agreement")}>Agreement</button>}
        {canCancel && <button className="btn-ghost btn-sm" onClick={() => setOpen(open === "cancel" ? null : "cancel")}>Cancel</button>}
        <a className="btn-ghost btn-sm" href="https://m.me/" target="_blank" rel="noreferrer">Message Nole</a>
      </div>

      {open === "pay" && b.status === "HELD" && <div className="border-t border-slate-100 p-4"><PaymentPanel booking={b} /></div>}
      {open === "agreement" && b.agreement && (
        <div className="space-y-2 border-t border-slate-100 p-4">
          <AgreementText />
          <p className="text-xs text-slate-500">Signed by <b>{b.agreement.signedName}</b> on {dateTime(b.agreement.signedAt)} · {b.agreement.version}</p>
        </div>
      )}
      {open === "cancel" && canCancel && (
        <div className="space-y-3 border-t border-slate-100 p-4 text-sm">
          <p>
            Pickup is in <b>{Math.max(0, refund.hoursBefore)} hrs</b>. Under our policy you get <b>{refund.pct}%</b> of your deposit back
            {refund.amount > 0 ? <> (<b>{peso(refund.amount)}</b>)</> : null}. Nole will confirm.
          </p>
          <div className="flex gap-2">
            <button className="btn-sm btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => { requestCancel(b.id); setOpen(null); }}>Request cancellation</button>
            <button className="btn-ghost btn-sm" onClick={() => setOpen(null)}>Keep booking</button>
          </div>
        </div>
      )}
    </article>
  );
}
