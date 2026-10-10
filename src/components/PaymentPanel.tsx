"use client";

import { useEffect, useState } from "react";
import { BUSINESS } from "@/lib/config";
import { peso } from "@/lib/format";
import { payDepositTestMode, submitManualProof } from "@/lib/store";
import type { Booking } from "@/lib/types";

export function HoldTimer({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Date.parse(until) - now);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${left < 5 * 60000 ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>
      <span>We&apos;re holding this unit for you. Pay the deposit before the timer runs out.</span>
      <span className="ml-3 font-mono text-lg font-bold tabular-nums">{mm}:{ss}</span>
    </div>
  );
}

/** Deposit step for a HELD booking. */
export default function PaymentPanel({ booking }: { booking: Booking }) {
  const [tab, setTab] = useState<"GCASH_PAYMONGO" | "MANUAL">(booking.lockIn === "MANUAL" ? "MANUAL" : "GCASH_PAYMONGO");
  const [checkout, setCheckout] = useState(false);
  const [method, setMethod] = useState<"GCASH_MANUAL" | "BANK">("GCASH_MANUAL");
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<string>();

  const refOk = ref.replace(/\s/g, "").length >= 6;

  return (
    <div className="space-y-4">
      {booking.holdExpiresAt && <HoldTimer until={booking.holdExpiresAt} />}

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        <button onClick={() => setTab("GCASH_PAYMONGO")} className={`rounded-lg py-2 ${tab === "GCASH_PAYMONGO" ? "bg-white shadow" : "text-slate-500"}`}>
          GCash / QR Ph <span className="block text-[11px] font-normal text-slate-500">confirmed instantly</span>
        </button>
        <button onClick={() => setTab("MANUAL")} className={`rounded-lg py-2 ${tab === "MANUAL" ? "bg-white shadow" : "text-slate-500"}`}>
          Send-money / Bank <span className="block text-[11px] font-normal text-slate-500">we check within 1 hr</span>
        </button>
      </div>

      {tab === "GCASH_PAYMONGO" && !checkout && (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            You&apos;ll go to a secure PayMongo checkout page to pay <b>{peso(booking.depositDue)}</b> by GCash, Maya or QR Ph. Your booking confirms as soon as it goes through.
          </p>
          <button className="btn-primary w-full" onClick={() => setCheckout(true)}>Pay {peso(booking.depositDue)} deposit</button>
        </div>
      )}

      {tab === "GCASH_PAYMONGO" && checkout && (
        // Stage 5 replaces this box with a redirect to PayMongo's hosted checkout.
        <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-4 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">PayMongo checkout · TEST MODE</p>
          <p className="mt-2">Amount: <b>{peso(booking.depositDue)}</b> · Ref {booking.code}</p>
          <p className="mt-1 text-slate-600">No real money moves in this demo.</p>
          <div className="mt-3 flex gap-2">
            <button className="btn-dark flex-1" onClick={() => payDepositTestMode(booking.id)}>Simulate successful payment</button>
            <button className="btn-ghost" onClick={() => setCheckout(false)}>Back</button>
          </div>
        </div>
      )}

      {tab === "MANUAL" && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {(["GCASH_MANUAL", "BANK"] as const).map((m) => (
              <label key={m} className={`cursor-pointer rounded-xl p-3 ring-1 ${method === m ? "bg-brand-50 ring-brand-500" : "ring-slate-200"}`}>
                <input type="radio" className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                <span className="font-semibold">{m === "BANK" ? "Bank / InstaPay" : "GCash send-money"}</span>
              </label>
            ))}
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-slate-500">Send exactly <b className="text-slate-900">{peso(booking.depositDue)}</b> to:</p>
            {method === "GCASH_MANUAL" ? (
              <p className="mt-1 font-semibold">GCash {BUSINESS.gcashNumber} · {BUSINESS.gcashName}</p>
            ) : (
              <p className="mt-1 font-semibold">{BUSINESS.bankName} {BUSINESS.bankAccountNo} · {BUSINESS.bankAccountName}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">Put <b>{booking.code}</b> in the message/notes.</p>
          </div>
          <div>
            <label className="label" htmlFor="ref">Reference number</label>
            <input id="ref" className="input font-mono" placeholder="e.g. 5012 334 889201" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="proof">Screenshot of receipt</label>
            <input id="proof" type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0]?.name)} />
          </div>
          <button className="btn-primary w-full" disabled={!refOk} onClick={() => submitManualProof(booking.id, method, ref.trim(), file)}>
            Submit payment proof
          </button>
          <p className="text-xs text-slate-500">Nole matches your reference number against the GCash or bank app before confirming. You&apos;ll get a text once it&apos;s done.</p>
        </div>
      )}
    </div>
  );
}
