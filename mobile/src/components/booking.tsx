import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { addDays, fromYmd, HOURS, hourLabel } from "../lib/dates";
import { BUSINESS, RULES, peso, type Booking, type Unit } from "../lib/shared";
import { payDepositTestMode, submitManualProof } from "../lib/store";
import { C } from "../lib/theme";
import { Btn, Chip, Choice, Field, Label, Muted } from "./ui";

/** Next N days as tappable chips. Faster than a calendar on a phone. */
export function DateChips({ value, onChange, days = 30, minOffset = 0 }: { value: string; onChange: (d: string) => void; days?: number; minOffset?: number }) {
  const list = Array.from({ length: days }, (_, i) => addDays(i + minOffset));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {list.map((d) => {
        const dt = fromYmd(d);
        return (
          <Chip
            key={d}
            active={d === value}
            onPress={() => onChange(d)}
            sub={dt.toLocaleDateString("en-PH", { weekday: "short" })}
            label={`${dt.toLocaleDateString("en-PH", { month: "short" })} ${dt.getDate()}`}
          />
        );
      })}
    </ScrollView>
  );
}

export function TimeChips({ value, onChange, options = HOURS }: { value?: string; onChange: (t: string) => void; options?: string[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((t) => <Chip key={t} active={t === value} onPress={() => onChange(t)} label={hourLabel(t)} />)}
    </ScrollView>
  );
}

export function Stepper({ value, onChange, min, max, suffix }: { value: number; onChange: (n: number) => void; min: number; max: number; suffix: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Btn small kind="ghost" title="−" disabled={value <= min} onPress={() => onChange(value - 1)} />
      <Text style={{ fontSize: 18, fontWeight: "800", minWidth: 90, textAlign: "center" }}>{value} {suffix}</Text>
      <Btn small kind="ghost" title="+" disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

const TYPE_EMOJI: Record<Unit["type"], string> = { Sedan: "🚗", Hatchback: "🚗", MPV: "🚙", SUV: "🛻", Van: "🚐" };

export function UnitPhoto({ unit, height = 80 }: { unit: Unit; height?: number }) {
  const dark = unit.color === "#1e293b";
  return (
    <View style={{ height, borderRadius: 12, backgroundColor: unit.color, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: height * 0.45 }}>{TYPE_EMOJI[unit.type]}</Text>
      {height >= 80 && <Text style={{ position: "absolute", bottom: 6, right: 8, fontSize: 11, fontWeight: "700", color: dark ? "#e2e8f0" : "#475569" }}>{unit.plateNo}</Text>}
    </View>
  );
}

// DRAFT wording only, same as the web app. Nole (and ideally a lawyer) must replace it before go-live.
export function AgreementText() {
  const items = [
    "The deposit holds the unit for my dates. The balance is paid on or before pickup (cash, GCash or bank transfer).",
    "Cancellation: 72+ hrs before pickup, full deposit refund or free rebooking; 24–72 hrs, 50% refund; under 24 hrs or no-show, the deposit is forfeited.",
    `Self-drive: I am at least ${RULES.selfDriveMinAge}, hold a valid license, and leave a refundable security deposit of ${peso(RULES.selfDriveSecurityDeposit)}. I return the unit with the same fuel level.`,
    "I pay for traffic violations, toll and parking fees, and damage or loss caused during my rental, minus what insurance covers.",
    "No smoking. No out-of-area or RoRo trips without written approval from the owner.",
    "Late return: charged per hour after a 1-hour grace period, up to the full day rate.",
    "My personal data (including license details) is used only for this booking and kept as required under the Data Privacy Act of 2012.",
  ];
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: "700", fontSize: 13 }}>{BUSINESS.name} Booking Agreement ({RULES.agreementVersion}, draft)</Text>
      {items.map((t, i) => (
        <Text key={i} style={{ fontSize: 12, color: "#475569", lineHeight: 17 }}>{i + 1}. {t}</Text>
      ))}
    </View>
  );
}

export function HoldTimer({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Date.parse(until) - now);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const urgent = left < 5 * 60000;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12, backgroundColor: urgent ? "#ffe4e6" : "#fef3c7" }}>
      <Text style={{ flex: 1, fontSize: 13, color: urgent ? "#9f1239" : "#78350f" }}>We're holding this unit for you. Pay the deposit before the timer runs out.</Text>
      <Text style={{ fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"], color: urgent ? "#9f1239" : "#78350f" }}>{mm}:{ss}</Text>
    </View>
  );
}

/** Opens the photo library and returns the picked file name, or undefined. */
export async function pickPhoto(): Promise<string | undefined> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Photos blocked", "Allow photo access in Settings to attach a picture.");
    return undefined;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
  if (res.canceled) return undefined;
  const a = res.assets[0];
  return a.fileName ?? a.uri.split("/").pop();
}

/** Deposit step for a HELD booking. */
export function PaymentPanel({ booking }: { booking: Booking }) {
  const [tab, setTab] = useState<"GCASH_PAYMONGO" | "MANUAL">(booking.lockIn === "MANUAL" ? "MANUAL" : "GCASH_PAYMONGO");
  const [checkout, setCheckout] = useState(false);
  const [method, setMethod] = useState<"GCASH_MANUAL" | "BANK">("GCASH_MANUAL");
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<string>();
  const refOk = ref.replace(/\s/g, "").length >= 6;

  return (
    <View style={{ gap: 12 }}>
      {booking.holdExpiresAt && <HoldTimer until={booking.holdExpiresAt} />}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Choice style={{ flex: 1 }} active={tab === "GCASH_PAYMONGO"} onPress={() => setTab("GCASH_PAYMONGO")}>
          <Text style={{ fontWeight: "700" }}>GCash / QR Ph</Text>
          <Muted small>Confirmed instantly</Muted>
        </Choice>
        <Choice style={{ flex: 1 }} active={tab === "MANUAL"} onPress={() => setTab("MANUAL")}>
          <Text style={{ fontWeight: "700" }}>Send-money / Bank</Text>
          <Muted small>We check within 1 hr</Muted>
        </Choice>
      </View>

      {tab === "GCASH_PAYMONGO" && !checkout && (
        <View style={{ gap: 10 }}>
          <Muted>You'll go to a secure PayMongo page to pay {peso(booking.depositDue)} by GCash, Maya or QR Ph. Your booking confirms as soon as it goes through.</Muted>
          <Btn title={`Pay ${peso(booking.depositDue)} deposit`} onPress={() => setCheckout(true)} />
        </View>
      )}

      {tab === "GCASH_PAYMONGO" && checkout && (
        // Stage 5: replace with WebBrowser.openAuthSessionAsync(PayMongo checkout URL).
        <View style={{ borderWidth: 2, borderStyle: "dashed", borderColor: "#7dd3fc", backgroundColor: "#f0f9ff", borderRadius: 16, padding: 14, gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#0369a1", letterSpacing: 0.5 }}>PAYMONGO CHECKOUT · TEST MODE</Text>
          <Text>Amount: <Text style={{ fontWeight: "800" }}>{peso(booking.depositDue)}</Text> · Ref {booking.code}</Text>
          <Muted small>No real money moves in this demo.</Muted>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn flex kind="dark" title="Simulate successful payment" onPress={() => payDepositTestMode(booking.id)} />
            <Btn kind="ghost" title="Back" onPress={() => setCheckout(false)} />
          </View>
        </View>
      )}

      {tab === "MANUAL" && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["GCASH_MANUAL", "BANK"] as const).map((m) => (
              <Choice key={m} style={{ flex: 1 }} active={method === m} onPress={() => setMethod(m)}>
                <Text style={{ fontWeight: "700" }}>{m === "BANK" ? "Bank / InstaPay" : "GCash send-money"}</Text>
              </Choice>
            ))}
          </View>
          <View style={{ backgroundColor: "#f1f5f9", borderRadius: 12, padding: 12, gap: 4 }}>
            <Muted>Send exactly <Text style={{ fontWeight: "800", color: C.ink }}>{peso(booking.depositDue)}</Text> to:</Muted>
            <Text selectable style={{ fontWeight: "700" }}>
              {method === "GCASH_MANUAL" ? `GCash ${BUSINESS.gcashNumber} · ${BUSINESS.gcashName}` : `${BUSINESS.bankName} ${BUSINESS.bankAccountNo} · ${BUSINESS.bankAccountName}`}
            </Text>
            <Muted small>Put {booking.code} in the message/notes.</Muted>
          </View>
          <Field label="Reference number" placeholder="e.g. 5012 334 889201" keyboardType="number-pad" value={ref} onChangeText={setRef} />
          <View style={{ gap: 4 }}>
            <Label>Screenshot of receipt</Label>
            <Btn kind="ghost" title={file ? `📎 ${file}` : "Attach screenshot"} onPress={async () => setFile((await pickPhoto()) ?? file)} />
          </View>
          <Btn title="Submit payment proof" disabled={!refOk} onPress={() => submitManualProof(booking.id, method, ref.trim(), file)} />
          <Muted small>Nole matches your reference number in the GCash or bank app before confirming. You'll get a text once it's done.</Muted>
        </View>
      )}
    </View>
  );
}
