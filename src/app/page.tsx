import Link from "next/link";

const SERVICES = [
  { key: "SELF_DRIVE", title: "Self-drive", blurb: "Drive it yourself. Sedan, MPV or SUV, priced per 24 hours.", icon: "🚗" },
  { key: "WITH_DRIVER", title: "With driver", blurb: "We drive, you relax. Airport runs, events, business trips.", icon: "🧑‍✈️" },
  { key: "DAY_TOUR", title: "6-hour Day Tour", blurb: "Fixed package with driver and fuel. Pick a morning or afternoon slot.", icon: "🏝️" },
  { key: "LONG_TOUR", title: "Long-term Tour", blurb: "Multi-day trips around the province with your own driver.", icon: "🗺️" },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-orange-400 p-6 text-white sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-orange-100">Open 24/7</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Book your ride or tour in 3 minutes.
        </h1>
        <p className="mt-3 max-w-xl text-orange-50">
          See which units are free, lock your dates with a GCash or bank deposit, and get a text reminder before pickup.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/book" className="btn bg-white text-brand-700 hover:bg-orange-50">Book now</Link>
          <Link href="/my-bookings" className="btn bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25">My bookings</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <Link key={s.key} href={`/book?service=${s.key}`} className="card flex items-start gap-4 p-5 transition hover:ring-brand-500">
            <span className="text-3xl">{s.icon}</span>
            <span>
              <span className="block font-bold">{s.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{s.blurb}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="font-bold">How booking works</h2>
        <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-xl bg-slate-50 p-3"><b>1. Pick dates & unit.</b> Only free units can be picked.</li>
          <li className="rounded-xl bg-slate-50 p-3"><b>2. Pay the deposit.</b> GCash or bank transfer. We hold the unit for 30 minutes while you pay.</li>
          <li className="rounded-xl bg-slate-50 p-3"><b>3. Get your code by SMS.</b> Pay the balance at pickup: cash, GCash or bank.</li>
        </ol>
      </section>
    </div>
  );
}
