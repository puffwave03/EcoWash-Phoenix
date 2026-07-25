export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6faf8] px-6 py-12 text-slate-950">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 text-center">
        <div
          aria-label="EcoWash Phoenix logo placeholder"
          className="flex size-20 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-xl font-semibold text-emerald-700 shadow-sm"
        >
          EP
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
            EcoWash Phoenix
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            A clean public website foundation for the EcoWash Phoenix planning
            phase.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-700 px-6 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2"
        >
          View Project
        </button>
      </section>
    </main>
  );
}
