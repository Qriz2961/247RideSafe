"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import UnitPhoto from "@/components/UnitPhoto";
import { BUSINESS } from "@/lib/config";
import { dateOnly, dateTime, METHOD_LABEL, peso, prettyMobile, SERVICE_LABEL, STATUS_BAR, timeOnly } from "@/lib/format";
import { balanceLeft, checkUnit, isBusy, paidSoFar, refundFor } from "@/lib/logic";
import {
  addBlock, cancelWithRefund, collectBalance, declineCancel, reassignUnit, rejectPayment, removeBlock, resetDemo,
  sendReminder, setStatus, setUnitStatus, toggleCustomerFlag, useAppState, verifyPayment,
} from "@/lib/store";
import type { AppState, Booking, PaymentMethod } from "@/lib/types";

const TABS = ["Today", "Calendar", "Needs action", "Payments", "Units", "Customers", "Texts"] as const;
type Tab = (typeof TABS)[number];

const sameDay = (iso: string, d: Date) => {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
};
const dayStart = (offset: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

export default function OwnerDashboard() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>("Today");
  const [selected, setSelected] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!state) return <p className="p-6 text-slate-500">Loading…</p>;

  const needs = needsAction(state, now);
  const sel = state.bookings.find((b) => b.id === selected);

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Owner dashboard</p>
          <h1 className="text-2xl font-extrabold">Magandang araw, {BUSINESS.owner.split(" ")[0]}!</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/book?owner=1" className="btn-primary">+ Walk-in / Messenger booking</Link>
          <button className="btn-ghost" onClick={() => confirm("Reset all demo data?") && resetDemo()}>Reset demo</button>
        </div>
      </div>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Stage 2 demo: no log-in yet. Stage 4 locks this page to Nole&apos;s account.</p>

      <Kpis state={state} needsCount={needs.length} now={now} />

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-white shadow" : "text-slate-500"}`}>
              {t}
              {t === "Needs action" && needs.length > 0 && <span className="ml-1 rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{needs.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === "Today" && <TodayTab state={state} onOpen={setSelected} />}
      {tab === "Calendar" && <CalendarTab state={state} onOpen={setSelected} />}
      {tab === "Needs action" && <NeedsTab state={state} items={needs} onOpen={setSelected} now={now} />}
      {tab === "Payments" && <PaymentsTab state={state} onOpen={setSelected} />}
      {tab === "Units" && <UnitsTab state={state} />}
      {tab === "Customers" && <CustomersTab state={state} />}
      {tab === "Texts" && <TextsTab state={state} />}

      {sel && <BookingDrawer b={sel} state={state} onClose={() => setSelected(undefined)} now={now} />}
    </div>
  );
}

// ---------- KPIs ----------

function Kpis({ state, needsCount, now }: { state: AppState; needsCount: number; now: number }) {
  const today = dayStart(0);
  const pickups = state.bookings.filter((b) => sameDay(b.startAt, today) && isBusy(b, now));
  const returns = state.bookings.filter((b) => sameDay(b.endAt, today) && (b.status === "ONGOING" || b.status === "CONFIRMED"));
  const toCollect = [...pickups, ...returns.filter((b) => b.status === "ONGOING")].reduce((s, b) => s + balanceLeft(b), 0);
  const onRoad = state.bookings.filter((b) => b.status === "ONGOING").length;
  const tiles = [
    { k: "Pickups today", v: String(pickups.length) },
    { k: "Returns today", v: String(returns.length) },
    { k: "On the road", v: `${onRoad}/${state.units.filter((u) => u.status === "ACTIVE").length}` },
    { k: "To collect today", v: peso(toCollect) },
    { k: "Needs action", v: String(needsCount), alert: needsCount > 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.k} className={`card p-3 ${t.alert ? "ring-rose-300" : ""}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.k}</p>
          <p className={`mt-1 text-xl font-extrabold tabular-nums ${t.alert ? "text-rose-600" : ""}`}>{t.v}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- Today ----------

function TodayTab({ state, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  const days = [
    { label: "Today", d: dayStart(0) },
    { label: "Tomorrow", d: dayStart(1) },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {days.map(({ label, d }) => {
        const out = state.bookings.filter((b) => sameDay(b.startAt, d) && isBusy(b)).sort((a, b) => a.startAt.localeCompare(b.startAt));
        const back = state.bookings.filter((b) => sameDay(b.endAt, d) && (b.status === "ONGOING" || b.status === "CONFIRMED")).sort((a, b) => a.endAt.localeCompare(b.endAt));
        return (
          <section key={label} className="card min-w-0 p-4">
            <h2 className="font-bold">{label} <span className="font-normal text-slate-400">· {dateOnly(d.toISOString())}</span></h2>
            <h3 className="label mt-3">Going out ({out.length})</h3>
            {out.length === 0 && <p className="text-sm text-slate-400">None</p>}
            {out.map((b) => <MiniRow key={b.id} b={b} state={state} time={b.startAt} onOpen={onOpen} />)}
            <h3 className="label mt-4">Coming back ({back.length})</h3>
            {back.length === 0 && <p className="text-sm text-slate-400">None</p>}
            {back.map((b) => <MiniRow key={b.id} b={b} state={state} time={b.endAt} onOpen={onOpen} />)}
          </section>
        );
      })}
    </div>
  );
}

function MiniRow({ b, state, time, onOpen }: { b: Booking; state: AppState; time: string; onOpen: (id: string) => void }) {
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const u = state.units.find((x) => x.id === b.unitId)!;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
      <span className="w-16 shrink-0 text-sm font-bold tabular-nums">{timeOnly(time)}</span>
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(b.id)}>
        <span className="block truncate text-sm font-semibold">{c.fullName} · {u.name}</span>
        <span className="block truncate text-xs text-slate-500">{b.code} · {SERVICE_LABEL[b.serviceType]} · {b.pickupLocation}</span>
        {balanceLeft(b) > 0 && <span className="text-xs font-semibold text-orange-700">Collect {peso(balanceLeft(b))}</span>}
      </button>
      <a href={`tel:${c.mobile}`} className="btn-ghost btn-sm" aria-label={`Call ${c.fullName}`}>Call</a>
    </div>
  );
}

// ---------- Calendar ----------

function CalendarTab({ state, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => dayStart(i));
  const shown = state.bookings.filter((b) => isBusy(b) || b.status === "COMPLETED");
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-40 bg-white p-2 text-left">Unit</th>
              {days.map((d, i) => (
                <th key={i} className={`p-1 text-center font-semibold ${i === 0 ? "text-brand-700" : "text-slate-500"}`}>
                  {d.toLocaleDateString("en-PH", { weekday: "short" })}
                  <br />
                  {d.getDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.units.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white p-2">
                  <span className="block font-semibold">{u.name}</span>
                  <span className="text-slate-400">{u.plateNo}{u.status !== "ACTIVE" ? " · in shop" : ""}</span>
                </td>
                {days.map((d, i) => {
                  const end = new Date(d.getTime() + 86_400_000);
                  const inDay = (s: string, e: string) => Date.parse(s) < end.getTime() && Date.parse(e) > d.getTime();
                  const bk = shown.find((b) => b.unitId === u.id && inDay(b.startAt, b.endAt));
                  const blk = state.blocks.find((k) => k.unitId === u.id && inDay(k.startAt, k.endAt));
                  return (
                    <td key={i} className="h-11 border-l border-slate-100 p-0.5">
                      {bk ? (
                        <button onClick={() => onOpen(bk.id)} title={`${bk.code} · ${bk.status}`} className={`h-full w-full rounded-md px-1 text-[10px] font-bold text-white ${STATUS_BAR[bk.status]}`}>
                          {sameDay(bk.startAt, d) || i === 0 ? bk.code.slice(4) : ""}
                        </button>
                      ) : blk || u.status !== "ACTIVE" ? (
                        <div title={blk?.reason ?? "In the shop"} className="h-full w-full rounded-md bg-[repeating-linear-gradient(45deg,#e2e8f0_0_4px,#f8fafc_4px_8px)]" />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-slate-100 p-3 text-xs text-slate-500">
        {(["HELD", "PENDING_VERIFICATION", "CONFIRMED", "ONGOING", "COMPLETED"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${STATUS_BAR[s]}`} />{s.replace("_", " ").toLowerCase()}</span>
        ))}
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-[repeating-linear-gradient(45deg,#cbd5e1_0_2px,#f8fafc_2px_4px)]" />blocked / PMS</span>
      </div>
    </div>
  );
}

// ---------- Needs action ----------

type NeedItem = { b: Booking; kind: "VERIFY" | "CANCEL" | "HOLD" | "REFUND" };

function needsAction(state: AppState, now: number): NeedItem[] {
  const items: NeedItem[] = [];
  for (const b of state.bookings) {
    if (b.status === "PENDING_VERIFICATION") items.push({ b, kind: "VERIFY" });
    if (b.cancelRequested) items.push({ b, kind: "CANCEL" });
    if (b.status === "HELD" && b.holdExpiresAt && Date.parse(b.holdExpiresAt) > now) items.push({ b, kind: "HOLD" });
    if (b.payments.some((p) => p.kind === "REFUND" && p.status === "PENDING")) items.push({ b, kind: "REFUND" });
  }
  return items;
}

function NeedsTab({ state, items, onOpen, now }: { state: AppState; items: NeedItem[]; onOpen: (id: string) => void; now: number }) {
  if (items.length === 0) return <div className="card p-8 text-center text-slate-500">All clear. Nothing waiting on you. 🎉</div>;
  return (
    <div className="space-y-3">
      {items.map(({ b, kind }) => {
        const c = state.customers.find((x) => x.id === b.customerId)!;
        const p = b.payments.find((x) => x.status === "PENDING" && x.kind === "DEPOSIT");
        const r = b.payments.find((x) => x.status === "PENDING" && x.kind === "REFUND");
        const refund = refundFor(b, now);
        return (
          <div key={`${b.id}-${kind}`} className="card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-600">
                {kind === "VERIFY" && "Check payment"}
                {kind === "CANCEL" && "Cancellation request"}
                {kind === "HOLD" && "On hold, waiting for deposit"}
                {kind === "REFUND" && "Refund to send"}
              </p>
              <button className="text-left" onClick={() => onOpen(b.id)}>
                <span className="font-semibold">{b.code} · {c.fullName}</span>
                <span className="block text-sm text-slate-500">{dateTime(b.startAt)} · {prettyMobile(c.mobile)}</span>
              </button>
              {kind === "VERIFY" && p && (
                <p className="mt-1 text-sm">
                  {peso(p.amount)} via {METHOD_LABEL[p.method]} · Ref <span className="font-mono font-semibold">{p.referenceNo}</span>
                  {p.proofFileName && <span className="text-slate-400"> · 📎 {p.proofFileName}</span>}
                </p>
              )}
              {kind === "VERIFY" && <p className="mt-1 text-xs text-slate-500">Open your GCash/bank app and find this reference number before you tap Verify.</p>}
              {kind === "CANCEL" && <p className="mt-1 text-sm">Policy: {refund.pct}% of deposit back → <b>{peso(refund.amount)}</b> ({Math.max(0, refund.hoursBefore)} hrs before pickup)</p>}
              {kind === "HOLD" && b.holdExpiresAt && <p className="mt-1 text-sm">Hold ends {timeOnly(b.holdExpiresAt)}. Deposit {peso(b.depositDue)}.</p>}
              {kind === "REFUND" && r && <p className="mt-1 text-sm">Send <b>{peso(r.amount)}</b> to GCash {prettyMobile(c.mobile)}</p>}
            </div>
            <div className="flex gap-2">
              {kind === "VERIFY" && p && (
                <>
                  <button className="btn-primary btn-sm" onClick={() => verifyPayment(b.id, p.id)}>Verify</button>
                  <button className="btn-ghost btn-sm" onClick={() => rejectPayment(b.id, p.id)}>Not found</button>
                </>
              )}
              {kind === "CANCEL" && (
                <>
                  <button className="btn-sm btn bg-rose-600 text-white" onClick={() => cancelWithRefund(b.id, refund.amount)}>Approve</button>
                  <button className="btn-ghost btn-sm" onClick={() => declineCancel(b.id)}>Decline</button>
                </>
              )}
              {kind === "REFUND" && r && <button className="btn-primary btn-sm" onClick={() => verifyPayment(b.id, r.id)}>Mark sent</button>}
              {kind === "HOLD" && <a className="btn-ghost btn-sm" href={`tel:${c.mobile}`}>Call</a>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Payments ----------

function PaymentsTab({ state, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  const all = state.bookings.flatMap((b) => b.payments.map((p) => ({ p, b })));
  const verified = all.filter((x) => x.p.status === "VERIFIED");
  const sum = (xs: typeof all) => xs.reduce((s, x) => s + x.p.amount, 0);
  const byMethod = (["GCASH_PAYMONGO", "GCASH_MANUAL", "BANK", "COD"] as PaymentMethod[]).map((m) => ({
    m,
    amt: sum(verified.filter((x) => x.p.method === m && x.p.kind !== "REFUND")),
  }));
  const due = state.bookings.filter((b) => (b.status === "CONFIRMED" || b.status === "ONGOING") && balanceLeft(b) > 0);
  const totalIn = sum(verified.filter((x) => x.p.kind !== "REFUND"));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card min-w-0 p-4">
        <h2 className="font-bold">Money in</h2>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">{peso(totalIn)}</p>
        <p className="text-xs text-slate-500">Deposits {peso(sum(verified.filter((x) => x.p.kind === "DEPOSIT")))} · Balances {peso(sum(verified.filter((x) => x.p.kind === "BALANCE")))} · Refunds sent {peso(sum(verified.filter((x) => x.p.kind === "REFUND")))}</p>
        <div className="mt-4 space-y-2">
          {byMethod.map(({ m, amt }) => (
            <div key={m}>
              <div className="flex justify-between text-sm"><span>{METHOD_LABEL[m]}</span><span className="font-semibold tabular-nums">{peso(amt)}</span></div>
              <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${totalIn ? (amt / totalIn) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </div>
      </section>
      <section className="card min-w-0 p-4">
        <h2 className="font-bold">Balances still to collect</h2>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-orange-700">{peso(due.reduce((s, b) => s + balanceLeft(b), 0))}</p>
        <div className="mt-3 divide-y divide-slate-100">
          {due.map((b) => (
            <button key={b.id} onClick={() => onOpen(b.id)} className="flex w-full justify-between py-2 text-left text-sm">
              <span><b className="font-mono">{b.code}</b> · {dateOnly(b.startAt)}</span>
              <span className="font-semibold tabular-nums">{peso(balanceLeft(b))}</span>
            </button>
          ))}
          {due.length === 0 && <p className="py-2 text-sm text-slate-400">Nothing outstanding.</p>}
        </div>
      </section>
      <section className="card min-w-0 p-4 md:col-span-2">
        <h2 className="font-bold">All payments</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Booking</th><th>Kind</th><th>Method</th><th>Ref</th><th className="text-right">Amount</th><th className="text-right">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {all.sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt)).map(({ p, b }) => (
                <tr key={p.id}>
                  <td className="py-1.5"><button className="font-mono font-semibold text-brand-700" onClick={() => onOpen(b.id)}>{b.code}</button></td>
                  <td>{p.kind.toLowerCase()}</td>
                  <td>{METHOD_LABEL[p.method]}</td>
                  <td className="font-mono text-xs">{p.referenceNo ?? "—"}</td>
                  <td className="text-right tabular-nums">{p.kind === "REFUND" ? "−" : ""}{peso(p.amount)}</td>
                  <td className={`text-right text-xs font-semibold ${p.status === "VERIFIED" ? "text-emerald-700" : "text-orange-700"}`}>{p.status === "VERIFIED" ? "OK" : "pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------- Units ----------

function UnitsTab({ state }: { state: AppState }) {
  const [form, setForm] = useState({ unitId: state.units[0]?.id ?? "", start: "", end: "", reason: "PMS / casa service" });
  const ok = form.unitId && form.start && form.end && form.end > form.start;
  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <h2 className="font-bold">Block dates (PMS, repair, personal use)</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <select className="input" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
            {state.units.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.plateNo}</option>)}
          </select>
          <input type="datetime-local" className="input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-label="Block start" />
          <input type="datetime-local" className="input" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-label="Block end" />
          <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} aria-label="Reason" />
        </div>
        <button className="btn-dark" disabled={!ok} onClick={() => { addBlock(form.unitId, new Date(form.start).toISOString(), new Date(form.end).toISOString(), form.reason); setForm({ ...form, start: "", end: "" }); }}>
          Block these dates
        </button>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {state.units.map((u) => {
          const blocks = state.blocks.filter((k) => k.unitId === u.id);
          return (
            <div key={u.id} className="card p-4">
              <div className="flex gap-3">
                <UnitPhoto unit={u} className="h-16 w-28 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.plateNo} · {u.type} · {u.seats} seats · {u.transmission}</p>
                  <p className="text-xs text-slate-500">
                    {u.selfDriveAllowed ? `Self-drive ${peso(u.dailyRate)} · ` : "Driver only · "}With driver {peso(u.withDriverRate)}
                  </p>
                </div>
              </div>
              <label className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{u.status === "ACTIVE" ? "Available for booking" : "In the shop – hidden from booking"}</span>
                <input type="checkbox" checked={u.status === "ACTIVE"} onChange={(e) => setUnitStatus(u.id, e.target.checked ? "ACTIVE" : "MAINTENANCE")} />
              </label>
              {blocks.map((k) => (
                <div key={k.id} className="mt-2 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-xs">
                  <span>{dateTime(k.startAt)} → {dateTime(k.endAt)} · {k.reason}</span>
                  <button className="text-rose-600" onClick={() => removeBlock(k.id)}>Remove</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Customers ----------

function CustomersTab({ state }: { state: AppState }) {
  return (
    <div className="card overflow-x-auto p-4">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr><th className="py-1">Name</th><th>Mobile</th><th className="text-right">Bookings</th><th className="text-right">Paid</th><th className="text-center">Trusted</th><th className="text-center">Do not rent</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {state.customers.map((c) => {
            const bs = state.bookings.filter((b) => b.customerId === c.id);
            return (
              <tr key={c.id}>
                <td className="py-2 font-semibold">{c.fullName}<span className="block text-xs font-normal text-slate-400">{c.email ?? ""}</span></td>
                <td><a className="text-brand-700" href={`tel:${c.mobile}`}>{prettyMobile(c.mobile)}</a></td>
                <td className="text-right tabular-nums">{bs.length}</td>
                <td className="text-right tabular-nums">{peso(bs.reduce((s, b) => s + paidSoFar(b), 0))}</td>
                <td className="text-center"><input type="checkbox" aria-label="Trusted" checked={c.isTrusted} onChange={() => toggleCustomerFlag(c.id, "isTrusted")} /></td>
                <td className="text-center"><input type="checkbox" aria-label="Do not rent" checked={c.isBlocked} onChange={() => toggleCustomerFlag(c.id, "isBlocked")} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">Trusted customers can book with the signed agreement only (no deposit). &quot;Do not rent&quot; blocks online booking for that number.</p>
    </div>
  );
}

// ---------- Texts ----------

function TextsTab({ state }: { state: AppState }) {
  return (
    <div className="card divide-y divide-slate-100 p-2">
      {state.smsLog.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No texts yet. Make a booking to see them here.</p>}
      {state.smsLog.map((m) => (
        <div key={m.id} className="p-3 text-sm">
          <div className="flex justify-between text-xs text-slate-500">
            <span>To {m.to.startsWith("09") ? prettyMobile(m.to) : m.to} · {m.template}</span>
            <span>{dateTime(m.at)}</span>
          </div>
          <p className="mt-1">{m.body}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{m.body.length} chars{m.body.length > 160 ? " · 2 messages" : ""} · simulated</p>
        </div>
      ))}
    </div>
  );
}

// ---------- Booking drawer ----------

function BookingDrawer({ b, state, onClose, now }: { b: Booking; state: AppState; onClose: () => void; now: number }) {
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const u = state.units.find((x) => x.id === b.unitId)!;
  const tour = state.tours.find((t) => t.id === b.tourId);
  const [method, setMethod] = useState<PaymentMethod>("COD");
  const [msg, setMsg] = useState<string>();
  const left = balanceLeft(b);
  const freeUnits = state.units.filter((x) => x.id !== b.unitId && checkUnit(state, x, b.startAt, b.endAt, { serviceType: b.serviceType, pax: b.pax, ignoreBookingId: b.id }).ok);
  const refund = refundFor(b, now);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-lg font-bold text-brand-700">{b.code}</p>
            <StatusBadge status={b.status} />
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <dl className="mt-4 space-y-1 text-sm">
          <Item k="Customer" v={<>{c.fullName} · <a className="text-brand-700" href={`tel:${c.mobile}`}>{prettyMobile(c.mobile)}</a>{c.isTrusted && " · ⭐ trusted"}</>} />
          <Item k="Service" v={tour ? tour.name : SERVICE_LABEL[b.serviceType]} />
          <Item k="Unit" v={`${u.name} · ${u.plateNo}`} />
          <Item k="Pickup" v={`${dateTime(b.startAt)} · ${b.pickupLocation}`} />
          <Item k="Return" v={dateTime(b.endAt)} />
          <Item k="Pax" v={String(b.pax)} />
          {c.licenseNo && <Item k="License" v={c.licenseNo} />}
          <Item k="Total" v={peso(b.total)} />
          <Item k="Paid" v={peso(paidSoFar(b))} />
          <Item k="Balance" v={<b className={left > 0 ? "text-orange-700" : ""}>{peso(left)}</b>} />
          {b.securityDeposit > 0 && <Item k="Security dep." v={`${peso(b.securityDeposit)} (refundable, collect at pickup)`} />}
          {b.agreement && <Item k="Agreement" v={`Signed by ${b.agreement.signedName}, ${dateTime(b.agreement.signedAt)}`} />}
        </dl>

        {msg && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{msg}</p>}

        <div className="mt-5 space-y-3">
          {b.status === "PENDING_VERIFICATION" && b.payments.filter((p) => p.status === "PENDING").map((p) => (
            <div key={p.id} className="rounded-xl bg-orange-50 p-3 text-sm">
              <p>{peso(p.amount)} · {METHOD_LABEL[p.method]} · Ref <b className="font-mono">{p.referenceNo}</b></p>
              <div className="mt-2 flex gap-2">
                <button className="btn-primary btn-sm" onClick={() => verifyPayment(b.id, p.id)}>Verify</button>
                <button className="btn-ghost btn-sm" onClick={() => rejectPayment(b.id, p.id)}>Not found</button>
              </div>
            </div>
          ))}

          {(b.status === "CONFIRMED" || b.status === "ONGOING") && left > 0 && (
            <div className="flex gap-2">
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(["COD", "GCASH_MANUAL", "BANK"] as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
              </select>
              <button className="btn-dark whitespace-nowrap" onClick={() => collectBalance(b.id, method)}>Collected {peso(left)}</button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {b.status === "CONFIRMED" && <button className="btn-primary btn-sm" onClick={() => setStatus(b.id, "ONGOING", "OWNER", "Picked up")}>Mark picked up</button>}
            {b.status === "ONGOING" && <button className="btn-primary btn-sm" onClick={() => setStatus(b.id, "COMPLETED", "OWNER", "Returned")}>Mark returned</button>}
            {b.status === "CONFIRMED" && <button className="btn-ghost btn-sm" onClick={() => sendReminder(b.id)}>Send reminder text</button>}
            {b.status === "CONFIRMED" && <button className="btn-ghost btn-sm" onClick={() => setStatus(b.id, "NO_SHOW", "OWNER")}>No-show</button>}
            {["HELD", "PENDING_VERIFICATION", "CONFIRMED"].includes(b.status) && (
              <button className="btn-ghost btn-sm text-rose-600" onClick={() => confirm(`Cancel ${b.code}? Policy refund: ${peso(refund.amount)}`) && cancelWithRefund(b.id, refund.amount)}>Cancel booking</button>
            )}
          </div>

          {["HELD", "PENDING_VERIFICATION", "CONFIRMED"].includes(b.status) && (
            <div>
              <label className="label" htmlFor="ru">Change unit (free ones only)</label>
              <select id="ru" className="input" value="" onChange={(e) => { const r = reassignUnit(b.id, e.target.value); setMsg(r.ok ? undefined : r.error); }}>
                <option value="">{freeUnits.length ? "Pick a unit…" : "No other unit is free"}</option>
                {freeUnits.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.plateNo}</option>)}
              </select>
            </div>
          )}
        </div>

        <h3 className="label mt-6">History</h3>
        <ol className="space-y-1 border-l-2 border-slate-200 pl-3 text-xs">
          {[...b.events].reverse().map((e, i) => (
            <li key={i}>
              <span className="font-semibold">{e.to === "NOTE" ? "Note" : e.to.replace("_", " ").toLowerCase()}</span>
              <span className="text-slate-500"> · {e.by.toLowerCase()} · {dateTime(e.at)}</span>
              {e.note && <span className="block text-slate-600">{e.note}</span>}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-500">{k}</dt>
      <dd className="min-w-0 flex-1">{v}</dd>
    </div>
  );
}
