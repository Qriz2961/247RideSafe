import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { STATUS_LABEL, type BookingStatus } from "../lib/shared";
import { C } from "../lib/theme";

export function Screen({ children, padBottom = 32 }: { children: ReactNode; padBottom?: number }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: padBottom, gap: 12 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const Label = ({ children }: { children: ReactNode }) => <Text style={s.label}>{children}</Text>;
export const Muted = ({ children, small }: { children: ReactNode; small?: boolean }) => <Text style={[s.muted, small && { fontSize: 12 }]}>{children}</Text>;
export const ErrorText = ({ children }: { children: ReactNode }) => <Text style={{ color: C.danger, fontSize: 14 }}>{children}</Text>;

type BtnKind = "primary" | "ghost" | "dark" | "danger";
export function Btn({ title, onPress, kind = "primary", disabled, small, flex }: { title: string; onPress: () => void; kind?: BtnKind; disabled?: boolean; small?: boolean; flex?: boolean }) {
  const bg = { primary: C.brand, ghost: "#fff", dark: C.ink, danger: C.danger }[kind];
  const fg = kind === "ghost" ? C.ink : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        kind === "ghost" && { borderWidth: 1, borderColor: C.line },
        small && { paddingVertical: 8, paddingHorizontal: 12 },
        flex && { flex: 1 },
      ]}
    >
      <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 13 : 15, textAlign: "center" }}>{title}</Text>
    </Pressable>
  );
}

/** A tappable option card (service, unit, payment method...). */
export function Choice({ active, disabled, onPress, children, style }: { active?: boolean; disabled?: boolean; onPress: () => void; children: ReactNode; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.choice, active && s.choiceActive, disabled && { opacity: 0.45 }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({ label, sub, active, onPress, disabled }: { label: string; sub?: string; active?: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.chip, active && { backgroundColor: C.brand, borderColor: C.brand }, disabled && { opacity: 0.35 }]}>
      {sub ? <Text style={[s.chipSub, active && { color: "#ffedd5" }]}>{sub}</Text> : null}
      <Text style={[s.chipText, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 4 }}>
      <Label>{label}</Label>
      <TextInput placeholderTextColor="#94a3b8" style={s.input} {...props} />
    </View>
  );
}

export function Check({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View style={[s.box, checked && { backgroundColor: C.brand, borderColor: C.brand }]}>{checked && <Text style={{ color: "#fff", fontWeight: "800" }}>✓</Text>}</View>
      <Text style={{ flex: 1, fontSize: 14, color: C.ink }}>{children}</Text>
    </Pressable>
  );
}

export function Row({ k, v, bold, accent }: { k: string; v: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 2 }}>
      <Text style={{ color: C.muted, flexShrink: 1 }}>{k}</Text>
      <Text style={{ textAlign: "right", flexShrink: 1, fontWeight: bold ? "800" : "400", color: accent ? C.brandDark : C.ink }}>{v}</Text>
    </View>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok" | "dark"; children: ReactNode }) {
  const t = {
    info: ["#e0f2fe", "#075985"],
    warn: ["#fef3c7", "#78350f"],
    danger: ["#ffe4e6", "#9f1239"],
    ok: ["#d1fae5", "#065f46"],
    dark: [C.ink, "#fff"],
  }[tone];
  return (
    <View style={{ backgroundColor: t[0], borderRadius: 12, padding: 12 }}>
      <Text style={{ color: t[1], fontSize: 13 }}>{children}</Text>
    </View>
  );
}

/** Horizontal tab strip, e.g. the owner's Today / Calendar / Payments... */
export function Segments<T extends string>({ items, value, onChange, badge }: { items: readonly T[]; value: T; onChange: (v: T) => void; badge?: Partial<Record<T, number>> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {items.map((it) => (
        <Pressable key={it} onPress={() => onChange(it)} style={[s.seg, value === it && { backgroundColor: C.ink }]}>
          <Text style={{ fontWeight: "700", fontSize: 13, color: value === it ? "#fff" : C.muted }}>{it}</Text>
          {!!badge?.[it] && (
            <View style={s.badgeDot}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{badge[it]}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const STATUS_COLORS: Record<BookingStatus, [string, string]> = {
  HELD: ["#fef3c7", "#92400e"],
  PENDING_VERIFICATION: ["#ffedd5", "#9a3412"],
  CONFIRMED: ["#d1fae5", "#065f46"],
  ONGOING: ["#e0f2fe", "#075985"],
  COMPLETED: ["#f1f5f9", "#334155"],
  EXPIRED: ["#f1f5f9", "#64748b"],
  CANCELLED: ["#ffe4e6", "#be123c"],
  NO_SHOW: ["#ffe4e6", "#be123c"],
};

export const STATUS_BAR_COLOR: Record<BookingStatus, string> = {
  HELD: "#fbbf24",
  PENDING_VERIFICATION: "#f97316",
  CONFIRMED: "#10b981",
  ONGOING: "#0ea5e9",
  COMPLETED: "#94a3b8",
  EXPIRED: "#cbd5e1",
  CANCELLED: "#fda4af",
  NO_SHOW: "#fb7185",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const [bg, fg] = STATUS_COLORS[status];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: C.line },
  h1: { fontSize: 22, fontWeight: "800", color: C.ink },
  h2: { fontSize: 17, fontWeight: "700", color: C.ink },
  label: { fontSize: 12, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  muted: { fontSize: 14, color: C.muted },
  btn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  choice: { borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", gap: 4 },
  choiceActive: { borderColor: C.brand, borderWidth: 2, backgroundColor: C.brandSoft },
  chip: { borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff", alignItems: "center", minWidth: 56 },
  chipText: { fontWeight: "700", color: C.ink, fontSize: 14 },
  chipSub: { fontSize: 11, color: C.muted },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: "#fff", color: C.ink },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#94a3b8", alignItems: "center", justifyContent: "center", marginTop: 1 },
  seg: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#e2e8f0" },
  badgeDot: { backgroundColor: C.danger, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
});
