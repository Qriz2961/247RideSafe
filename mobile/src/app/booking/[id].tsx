import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { AgreementText, PaymentPanel, UnitPhoto } from "../../components/booking";
import { Banner, Btn, Card, Choice, H1, Label, Muted, Row, Screen, StatusBadge } from "../../components/ui";
import {
  balanceLeft, dateTime, METHOD_LABEL, paidSoFar, peso, prettyMobile, refundFor, SERVICE_LABEL, checkUnit,
  type Booking, type PaymentMethod,
} from "../../lib/shared";
import {
  cancelWithRefund, collectBalance, reassignUnit, rejectPayment, requestCancel, sendReminder, setStatus, useAppState, verifyPayment,
} from "../../lib/store";
import { C, CONTACT } from "../../lib/theme";

/** One booking. Customers see status, payment and cancel; the owner (?owner=1) also gets the action buttons. */
export default function BookingDetail() {
  const { id, owner } = useLocalSearchParams<{ id: string; owner?: string }>();
  const state = useAppState()!;
  const isOwner = owner === "1";
  const [now, setNow] = useState(() => Date.now());
  const [showAgreement, setShowAgreement] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const b = state.bookings.find((x) => x.id === id);
  if (!b) return <Screen><Muted>Booking not found.</Muted></Screen>;
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const u = state.units.find((x) => x.id === b.unitId)!;
  const tour = state.tours.find((t) => t.id === b.tourId);
  const refund = refundFor(b, now);
  const left = balanceLeft(b);
  const active = ["HELD", "PENDING_VERIFICATION", "CONFIRMED", "ONGOING"].includes(b.status);

  return (
    <Screen>
      <Stack.Screen options={{ title: b.code }} />
      <Card>
        <UnitPhoto unit={u} height={110} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text selectable style={{ fontSize: 22, fontWeight: "800", letterSpacing: 1.5, color: C.brandDark }}>{b.code}</Text>
          <StatusBadge status={b.status} />
        </View>
        <Row k="Service" v={SERVICE_LABEL[b.serviceType]} />
        {tour && <Row k="Package" v={tour.name} />}
        <Row k="Unit" v={`${u.name} · ${u.plateNo}`} />
        <Row k="Pickup" v={dateTime(b.startAt)} />
        <Row k="Return" v={dateTime(b.endAt)} />
        <Row k="Meeting spot" v={b.pickupLocation} />
        <Row k="Passengers" v={String(b.pax)} />
        {isOwner && <Row k="Customer" v={`${c.fullName} · ${prettyMobile(c.mobile)}`} />}
      </Card>

      <Card>
        <Label>Money</Label>
        <Row k="Total" v={peso(b.total)} bold />
        <Row k="Paid so far" v={peso(paidSoFar(b))} />
        <Row k="Balance" v={peso(left)} bold accent={left > 0} />
        {b.securityDeposit > 0 && <Row k="Security deposit (refundable)" v={peso(b.securityDeposit)} />}
        {b.payments.map((p) => (
          <View key={p.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, gap: 4 }}>
            <Row k={`${p.kind.toLowerCase()} · ${METHOD_LABEL[p.method]}`} v={`${peso(p.amount)} ${p.status === "VERIFIED" ? "✓" : "(checking)"}`} />
            {p.referenceNo && <Muted small>Ref {p.referenceNo}{p.proofFileName ? ` · 📎 ${p.proofFileName}` : ""}</Muted>}
            {isOwner && p.status === "PENDING" && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Btn small flex title={p.kind === "REFUND" ? "Mark refund sent" : "Verify"} onPress={() => verifyPayment(b.id, p.id)} />
                {p.kind !== "REFUND" && <Btn small kind="ghost" title="Not found" onPress={() => rejectPayment(b.id, p.id)} />}
              </View>
            )}
          </View>
        ))}
      </Card>

      {b.status === "HELD" && !isOwner && (
        <Card>
          <H1>Pay the deposit</H1>
          <PaymentPanel booking={b} />
        </Card>
      )}

      {isOwner ? <OwnerActions b={b} refundAmount={refund.amount} left={left} /> : (
        <Card>
          <Label>Need help?</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn small flex kind="ghost" title="📞 Call" onPress={() => Linking.openURL(`tel:${CONTACT.phone}`)} />
            <Btn small flex kind="ghost" title="💬 Messenger" onPress={() => Linking.openURL(CONTACT.messenger).catch(() => {})} />
          </View>
          {active && !b.cancelRequested && b.status !== "ONGOING" && (
            <>
              <Muted small>If you cancel now ({Math.max(0, refund.hoursBefore)} hrs before pickup), the policy gives back {refund.pct}% of your deposit: {peso(refund.amount)}.</Muted>
              <Btn kind="ghost" title="Request cancellation" onPress={() => Alert.alert("Request cancellation?", `Nole will confirm. Expected refund: ${peso(refund.amount)}.`, [
                { text: "Keep booking", style: "cancel" },
                { text: "Request", style: "destructive", onPress: () => requestCancel(b.id) },
              ])} />
            </>
          )}
          {b.cancelRequested && <Banner tone="info">Cancellation requested. Nole will text you.</Banner>}
        </Card>
      )}

      {b.agreement && (
        <Card>
          <Label>Signed agreement</Label>
          <Muted small>Signed by {b.agreement.signedName} on {dateTime(b.agreement.signedAt)} · {b.agreement.version}</Muted>
          <Btn small kind="ghost" title={showAgreement ? "Hide agreement" : "View agreement"} onPress={() => setShowAgreement(!showAgreement)} />
          {showAgreement && <AgreementText />}
        </Card>
      )}

      {isOwner && (
        <Card>
          <Label>History</Label>
          {[...b.events].reverse().map((e, i) => (
            <Muted key={i} small>{dateTime(e.at)} · {e.to === "NOTE" ? "" : `${e.to} · `}{e.by.toLowerCase()}{e.note ? ` · ${e.note}` : ""}</Muted>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function OwnerActions({ b, refundAmount, left }: { b: Booking; refundAmount: number; left: number }) {
  const state = useAppState()!;
  const c = state.customers.find((x) => x.id === b.customerId)!;
  const [method, setMethod] = useState<PaymentMethod>("COD");
  const [msg, setMsg] = useState<string>();
  const others = state.units.filter((u) => u.id !== b.unitId && checkUnit(state, u, b.startAt, b.endAt, { serviceType: b.serviceType, pax: b.pax, ignoreBookingId: b.id }).ok);

  return (
    <Card>
      <Label>Owner actions</Label>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn small flex kind="ghost" title="📞 Call" onPress={() => Linking.openURL(`tel:${c.mobile}`)} />
        <Btn small flex kind="ghost" title="✉️ SMS" onPress={() => Linking.openURL(`sms:${c.mobile}`)} />
      </View>

      {b.cancelRequested && <Banner tone="warn">Customer asked to cancel. Policy refund: {peso(refundAmount)}.</Banner>}

      {(b.status === "CONFIRMED" || b.status === "ONGOING") && left > 0 && (
        <View style={{ gap: 6 }}>
          <Muted small>Collect balance {peso(left)} via:</Muted>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {(["COD", "GCASH_MANUAL", "BANK"] as PaymentMethod[]).map((m) => (
              <Choice key={m} active={method === m} onPress={() => setMethod(m)} style={{ paddingVertical: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700" }}>{METHOD_LABEL[m]}</Text>
              </Choice>
            ))}
          </View>
          <Btn kind="dark" title={`Collected ${peso(left)}`} onPress={() => collectBalance(b.id, method)} />
        </View>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {b.status === "CONFIRMED" && <Btn small title="Mark picked up" onPress={() => setStatus(b.id, "ONGOING", "OWNER", "Picked up")} />}
        {b.status === "ONGOING" && <Btn small title="Mark returned" onPress={() => setStatus(b.id, "COMPLETED", "OWNER", "Returned")} />}
        {b.status === "CONFIRMED" && <Btn small kind="ghost" title="Send reminder text" onPress={() => { sendReminder(b.id); setMsg("Reminder logged in Texts."); }} />}
        {b.status === "CONFIRMED" && <Btn small kind="ghost" title="No-show" onPress={() => setStatus(b.id, "NO_SHOW", "OWNER")} />}
        {["HELD", "PENDING_VERIFICATION", "CONFIRMED"].includes(b.status) && (
          <Btn small kind="danger" title="Cancel booking" onPress={() => Alert.alert(`Cancel ${b.code}?`, `Policy refund: ${peso(refundAmount)}`, [
            { text: "Back", style: "cancel" },
            { text: "Cancel booking", style: "destructive", onPress: () => cancelWithRefund(b.id, refundAmount) },
          ])} />
        )}
      </View>

      {["HELD", "PENDING_VERIFICATION", "CONFIRMED"].includes(b.status) && others.length > 0 && (
        <View style={{ gap: 6 }}>
          <Muted small>Swap to another free unit:</Muted>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {others.map((u) => (
              <Btn key={u.id} small kind="ghost" title={u.name} onPress={() => { const r = reassignUnit(b.id, u.id); setMsg(r.ok ? `Moved to ${u.name}.` : r.error); }} />
            ))}
          </View>
        </View>
      )}
      {msg && <Banner tone="ok">{msg}</Banner>}
    </Card>
  );
}
