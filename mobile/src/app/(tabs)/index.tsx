import { useRouter } from "expo-router";
import { Linking, Text, View } from "react-native";
import { Card, Choice, H2, Label, Muted, Screen } from "../../components/ui";
import { BUSINESS, peso, type ServiceType } from "../../lib/shared";
import { useAppState } from "../../lib/store";
import { C, CONTACT } from "../../lib/theme";

const SERVICES: { key: ServiceType; emoji: string; title: string; note: string }[] = [
  { key: "SELF_DRIVE", emoji: "🔑", title: "Self-drive", note: "Per 24 hrs · license needed" },
  { key: "WITH_DRIVER", emoji: "🧑‍✈️", title: "With driver", note: "Per day · driver included" },
  { key: "DAY_TOUR", emoji: "🏝️", title: "6-hour Day Tour", note: "Package · driver + fuel" },
  { key: "LONG_TOUR", emoji: "🗺️", title: "Long-term Tour", note: "Multi-day · per day" },
];

export default function Home() {
  const router = useRouter();
  const state = useAppState()!;
  const fromRate = Math.min(...state.units.filter((u) => u.selfDriveAllowed && u.status === "ACTIVE").map((u) => u.dailyRate));

  return (
    <Screen>
      <View style={{ backgroundColor: C.brand, borderRadius: 20, padding: 20, gap: 6 }}>
        <Text style={{ color: "#ffedd5", fontWeight: "700", fontSize: 12, letterSpacing: 1 }}>OPEN 24/7 · BOOK IN 2 MINUTES</Text>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>Cars, vans & tours, ready when you are.</Text>
        <Text style={{ color: "#ffedd5" }}>See what's free, lock it in with a GCash deposit, get a text reminder before pickup. Self-drive from {peso(fromRate)}/day.</Text>
      </View>

      <H2>What do you need?</H2>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {SERVICES.map((s) => (
          <Choice key={s.key} style={{ width: "48.5%" }} onPress={() => router.navigate({ pathname: "/book", params: { service: s.key, t: String(Date.now()) } })}>
            <Text style={{ fontSize: 26 }}>{s.emoji}</Text>
            <Text style={{ fontWeight: "800", fontSize: 15 }}>{s.title}</Text>
            <Muted small>{s.note}</Muted>
          </Choice>
        ))}
      </View>

      <H2>Tour packages</H2>
      {state.tours.map((t) => (
        <Card key={t.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ fontWeight: "800", flex: 1 }}>{t.name}</Text>
            <Text style={{ fontWeight: "800", color: C.brandDark }}>{peso(t.basePrice)}{t.type === "LONG_TERM" ? "/day" : ""}</Text>
          </View>
          <Muted small>{t.itinerary.join(" · ")}</Muted>
          <Text style={{ fontSize: 12, color: C.ok }}>Includes: {t.includes.join(", ")} · up to {t.maxPax} pax</Text>
        </Card>
      ))}

      <Card>
        <Label>Questions? Message {BUSINESS.owner.split(" ")[0]}</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            ["📞 Call", `tel:${CONTACT.phone}`],
            ["💬 Messenger", CONTACT.messenger],
            ["🟣 Viber", CONTACT.viber],
          ].map(([label, url]) => (
            <Choice key={label} style={{ flex: 1, alignItems: "center" }} onPress={() => Linking.openURL(url).catch(() => {})}>
              <Text style={{ fontWeight: "700", fontSize: 13 }}>{label}</Text>
            </Choice>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
