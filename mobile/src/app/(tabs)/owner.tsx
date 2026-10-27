import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { DateChips, TimeChips } from "../../components/booking";
import { Banner, Btn, Card, Check, ErrorText, Field, H1, H2, Label, Muted, Row, Screen, Segments, STATUS_BAR_COLOR } from "../../components/ui";
import { addDays, toIso } from "../../lib/dates";
import {
  balanceLeft, BUSINESS, dateOnly, dateTime, isBusy, METHOD_LABEL, peso, prettyMobile, refundFor, SERVICE_LABEL, timeOnly,
  type AppState, type Booking, type PaymentMethod,
} from "../../lib/shared";
import {
  addBlock, cancelWithRefund, declineCancel, rejectPayment, removeBlock, resetDemo, setUnitStatus, toggleCustomerFlag, useAppState, verifyPayment,
} from "../../lib/store";
import { C, OWNER_DEMO_PIN } from "../../lib/theme";

const TABS = ["Today", "Needs action", "Calendar", "Payments", "Units", "Customers", "Texts"] as const;
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

export default function Owner() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  if (!unlocked) {
    return (
      <Screen>
        <Card>
          <H1>Owner access</H1>
          <Muted>For {BUSINESS.owner} only.</Muted>
          <Banner tone="warn">Demo PIN is {OWNER_DEMO_PIN}. Stage 4 replaces this with Nole's own log-in, and the public app store build should hide this tab completely.</Banner>
          <Field label="PIN" keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={setPin} />
          <Btn title="Open dashboard" disabled={pin.length !== 4} onPress={() => (pin === OWNER_DEMO_PIN ? setUnlocked(true) : Alert.alert("Wrong PIN"))} />
        </Card>
      </Screen>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const state = useAppState()!;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Today");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const needs = needsAction(state, now);
  const open = (id: string) => router.push({ pathname: "/booking/[id]", params: { id, owner: "1" } });

  return (
    <Screen>
      <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 1 }}>OWNER DASHBOARD</Text>
      <H1>Magandang araw, {BUSINESS.owner.split(" ")[0]}!</H1>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn flex title="+ Walk-in / Messenger" onPress={() => router.navigate({ pathname: "/book", params: { owner: "1", t: String(Date.now()) } })} />
        <Btn kind="ghost" title="Reset demo" onPress={() => Alert.alert("Reset all demo data?", "", [{ text: "Cancel", style: "cancel" }, { text: "Reset", style: "destructive", onPress: () => resetDemo() }])} />
      </View>

      <Kpis state={state} needsCount={needs.length} now={now} />
      <Segments items={TABS} value={tab} onChange={setTab} badge={{ "Needs action": needs.length }} />

      {tab === "Today" && <TodayTab state={state} onOpen={open} />}
      {tab === "Needs action" && <NeedsTab state={state} items={needs} onOpen={open} now={now} />}
      {tab === "Calendar" && <CalendarTab state={state} onOpen={open} />}
      {tab === "Payments" && <PaymentsTab state={state} onOpen={open} />}
      {tab === "Units" && <UnitsTab state={state} />}
      {tab === "Customers" && <CustomersTab state={state} />}
      {tab === "Texts" && <TextsTab state={state} />}
    </Screen>
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
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {tiles.map((t) => (
        <View key={t.k} style={{ width: "48.5%", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted }}>{t.k.toUpperCase()}</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{t.v}</Text>
        </View>
      ))}
      {needsCount > 0 && <Banner tone="danger">{needsCount} item{needsCount > 1 ? "s" : ""} waiting on you. Open "Needs action".</Banner>}
    </View>
  );
}

// ---------- Today ----------

function TodayTab({ state, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  return (
    <>
      {[{ label: "Today", d: dayStart(0) }, { label: "Tomorrow", d: dayStart(1) }].map(({ label, d }) => {
        const out = state.bookings.filter((b) => sameDay(b.startAt, d) && isBusy(b)).sort((a, b) => a.startAt.localeCompare(b.startAt));
        const back = state.bookings.filter((b) => sameDay(b.endAt, d) && (b.status === "ONGOING" || b.status === "CONFIRMED")).sort((a, b) => a.endAt.localeCompare(b.endAt));
        return (
          <Card key={label}>
            <H2>{label} <Text style={{ fontWeight: "400", color: "#94a3b8" }}>· {dateOnly(d.toISOString())}</Text></H2>
            <Label>Going out ({out.length})</Label>
            {out.length === 0 && <Muted>None</Muted>}
            {out.map((b) => <MiniRow key={b.id} b={b} state={state} time={b.startAt} onOpen={onOpen} />)}
            <Label>Coming back ({back.length})</Label>
            {back.length === 0 && <Muted>None</Muted>}
            {back.map((b) => <MiniRow key={b.id} b={b} state={state} time={b.endAt} onOpen={onOpen} />)}
          </Card>
        );
      })}
    </>
  );
}

function MiniRow({ b, state, time, onOpen }: { b: Booking; state: AppState; time: string; onOpen: (id: string) => void }) {
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const u = state.units.find((x) => x.id === b.unitId)!;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f8fafc", borderRadius: 12, padding: 10 }}>
      <Text style={{ width: 62, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{timeOnly(time)}</Text>
      <Pressable style={{ flex: 1 }} onPress={() => onOpen(b.id)}>
        <Text numberOfLines={1} style={{ fontWeight: "700" }}>{c.fullName} · {u.name}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{b.code} · {SERVICE_LABEL[b.serviceType]} · {b.pickupLocation}</Text>
        {balanceLeft(b) > 0 && <Text style={{ fontSize: 12, fontWeight: "700", color: "#c2410c" }}>Collect {peso(balanceLeft(b))}</Text>}
      </Pressable>
      <Btn small kind="ghost" title="Call" onPress={() => Linking.openURL(`tel:${c.mobile}`)} />
    </View>
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

const NEED_TITLE: Record<NeedItem["kind"], string> = {
  VERIFY: "Check payment",
  CANCEL: "Cancellation request",
  HOLD: "On hold, waiting for deposit",
  REFUND: "Refund to send",
};

function NeedsTab({ state, items, onOpen, now }: { state: AppState; items: NeedItem[]; onOpen: (id: string) => void; now: number }) {
  if (items.length === 0) return <Card><Muted>All clear. Nothing waiting on you. 🎉</Muted></Card>;
  return (
    <>
      {items.map(({ b, kind }) => {
        const c = state.customers.find((x) => x.id === b.customerId)!;
        const p = b.payments.find((x) => x.status === "PENDING" && x.kind === "DEPOSIT");
        const r = b.payments.find((x) => x.status === "PENDING" && x.kind === "REFUND");
        const refund = refundFor(b, now);
        return (
          <Card key={`${b.id}-${kind}`}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: C.danger, letterSpacing: 0.5 }}>{NEED_TITLE[kind].toUpperCase()}</Text>
            <Pressable onPress={() => onOpen(b.id)}>
              <Text style={{ fontWeight: "700" }}>{b.code} · {c.fullName}</Text>
              <Muted small>{dateTime(b.startAt)} · {prettyMobile(c.mobile)}</Muted>
            </Pressable>
            {kind === "VERIFY" && p && (
              <>
                <Text>{peso(p.amount)} via {METHOD_LABEL[p.method]} · Ref <Text selectable style={{ fontWeight: "800" }}>{p.referenceNo}</Text>{p.proofFileName ? ` · 📎 ${p.proofFileName}` : ""}</Text>
                <Muted small>Open your GCash/bank app and find this reference number before you tap Verify. Edited screenshots are common.</Muted>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn small flex title="Verify" onPress={() => verifyPayment(b.id, p.id)} />
                  <Btn small kind="ghost" title="Not found" onPress={() => rejectPayment(b.id, p.id)} />
                </View>
              </>
            )}
            {kind === "CANCEL" && (
              <>
                <Text>Policy: {refund.pct}% of deposit back → <Text style={{ fontWeight: "800" }}>{peso(refund.amount)}</Text> ({Math.max(0, refund.hoursBefore)} hrs before pickup)</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn small flex kind="danger" title="Approve" onPress={() => cancelWithRefund(b.id, refund.amount)} />
                  <Btn small kind="ghost" title="Decline" onPress={() => declineCancel(b.id)} />
                </View>
              </>
            )}
            {kind === "HOLD" && b.holdExpiresAt && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1 }}>Hold ends {timeOnly(b.holdExpiresAt)}. Deposit {peso(b.depositDue)}.</Text>
                <Btn small kind="ghost" title="Call" onPress={() => Linking.openURL(`tel:${c.mobile}`)} />
              </View>
            )}
            {kind === "REFUND" && r && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1 }}>Send <Text style={{ fontWeight: "800" }}>{peso(r.amount)}</Text> to GCash {prettyMobile(c.mobile)}</Text>
                <Btn small title="Mark sent" onPress={() => verifyPayment(b.id, r.id)} />
              </View>
            )}
          </Card>
        );
      })}
    </>
  );
}

// ---------- Calendar ----------

const CELL = 44;

function CalendarTab({ state, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => dayStart(i));
  const shown = state.bookings.filter((b) => isBusy(b) || b.status === "COMPLETED");
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 110, borderRightWidth: 1, borderRightColor: C.line }}>
          <View style={{ height: 40 }} />
          {state.units.map((u) => (
            <View key={u.id} style={{ height: CELL, justifyContent: "center", paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" }}>
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700" }}>{u.name}</Text>
              <Text style={{ fontSize: 10, color: "#94a3b8" }}>{u.plateNo}{u.status !== "ACTIVE" ? " · shop" : ""}</Text>
            </View>
          ))}
        </View>
        <ScrollView horizontal>
          <View>
            <View style={{ flexDirection: "row", height: 40 }}>
              {days.map((d, i) => (
                <View key={i} style={{ width: CELL, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 10, color: i === 0 ? C.brandDark : C.muted }}>{d.toLocaleDateString("en-PH", { weekday: "short" })}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: i === 0 ? C.brandDark : C.ink }}>{d.getDate()}</Text>
                </View>
              ))}
            </View>
            {state.units.map((u) => (
              <View key={u.id} style={{ flexDirection: "row", height: CELL, borderTopWidth: 1, borderTopColor: "#f1f5f9" }}>
                {days.map((d, i) => {
                  const end = d.getTime() + 86_400_000;
                  const inDay = (s: string, e: string) => Date.parse(s) < end && Date.parse(e) > d.getTime();
                  const bk = shown.find((b) => b.unitId === u.id && inDay(b.startAt, b.endAt));
                  const blk = state.blocks.find((k) => k.unitId === u.id && inDay(k.startAt, k.endAt));
                  return (
                    <View key={i} style={{ width: CELL, padding: 2, borderLeftWidth: 1, borderLeftColor: "#f1f5f9" }}>
                      {bk ? (
                        <Pressable onPress={() => onOpen(bk.id)} style={{ flex: 1, borderRadius: 6, backgroundColor: STATUS_BAR_COLOR[bk.status], alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>{sameDay(bk.startAt, d) || i === 0 ? bk.code.slice(4) : ""}</Text>
                        </Pressable>
                      ) : blk || u.status !== "ACTIVE" ? (
                        <View style={{ flex: 1, borderRadius: 6, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 10 }}>🔧</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 10, borderTopWidth: 1, borderTopColor: C.line }}>
        {(["HELD", "PENDING_VERIFICATION", "CONFIRMED", "ONGOING", "COMPLETED"] as const).map((s) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: STATUS_BAR_COLOR[s] }} />
            <Text style={{ fontSize: 11, color: C.muted }}>{s.replace("_", " ").toLowerCase()}</Text>
          </View>
        ))}
        <Text style={{ fontSize: 11, color: C.muted }}>🔧 blocked / PMS</Text>
      </View>
    </Card>
  );
}

// ---------- Payments ----------

function PaymentsTab({ state, onOpen }: { state: AppState; onOpen: (id: string) => void }) {
  const all = state.bookings.flatMap((b) => b.payments.map((p) => ({ p, b })));
  const verified = all.filter((x) => x.p.status === "VERIFIED");
  const sum = (xs: typeof all) => xs.reduce((s, x) => s + x.p.amount, 0);
  const totalIn = sum(verified.filter((x) => x.p.kind !== "REFUND"));
  const due = state.bookings.filter((b) => (b.status === "CONFIRMED" || b.status === "ONGOING") && balanceLeft(b) > 0);
  return (
    <>
      <Card>
        <Label>Money in</Label>
        <Text style={{ fontSize: 28, fontWeight: "800" }}>{peso(totalIn)}</Text>
        <Muted small>Deposits {peso(sum(verified.filter((x) => x.p.kind === "DEPOSIT")))} · Balances {peso(sum(verified.filter((x) => x.p.kind === "BALANCE")))} · Refunds sent {peso(sum(verified.filter((x) => x.p.kind === "REFUND")))}</Muted>
        {(["GCASH_PAYMONGO", "GCASH_MANUAL", "BANK", "COD"] as PaymentMethod[]).map((m) => {
          const amt = sum(verified.filter((x) => x.p.method === m && x.p.kind !== "REFUND"));
          return (
            <View key={m} style={{ gap: 4 }}>
              <Row k={METHOD_LABEL[m]} v={peso(amt)} />
              <View style={{ height: 6, borderRadius: 3, backgroundColor: "#f1f5f9" }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: C.brand, width: `${totalIn ? (amt / totalIn) * 100 : 0}%` }} />
              </View>
            </View>
          );
        })}
      </Card>
      <Card>
        <Label>Balances still to collect</Label>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#c2410c" }}>{peso(due.reduce((s, b) => s + balanceLeft(b), 0))}</Text>
        {due.map((b) => (
          <Pressable key={b.id} onPress={() => onOpen(b.id)}>
            <Row k={`${b.code} · ${dateOnly(b.startAt)}`} v={peso(balanceLeft(b))} />
          </Pressable>
        ))}
        {due.length === 0 && <Muted>Nothing outstanding.</Muted>}
      </Card>
    </>
  );
}

// ---------- Units ----------

function UnitsTab({ state }: { state: AppState }) {
  const [unitId, setUnitId] = useState(state.units[0]?.id);
  const [startDate, setStartDate] = useState(addDays(1));
  const [endDate, setEndDate] = useState(addDays(1));
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("PMS at casa");
  const startAt = toIso(startDate, allDay ? "00:00" : startTime);
  const endAt = allDay ? new Date(Date.parse(toIso(endDate, "00:00")) + 86_400_000).toISOString() : toIso(endDate, endTime);
  const err = Date.parse(endAt) <= Date.parse(startAt) ? "End must be after start." : !reason.trim() ? "Add a reason." : null;

  return (
    <>
      <Card>
        <H2>Block dates</H2>
        <Muted small>PMS, repair, coding day or personal use. Customers can't book the unit during a block.</Muted>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {state.units.map((u) => (
            <Btn key={u.id} small kind={unitId === u.id ? "dark" : "ghost"} title={u.name} onPress={() => setUnitId(u.id)} />
          ))}
        </ScrollView>
        <Label>From</Label>
        <DateChips value={startDate} onChange={(v) => { setStartDate(v); if (endDate < v) setEndDate(v); }} />
        <Label>To</Label>
        <DateChips value={endDate} onChange={setEndDate} />
        <Check checked={allDay} onToggle={() => setAllDay(!allDay)}>Whole day(s)</Check>
        {!allDay && (
          <>
            <Label>Start time</Label>
            <TimeChips value={startTime} onChange={setStartTime} />
            <Label>End time</Label>
            <TimeChips value={endTime} onChange={setEndTime} />
          </>
        )}
        <Field label="Reason" value={reason} onChangeText={setReason} />
        {err && <ErrorText>{err}</ErrorText>}
        <Btn kind="dark" title="Block these dates" disabled={!!err || !unitId} onPress={() => unitId && addBlock(unitId, startAt, endAt, reason.trim())} />
      </Card>
      {state.units.map((u) => {
        const blocks = state.blocks.filter((k) => k.unitId === u.id && Date.parse(k.endAt) > Date.now());
        return (
          <Card key={u.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700" }}>{u.name}</Text>
                <Muted small>{u.plateNo} · {u.seats} seats · self-drive {u.selfDriveAllowed ? peso(u.dailyRate) : "n/a"} · w/ driver {peso(u.withDriverRate)}</Muted>
              </View>
              <Btn small kind={u.status === "ACTIVE" ? "ghost" : "primary"} title={u.status === "ACTIVE" ? "Send to shop" : "Back in service"} onPress={() => setUnitStatus(u.id, u.status === "ACTIVE" ? "MAINTENANCE" : "ACTIVE")} />
            </View>
            {blocks.map((k) => (
              <View key={k.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 12 }}>🔧 {dateTime(k.startAt)} → {dateTime(k.endAt)} · {k.reason}</Text>
                <Pressable onPress={() => removeBlock(k.id)}><Text style={{ color: C.danger, fontWeight: "600" }}>Remove</Text></Pressable>
              </View>
            ))}
          </Card>
        );
      })}
    </>
  );
}

// ---------- Customers ----------

function CustomersTab({ state }: { state: AppState }) {
  return (
    <>
      {state.customers.filter((c) => !c.mobile.startsWith("deleted-")).map((c) => {
        const theirs = state.bookings.filter((b) => b.customerId === c.id);
        const spent = theirs.flatMap((b) => b.payments).filter((p) => p.status === "VERIFIED" && p.kind !== "REFUND").reduce((s, p) => s + p.amount, 0);
        return (
          <Card key={c.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700" }}>{c.fullName}</Text>
                <Muted small>{prettyMobile(c.mobile)} · {theirs.length} booking{theirs.length === 1 ? "" : "s"} · spent {peso(spent)}</Muted>
              </View>
              <Btn small kind="ghost" title="Call" onPress={() => Linking.openURL(`tel:${c.mobile}`)} />
            </View>
            <Check checked={c.isTrusted} onToggle={() => toggleCustomerFlag(c.id, "isTrusted")}>Trusted (can book with agreement only)</Check>
            <Check checked={c.isBlocked} onToggle={() => toggleCustomerFlag(c.id, "isBlocked")}>Do not rent</Check>
          </Card>
        );
      })}
    </>
  );
}

// ---------- Texts ----------

function TextsTab({ state }: { state: AppState }) {
  if (state.smsLog.length === 0) return <Card><Muted>No texts yet. They show up here as bookings come in.</Muted></Card>;
  return (
    <>
      <Banner tone="info">Demo log. Stage 5 sends these through Semaphore under the sender name {BUSINESS.smsSender}.</Banner>
      {state.smsLog.map((m) => (
        <Card key={m.id}>
          <Muted small>{dateTime(m.at)} · to {m.to.startsWith("09") ? prettyMobile(m.to) : m.to} · {m.template}</Muted>
          <Text>{m.body}</Text>
          <Muted small>{m.body.length}/160 chars{m.body.length > 160 ? " · costs 2 texts" : ""}</Muted>
        </Card>
      ))}
    </>
  );
}
