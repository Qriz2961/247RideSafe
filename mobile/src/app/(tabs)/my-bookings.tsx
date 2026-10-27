import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { UnitPhoto } from "../../components/booking";
import { Banner, Btn, Card, ErrorText, Field, H1, Label, Muted, Screen, StatusBadge } from "../../components/ui";
import { balanceLeft, dateTime, normalizeMobile, peso, prettyMobile, SERVICE_LABEL, type AppState, type Booking } from "../../lib/shared";
import { deleteAccount, setSession, useAppState, useSession } from "../../lib/store";
import { C, TEST_OTP } from "../../lib/theme";

const ACTIVE = ["HELD", "PENDING_VERIFICATION", "CONFIRMED", "ONGOING"];

export default function MyBookings() {
  const state = useAppState()!;
  const mobile = useSession();
  const router = useRouter();

  if (!mobile) return <SignIn />;

  const customer = state.customers.find((c) => c.mobile === mobile);
  const mine = state.bookings.filter((b) => b.customerId === customer?.id).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const upcoming = mine.filter((b) => ACTIVE.includes(b.status));
  const past = mine.filter((b) => !ACTIVE.includes(b.status)).reverse();

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This removes your name, number, email and license details. Any active booking is cancelled under the usual refund rules. Booking amounts and dates stay in the owner's records for tax purposes.",
      [
        { text: "Keep account", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteAccount(mobile!) },
      ],
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <H1>{customer ? customer.fullName : "My bookings"}</H1>
          <Muted>{prettyMobile(mobile)}</Muted>
        </View>
        <Btn small kind="ghost" title="Sign out" onPress={() => setSession(null)} />
      </View>
      <Btn title="+ New booking" onPress={() => router.navigate({ pathname: "/book", params: { t: String(Date.now()) } })} />

      {mine.length === 0 && <Card><Muted>No bookings under this number yet.</Muted></Card>}

      {upcoming.length > 0 && <Label>Upcoming</Label>}
      {upcoming.map((b) => <BookingCard key={b.id} b={b} state={state} onOpen={() => router.push(`/booking/${b.id}`)} />)}
      {past.length > 0 && <Label>Past & cancelled</Label>}
      {past.map((b) => <BookingCard key={b.id} b={b} state={state} onOpen={() => router.push(`/booking/${b.id}`)} />)}

      {customer && (
        <Pressable onPress={confirmDelete} style={{ marginTop: 24, alignSelf: "center", padding: 8 }}>
          <Text style={{ color: C.danger, fontWeight: "600" }}>Delete my account</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function BookingCard({ b, state, onOpen }: { b: Booking; state: AppState; onOpen: () => void }) {
  const u = state.units.find((x) => x.id === b.unitId)!;
  const left = balanceLeft(b);
  return (
    <Pressable onPress={onOpen}>
      <Card>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 84 }}><UnitPhoto unit={u} height={64} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontWeight: "800", color: C.brandDark }}>{b.code}</Text>
            <Text style={{ fontWeight: "700" }}>{SERVICE_LABEL[b.serviceType]} · {u.name}</Text>
            <Muted small>{dateTime(b.startAt)}</Muted>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <StatusBadge status={b.status} />
          {ACTIVE.includes(b.status) && left > 0 && <Text style={{ fontWeight: "700", color: "#c2410c" }}>Balance {peso(left)}</Text>}
        </View>
        {b.status === "HELD" && <Banner tone="warn">Deposit not paid yet. Tap to pay before the hold runs out.</Banner>}
        {b.cancelRequested && <Banner tone="info">Cancellation requested. Nole will get back to you.</Banner>}
      </Card>
    </Pressable>
  );
}

function SignIn() {
  const [raw, setRaw] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string>();
  const m = normalizeMobile(raw);

  return (
    <Screen>
      <Card>
        <H1>Sign in with your number</H1>
        <Muted>We'll text you a 6-digit code. No password to remember.</Muted>
        <Field label="Mobile number" placeholder="0917 123 4567" keyboardType="phone-pad" autoComplete="tel" value={raw} onChangeText={(v) => { setRaw(v); setSent(false); }} />
        {!sent ? (
          <Btn title="Send code" disabled={!m} onPress={() => setSent(true)} />
        ) : (
          <>
            <Banner tone="info">Demo: the code is always {TEST_OTP}. Stage 4 sends a real SMS.</Banner>
            <Field label="6-digit code" keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" textContentType="oneTimeCode" value={code} onChangeText={setCode} />
            {err && <ErrorText>{err}</ErrorText>}
            <Btn title="Sign in" disabled={code.length !== 6} onPress={() => (code === TEST_OTP && m ? setSession(m) : setErr("Wrong code. Try again."))} />
          </>
        )}
        <Muted small>Try the sample customer: 0917 123 4567</Muted>
      </Card>
    </Screen>
  );
}
