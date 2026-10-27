import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { AgreementText, DateChips, PaymentPanel, pickPhoto, Stepper, TimeChips, UnitPhoto } from "../../components/booking";
import { Banner, Btn, Card, Check, Choice, ErrorText, Field, H1, Label, Muted, Row, StatusBadge } from "../../components/ui";
import { addDays, fromYmd, toIso } from "../../lib/dates";
import {
  checkUnit, dateTime, normalizeMobile, peso, prettyMobile, quote, RULES, SERVICE_LABEL, suggestUnit,
  type AppState, type LockInMethod, type ServiceType, type UnitAvailability,
} from "../../lib/shared";
import { createHold, setSession, useAppState } from "../../lib/store";
import { C } from "../../lib/theme";

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

const EMPTY = { fullName: "", mobile: "", email: "", pickup: "", licenseNo: "", licenseFile: "", ageOk: false };

export default function BookScreen() {
  const params = useLocalSearchParams<{ service?: string; owner?: string; t?: string }>();
  const router = useRouter();
  const state = useAppState()!;
  const scroll = useRef<ScrollViewInstance>(null);

  const [ownerMode, setOwnerMode] = useState(false);
  const [step, setStep] = useState(0);
  const [service, setService] = useState<ServiceType | null>(null);
  const [tourId, setTourId] = useState<string>();
  const [startDate, setStartDate] = useState(addDays(1));
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState(addDays(2));
  const [endTime, setEndTime] = useState("08:00");
  const [slot, setSlot] = useState<string>();
  const [days, setDays] = useState(3);
  const [pax, setPax] = useState(2);
  const [unitId, setUnitId] = useState<string>();
  const [d, setD] = useState(EMPTY);
  const [agree, setAgree] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [lockIn, setLockIn] = useState<LockInMethod>("GCASH_PAYMONGO");
  const [bookingId, setBookingId] = useState<string>();
  const [error, setError] = useState<string>();

  function reset(nextService: ServiceType | null, owner: boolean) {
    setOwnerMode(owner);
    setService(nextService);
    setStep(nextService ? 1 : 0);
    setTourId(undefined);
    setSlot(undefined);
    setUnitId(undefined);
    setD(EMPTY);
    setAgree(false);
    setSignedName("");
    setLockIn("GCASH_PAYMONGO");
    setBookingId(undefined);
    setError(undefined);
  }

  // Tabs stay mounted, so start fresh whenever Home or the owner tab sends us here.
  useEffect(() => {
    if (!params.t) return;
    const s = SERVICES.find((x) => x.key === params.service)?.key ?? null;
    reset(s, params.owner === "1");
  }, [params.t]);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, [step, bookingId]);

  const isTour = service === "DAY_TOUR" || service === "LONG_TOUR";
  const tours = state.tours.filter((t) => (service === "DAY_TOUR" ? t.type === "DAY_6H" : t.type === "LONG_TERM"));
  const tour = state.tours.find((t) => t.id === tourId);
  const unit = state.units.find((u) => u.id === unitId);

  const win = useMemo(() => {
    if (!service) return null;
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
  }, [service, slot, startDate, startTime, endDate, endTime, days]);

  const whenError = (() => {
    if (isTour && !tour) return "Pick a tour package.";
    if (!win) return service === "DAY_TOUR" ? "Pick a start time." : "Pick your dates.";
    if (Date.parse(win.startAt) < Date.now() + 2 * 3600_000) return "Pickup must be at least 2 hours from now.";
    if (Date.parse(win.endAt) <= Date.parse(win.startAt)) return "Return must be after pickup.";
    if (tour && pax > tour.maxPax) return `This tour takes up to ${tour.maxPax} people.`;
    if (service === "LONG_TOUR" && tour?.minDays && days < tour.minDays) return `Minimum ${tour.minDays} days.`;
    return null;
  })();

  const q = service && win ? quote(service, unit, tour, win.startAt, win.endAt) : null;
  const mobile = normalizeMobile(d.mobile);
  const existing = mobile ? state.customers.find((c) => c.mobile === mobile) : undefined;
  const canAgreementOnly = ownerMode || !!existing?.isTrusted;
  const booking = bookingId ? state.bookings.find((b) => b.id === bookingId) : undefined;

  const detailsError = (() => {
    if (d.fullName.trim().length < 3) return "Enter your full name.";
    if (!mobile) return "Enter a valid PH mobile number (09XX XXX XXXX).";
    if (!d.pickup.trim()) return "Where should we meet you?";
    if (service === "SELF_DRIVE") {
      if (!d.licenseNo.trim()) return "Enter your driver's license number.";
      if (!ownerMode && !d.licenseFile) return "Attach a photo of your license.";
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
    else if (unit && !checkUnit(st, unit, win.startAt, win.endAt, { serviceType: service, pax }).ok) setUnitId(undefined);
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
    if (!ownerMode) setSession(mobile);
    setStep(4);
  }

  // ---------- Done screen ----------
  if (booking && booking.status !== "HELD") {
    const lastSms = state.smsLog.find((m) => m.bookingId === booking.id && m.template !== "OWNER_NEW");
    const u = state.units.find((x) => x.id === booking.unitId)!;
    const paid = booking.payments.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);
    return (
      <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 40 }}>{booking.status === "CONFIRMED" ? "✅" : booking.status === "EXPIRED" ? "⌛" : "🔎"}</Text>
          <H1>{booking.status === "CONFIRMED" ? "You're booked!" : booking.status === "PENDING_VERIFICATION" ? "Payment received, checking it now" : "This hold has expired"}</H1>
          <Text selectable style={{ fontSize: 26, fontWeight: "800", letterSpacing: 2, color: C.brandDark }}>{booking.code}</Text>
          <StatusBadge status={booking.status} />
          <View style={{ alignSelf: "stretch", marginTop: 8 }}>
            <Row k="Service" v={SERVICE_LABEL[booking.serviceType]} />
            <Row k="Unit" v={`${u.name} · ${u.plateNo}`} />
            <Row k="Pickup" v={`${dateTime(booking.startAt)} · ${booking.pickupLocation}`} />
            <Row k="Return" v={dateTime(booking.endAt)} />
            <Row k="Total" v={peso(booking.total)} />
            <Row k="Balance at pickup" v={peso(booking.total - paid)} bold />
          </View>
        </Card>
        {lastSms && (
          <Card>
            <Label>Text sent to {prettyMobile(lastSms.to)}</Label>
            <View style={{ backgroundColor: "#f1f5f9", borderRadius: 14, borderTopLeftRadius: 4, padding: 12 }}>
              <Text>{lastSms.body}</Text>
            </View>
          </Card>
        )}
        <Btn title={ownerMode ? "Back to dashboard" : "See my bookings"} onPress={() => router.navigate(ownerMode ? "/owner" : "/my-bookings")} />
        <Btn kind="ghost" title="Book another" onPress={() => reset(null, ownerMode)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {ownerMode && <Banner tone="dark">Owner mode: encoding a walk-in / Messenger booking. Same slot check applies.</Banner>}

      <View style={{ flexDirection: "row", gap: 4 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, borderTopWidth: 4, borderTopColor: i <= step ? C.brand : C.line, paddingTop: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: i <= step ? C.brandDark : "#94a3b8" }}>{i + 1}. {s.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {/* Step 0: service */}
      {step === 0 && (
        <Card>
          <H1>What do you need?</H1>
          {SERVICES.map((s) => (
            <Choice key={s.key} active={service === s.key} onPress={() => pickService(s.key)}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>{s.title}</Text>
              <Muted small>{s.note}</Muted>
            </Choice>
          ))}
        </Card>
      )}

      {/* Step 1: when */}
      {step === 1 && service && (
        <Card>
          <H1>{SERVICE_LABEL[service]}: when?</H1>
          {isTour && (
            <View style={{ gap: 8 }}>
              <Label>Tour package</Label>
              {tours.map((t) => (
                <Choice key={t.id} active={tourId === t.id} onPress={() => { setTourId(t.id); setSlot(undefined); }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ fontWeight: "700", flex: 1 }}>{t.name}</Text>
                    <Text style={{ fontWeight: "700" }}>{peso(t.basePrice)}{t.type === "LONG_TERM" ? "/day" : ""}</Text>
                  </View>
                  <Muted small>{t.itinerary.join(" · ")}</Muted>
                  <Text style={{ fontSize: 12, color: C.ok }}>Includes: {t.includes.join(", ")}</Text>
                </Choice>
              ))}
            </View>
          )}

          <Label>{isTour ? "Tour date" : "Pickup date"}</Label>
          <DateChips value={startDate} onChange={(v) => { setStartDate(v); if (endDate <= v) setEndDate(addDays(1, fromYmd(v))); }} />

          {service === "DAY_TOUR" ? (
            <>
              <Label>Start time (6 hrs)</Label>
              {tour ? <TimeChips value={slot} onChange={setSlot} options={tour.startSlots ?? []} /> : <Muted>Pick a package first</Muted>}
            </>
          ) : (
            <>
              <Label>Pickup time</Label>
              <TimeChips value={startTime} onChange={setStartTime} />
            </>
          )}

          {(service === "SELF_DRIVE" || service === "WITH_DRIVER") && (
            <>
              <Label>Return date</Label>
              <DateChips value={endDate} onChange={setEndDate} />
              <Label>Return time</Label>
              <TimeChips value={endTime} onChange={setEndTime} />
            </>
          )}

          {service === "LONG_TOUR" && (
            <>
              <Label>Number of days</Label>
              <Stepper value={days} onChange={setDays} min={tour?.minDays ?? 2} max={30} suffix="days" />
            </>
          )}

          <Label>Passengers</Label>
          <Stepper value={pax} onChange={setPax} min={1} max={15} suffix="pax" />

          {whenError && <ErrorText>{whenError}</ErrorText>}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn kind="ghost" title="Back" onPress={() => setStep(0)} />
            <Btn flex title="See free units" disabled={!!whenError} onPress={() => goToUnits(state)} />
          </View>
        </Card>
      )}

      {/* Step 2: unit */}
      {step === 2 && service && win && (
        <Card>
          <H1>Pick a unit</H1>
          <Muted>{dateTime(win.startAt)} → {dateTime(win.endAt)} · {pax} pax</Muted>
          {isTour && <Text style={{ fontSize: 12, color: C.ok }}>We picked the smallest free unit that fits your group. You can change it.</Text>}
          {error && <Banner tone="danger">{error}</Banner>}
          {state.units.filter((u) => u.status !== "RETIRED").map((u) => {
            const a = checkUnit(state, u, win.startAt, win.endAt, { serviceType: service, pax });
            const rate = service === "SELF_DRIVE" ? u.dailyRate : u.withDriverRate;
            return (
              <Choice key={u.id} disabled={!a.ok} active={unitId === u.id} onPress={() => setUnitId(u.id)}>
                <UnitPhoto unit={u} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700" }}>{u.name}</Text>
                    <Muted small>{u.type} · {u.seats} seats · {u.transmission} · {u.fuel}</Muted>
                  </View>
                  {!isTour && rate > 0 && <Text style={{ fontWeight: "800" }}>{peso(rate)}<Text style={{ fontSize: 12, fontWeight: "400", color: C.muted }}>/day</Text></Text>}
                </View>
                {!a.ok && <Text style={{ alignSelf: "flex-start", backgroundColor: "#e2e8f0", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, fontWeight: "700", color: "#475569" }}>{REASON_TEXT[a.reason]}</Text>}
              </Choice>
            );
          })}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn kind="ghost" title="Back" onPress={() => setStep(1)} />
            <Btn flex title="Continue" disabled={!unitId} onPress={() => { setError(undefined); setStep(3); }} />
          </View>
        </Card>
      )}

      {/* Step 3: details + agreement */}
      {step === 3 && service && (
        <Card>
          <H1>Your details</H1>
          <Field label="Full name" value={d.fullName} onChangeText={(v) => setD({ ...d, fullName: v })} placeholder="Juan Dela Cruz" autoComplete="name" />
          <Field label="Mobile number" value={d.mobile} onChangeText={(v) => setD({ ...d, mobile: v })} placeholder="0917 123 4567" keyboardType="phone-pad" autoComplete="tel" />
          <Field label="Email (optional)" value={d.email} onChangeText={(v) => setD({ ...d, email: v })} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Pickup / meeting spot" value={d.pickup} onChangeText={(v) => setD({ ...d, pickup: v })} placeholder="e.g. Airport arrival, SM entrance 2" />
          {service === "SELF_DRIVE" && (
            <>
              <Field label="Driver's license no." value={d.licenseNo} onChangeText={(v) => setD({ ...d, licenseNo: v })} placeholder="N01-23-456789" autoCapitalize="characters" />
              <Label>License photo</Label>
              <Btn kind="ghost" title={d.licenseFile ? `📎 ${d.licenseFile}` : "Attach license photo"} onPress={async () => { const f = await pickPhoto(); if (f) setD({ ...d, licenseFile: f }); }} />
              <Check checked={d.ageOk} onToggle={() => setD({ ...d, ageOk: !d.ageOk })}>
                I am {RULES.selfDriveMinAge} or older and my license is valid (foreign license: within 90 days of arrival).
              </Check>
            </>
          )}
          {existing && !existing.isBlocked && <Text style={{ fontSize: 12, color: C.ok }}>Welcome back, {existing.fullName.split(" ")[0]}!</Text>}

          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12 }}>
            <ScrollView style={{ maxHeight: 200, padding: 12 }} nestedScrollEnabled>
              <AgreementText />
            </ScrollView>
            <View style={{ borderTopWidth: 1, borderTopColor: C.line, padding: 12, gap: 10 }}>
              <Check checked={agree} onToggle={() => setAgree(!agree)}>I have read and agree to the booking agreement and the privacy notice.</Check>
              <Field label="Type your full name to sign" value={signedName} onChangeText={setSignedName} placeholder={d.fullName || "Your full name"} />
            </View>
          </View>

          <Label>How do you want to lock it in?</Label>
          <Choice active={lockIn === "GCASH_PAYMONGO"} onPress={() => setLockIn("GCASH_PAYMONGO")}>
            <Text style={{ fontWeight: "700" }}>GCash / QR Ph</Text>
            <Muted small>Instant confirmation</Muted>
          </Choice>
          <Choice active={lockIn === "MANUAL"} onPress={() => setLockIn("MANUAL")}>
            <Text style={{ fontWeight: "700" }}>Send-money / Bank</Text>
            <Muted small>Upload receipt; we check it</Muted>
          </Choice>
          <Choice active={lockIn === "AGREEMENT_ONLY"} disabled={!canAgreementOnly} onPress={() => setLockIn("AGREEMENT_ONLY")}>
            <Text style={{ fontWeight: "700" }}>Agreement only</Text>
            <Muted small>{canAgreementOnly ? "Trusted customer, pay at pickup" : "For returning customers only"}</Muted>
          </Choice>

          {detailsError && <ErrorText>{detailsError}</ErrorText>}
          {error && <Banner tone="danger">{error}</Banner>}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn kind="ghost" title="Back" onPress={() => setStep(2)} />
            <Btn flex title={lockIn === "AGREEMENT_ONLY" ? "Confirm booking" : "Hold unit & pay deposit"} disabled={!!detailsError} onPress={hold} />
          </View>
        </Card>
      )}

      {/* Step 4: deposit */}
      {step === 4 && booking && booking.status === "HELD" && (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <H1>Pay the deposit</H1>
            <Text style={{ fontWeight: "800", color: C.brandDark }}>{booking.code}</Text>
          </View>
          <PaymentPanel booking={booking} />
        </Card>
      )}

      {/* Summary */}
      {service && (
        <Card>
          <Label>Summary</Label>
          <Row k="Service" v={SERVICE_LABEL[service]} />
          {tour && <Row k="Package" v={tour.name} />}
          {win && step >= 2 && <Row k="Pickup" v={dateTime(win.startAt)} />}
          {win && step >= 2 && <Row k="Return" v={dateTime(win.endAt)} />}
          {unit && <Row k="Unit" v={unit.name} />}
          {q && q.total > 0 && (
            <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, gap: 2 }}>
              {q.lines.map((l) => <Row key={l.label} k={l.label} v={peso(l.amount)} />)}
              <Row k="Total" v={peso(q.total)} bold />
              <Row k="Deposit now" v={peso(q.deposit)} bold accent />
              <Row k="Balance at pickup" v={peso(q.balance)} />
              {q.security > 0 && <Row k="Security deposit (refundable, at pickup)" v={peso(q.security)} />}
            </View>
          )}
        </Card>
      )}
    </ScrollView>
  );
}
