import { Suspense } from "react";
import BookingWizard from "./BookingWizard";

export const metadata = { title: "Book · 24/7 Rentals & Tours" };

export default function BookPage() {
  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Loading…</p>}>
      <BookingWizard />
    </Suspense>
  );
}
