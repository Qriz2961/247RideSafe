import { BUSINESS, RULES } from "@/lib/config";
import { peso } from "@/lib/format";

// DRAFT wording only. Nole (and ideally a lawyer) must replace this before go-live.
export default function AgreementText() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-600">
      <p className="font-semibold text-slate-800">{BUSINESS.name} Booking Agreement ({RULES.agreementVersion}, draft)</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li>The deposit holds the unit for my dates. The balance is paid on or before pickup (cash, GCash or bank transfer).</li>
        <li>Cancellation: 72+ hrs before pickup, full deposit refund or free rebooking; 24–72 hrs, 50% refund; under 24 hrs or no-show, the deposit is forfeited.</li>
        <li>Self-drive: I am at least {RULES.selfDriveMinAge}, hold a valid license, and leave a refundable security deposit of {peso(RULES.selfDriveSecurityDeposit)}. I return the unit with the same fuel level.</li>
        <li>I pay for traffic violations, toll and parking fees, and damage or loss caused during my rental, minus what insurance covers.</li>
        <li>No smoking. No out-of-area or RoRo trips without written approval from the owner.</li>
        <li>Late return: charged per hour after a 1-hour grace period, up to the full day rate.</li>
        <li>My personal data (including license details) is used only for this booking and kept as required under the Data Privacy Act of 2012.</li>
      </ol>
    </div>
  );
}
