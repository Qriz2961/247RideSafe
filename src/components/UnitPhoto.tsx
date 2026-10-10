import type { Unit } from "@/lib/types";

/** Placeholder until Nole uploads real photos. Simple side view tinted to the unit's colour. */
export default function UnitPhoto({ unit, className = "" }: { unit: Unit; className?: string }) {
  const van = unit.type === "Van";
  const tall = unit.type === "SUV" || unit.type === "MPV";
  const dark = unit.color === "#1e293b";
  return (
    <svg viewBox="0 0 200 100" className={`rounded-xl bg-gradient-to-b from-slate-50 to-slate-200 ${className}`} aria-label={unit.name} role="img">
      <ellipse cx="100" cy="86" rx="80" ry="5" fill="#94a3b8" opacity=".4" />
      {van ? (
        <path d="M22 76 V38 Q22 26 36 26 H150 Q166 26 172 44 L180 60 V76 Z" fill={unit.color} stroke="#334155" strokeWidth="2" />
      ) : (
        <path
          d={tall ? "M18 76 V58 Q20 48 34 46 L56 30 Q62 26 72 26 H128 Q138 26 146 34 L162 48 Q182 50 184 62 V76 Z" : "M16 76 V62 Q18 54 32 52 L60 36 Q66 32 76 32 H124 Q134 32 142 40 L156 52 Q180 54 184 64 V76 Z"}
          fill={unit.color}
          stroke="#334155"
          strokeWidth="2"
        />
      )}
      <path d={van ? "M34 34 H150 Q160 34 164 46 L168 54 H34 Z" : tall ? "M62 34 H126 Q134 34 140 40 L152 50 H50 Z" : "M68 40 H122 Q130 40 136 46 L146 54 H52 Z"} fill={dark ? "#64748b" : "#bae6fd"} opacity=".9" />
      <circle cx="52" cy="78" r="11" fill="#1e293b" /><circle cx="52" cy="78" r="5" fill="#cbd5e1" />
      <circle cx="152" cy="78" r="11" fill="#1e293b" /><circle cx="152" cy="78" r="5" fill="#cbd5e1" />
      <text x="100" y="18" textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="sans-serif">{unit.plateNo}</text>
    </svg>
  );
}
